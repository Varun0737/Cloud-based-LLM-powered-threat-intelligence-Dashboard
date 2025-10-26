// api-server/src/routes/cve.js
import { Router } from "express";

const router = Router();

/**
 * Helper: pick the English description text from an NVD 2.0 CVE object.
 */
function getEnglishDescription(cve = {}) {
  const list = cve.descriptions || [];
  const en = list.find((d) => d.lang?.toLowerCase() === "en") || list[0];
  return en?.value || "";
}

/**
 * Helper: map CVSS severity/score from NVD CVSS v3.x/v2 metrics (when present).
 * Returns { severity, score } where values may be undefined if missing.
 */
function getSeverityAndScore(cve = {}) {
  const metrics = cve.metrics || {};
  const v31 = metrics.cvssMetricV31?.[0];
  const v30 = metrics.cvssMetricV30?.[0];
  const v2 = metrics.cvssMetricV2?.[0];

  if (v31) return { severity: v31.cvssData?.baseSeverity, score: v31.cvssData?.baseScore };
  if (v30) return { severity: v30.cvssData?.baseSeverity, score: v30.cvssData?.baseScore };
  if (v2)  return { severity: v2.baseSeverity || "N/A", score: v2.cvssData?.baseScore || v2.baseScore };
  return { severity: undefined, score: undefined };
}

/**
 * Helper: try to extract a vendor from NVD "configurations" CPE strings.
 * Looks at the first CPE found and returns the vendor token (cpe:2.3:*:VENDOR:PRODUCT:...).
 */
function extractVendorFromConfigurations(conf = {}) {
  try {
    const nodes = conf?.nodes || [];
    for (const node of nodes) {
      const matches = node.cpeMatch || node.cpe_match || [];
      for (const m of matches) {
        const crit = m.criteria || m.cpe23Uri || m.cpe23uri;
        if (typeof crit === "string" && crit.startsWith("cpe:2.3:")) {
          // cpe:2.3:a:vendor:product:version:...
          const parts = crit.split(":");
          // parts[2] is part type (a/o/h), parts[3] should be vendor
          if (parts.length > 4) return parts[3] || null;
        }
      }
      // Recursively search children
      if (node.children?.length) {
        const v = extractVendorFromConfigurations({ nodes: node.children });
        if (v) return v;
      }
    }
  } catch (_) {
    // ignore parsing issues
  }
  return null;
}

/**
 * Helper: derive a concise title from a longer description.
 * Uses the first sentence or trims to 100 chars.
 */
function makeTitleFromDescription(id, description = "") {
  const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim() || description.trim();
  const base = firstSentence || description || "";
  const short = base.length > 100 ? base.slice(0, 97) + "..." : base;
  // Prefer a human-readable title; prefix with ID if description is too vague/empty.
  return short || id;
}

/**
 * // helpers near the top
 * Parse CVSS info from free text (title/summary).
 * - Numeric: "CVSS 7.8", "CVSS: 9.1", "CVSS base score 5.5"
 * - Severity keywords → typical bucket scores
 */
function extractCvssFromText(txt = "") {
  // 1) Numeric pattern
  const mNum = txt.match(/CVSS(?:\s*base\s*score)?[:\s]+(\d{1,2}(?:\.\d)?)/i);
  if (mNum) {
    const v = parseFloat(mNum[1]);
    if (!Number.isNaN(v) && v >= 0 && v <= 10) return v;
  }

  // 2) Severity keywords → mid-bucket scores
  const lower = txt.toLowerCase();
  if (/\bcritical\b/.test(lower)) return 9.8;
  if (/\bhigh\b/.test(lower))     return 8.2;
  if (/\bmedium\b|\bmoderate\b/.test(lower)) return 5.6;
  if (/\blow\b/.test(lower))      return 3.1;

  return null;
}

/**
 * GET /api/cve/recent?days=7&limit=50
 * Returns { items: Array<{ id, title, summary, vendor, published, cvssScore }> }
 */
router.get("/recent", async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 1), 30);   // clamp 1..30
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);

    // Build NVD 2.0 query for the last N days
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const iso = (d) => d.toISOString().split(".")[0] + "Z"; // trim ms

    const nvdUrl =
      `https://services.nvd.nist.gov/rest/json/cves/2.0?` +
      `pubStartDate=${encodeURIComponent(iso(start))}&` +
      `pubEndDate=${encodeURIComponent(iso(end))}&` +
      `startIndex=0&resultsPerPage=${limit}`;

    /** Step 1: Try NVD */
    let rawItems;
    try {
      const r = await fetch(nvdUrl, { headers: { "User-Agent": "threat-intel-dashboard" } });
      if (!r.ok) throw new Error(`NVD ${r.status}`);
      const data = await r.json();

      // Normalize NVD → rawItems
      rawItems = (data.vulnerabilities || []).map((v) => {
        const c = v.cve || {};
        const desc = getEnglishDescription(c);
        const title = makeTitleFromDescription(c.id, desc);
        const { score } = getSeverityAndScore(c);
        const vendor = extractVendorFromConfigurations(c.configurations);

        return {
          id: c.id,
          title,
          summary: desc,
          vendor: vendor || null,
          published: c.published || null,
          cvssScore: typeof score === "number" ? score : null,
        };
      });
    } catch (nvdErr) {
      /** Step 2: Fallback to CIRCL if NVD failed or rate-limited */
      const circl = await fetch("https://cve.circl.lu/api/last", {
        headers: { "User-Agent": "threat-intel-dashboard" },
      });
      if (!circl.ok) throw new Error(`CIRCL ${circl.status}`);
      const list = await circl.json();

      rawItems = (list || []).slice(0, limit).map((it) => {
        // Build a minimal title from summary
        const summary = it.summary || it.description || "";
        const title = makeTitleFromDescription(it.id, summary);

        return {
          id: it.id,
          title,
          summary,
          vendor: null, // CIRCL 'last' doesn't consistently expose vendor
          published: it.Published || it.published || null,
          cvssScore: typeof it.cvss === "number" ? it.cvss : null,
        };
      });
    }

    /** Final mapping the way you requested */
    const items = (rawItems || []).map((it) => {
      const cvss =
        (typeof it.cvssScore === "number" ? it.cvssScore : undefined) ??
        extractCvssFromText(`${it.title || ""} ${it.summary || ""}`);

      return {
        id: it.id,
        title: it.title,
        summary: it.summary,
        vendor: it.vendor,
        published: it.published,
        cvssScore: typeof cvss === "number" ? cvss : null,
      };
    });

    res.json({ items });
  } catch (e) {
    console.error("[/api/cve/recent] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

export default router;
