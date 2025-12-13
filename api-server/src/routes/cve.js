// api-server/src/routes/cve.js
// api-server/src/routes/cve.js
import { Router } from "express";
import { fetchSecurityNews } from "../services/scraperService.js";
import { requireAuth } from "../requireAuth.js";

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
  if (v2) return { severity: v2.baseSeverity || "N/A", score: v2.cvssData?.baseScore || v2.baseScore };
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
 * Fallback: Extract vendor from references (e.g. "https://helpx.adobe.com/..." -> "adobe")
 */
function extractVendorFromReferences(refs = []) {
  for (const r of refs) {
    try {
      const u = new URL(r.url);
      const host = u.hostname.replace(/^www\./, "");
      // Common domains map
      if (host.includes("adobe")) return "Adobe";
      if (host.includes("microsoft")) return "Microsoft";
      if (host.includes("google")) return "Google";
      if (host.includes("apple")) return "Apple";
      if (host.includes("cisco")) return "Cisco";
      if (host.includes("oracle")) return "Oracle";
      if (host.includes("ibm")) return "IBM";
      if (host.includes("linux") || host.includes("kernel.org")) return "Linux";
      if (host.includes("android")) return "Android";
      // Generic domain (skip github/generic lists if possible, but use as last resort)
      if (!host.includes("github") && !host.includes("nist") && !host.includes("mitre")) {
        const parts = host.split(".");
        if (parts.length >= 2) return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
      }
    } catch (_) { }
  }
  return null;
}

/**
 * Fallback: Extract from sourceIdentifier (e.g. "secure@microsoft.com" -> "Microsoft")
 */
function extractVendorFromSource(src = "") {
  if (src.includes("@")) {
    const domain = src.split("@")[1];
    const parts = domain.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
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
  if (/\bhigh\b/.test(lower)) return 8.2;
  if (/\bmedium\b|\bmoderate\b/.test(lower)) return 5.6;
  if (/\blow\b/.test(lower)) return 3.1;

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

    const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(iso(start))}&pubEndDate=${encodeURIComponent(iso(end))}&startIndex=0&resultsPerPage=${limit}`;

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
        const metrics = getSeverityAndScore(c);
        const vendor = extractVendorFromConfigurations(c.configurations);

        return {
          id: c.id,
          title,
          summary: desc,
          vendor: vendor || null,
          published: c.published || null,
          severity: metrics.severity || null,
          score: metrics.score || null,
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
          severity: null, // CIRCL doesn't provide severity, will compute later
          score: typeof it.cvss === "number" ? it.cvss : null,
        };
      });
    }

    /** Final mapping the way you requested */
    const items = (rawItems || []).map((it) => {
      // 1. Resolve Score
      // Use existing 'score' or fallback to extraction
      let finalScore = it.score;
      if (typeof finalScore !== "number") {
        finalScore = extractCvssFromText(`${it.title || ""} ${it.summary || ""}`);
      }

      // 2. Resolve Severity
      // Use existing 'severity' or compute from score
      let finalSeverity = it.severity;
      if (!finalSeverity && typeof finalScore === "number") {
        if (finalScore >= 9.0) finalSeverity = "CRITICAL";
        else if (finalScore >= 7.0) finalSeverity = "HIGH";
        else if (finalScore >= 4.0) finalSeverity = "MEDIUM";
        else finalSeverity = "LOW";
      }

      return {
        id: it.id,
        title: it.title,
        summary: it.summary,
        vendor: it.vendor,
        published: it.published,
        severity: finalSeverity || "N/A",
        score: typeof finalScore === "number" ? finalScore : null,
      };
    });

    res.json({ items });
  } catch (e) {
    console.error("[/api/cve/recent] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

/**
 * POST /api/cve/seed
 * Triggers a background fetch of recent CVEs to populate the local DB.
 * Target: ~10,000 items (High/Critical focus preferably, or just recent).
 */
import CVE from "../models/CVE.js";

router.post("/seed", async (req, res) => {
  // Respond immediately
  res.json({ message: "Seeding started in background..." });

  const TOTAL_TARGET = 10000;
  const PER_PAGE = 2000;
  let fetched = 0;
  let startIndex = 0;

  console.log("Starting CVE seed...");

  try {
    // Seed last 120 days to ensure relevant data
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 120);
    const iso = (d) => d.toISOString().split(".")[0];

    while (fetched < TOTAL_TARGET) {
      const nvdUrl =
        `https://services.nvd.nist.gov/rest/json/cves/2.0?` +
        `pubStartDate=${iso(start)}&pubEndDate=${iso(end)}&` +
        `resultsPerPage=${PER_PAGE}&startIndex=${startIndex}&noRejected`;

      console.log(`Fetching NVD page: ${startIndex} (Target: ${TOTAL_TARGET})`);

      const r = await fetch(nvdUrl, {
        headers: {
          "User-Agent": "threat-intel-dashboard",
          // Add API Key if available: "apiKey": process.env.NVD_API_KEY 
        }
      });

      if (!r.ok) {
        console.error(`NVD Error ${r.status}`);
        break;
      }

      const data = await r.json();
      const vulnerabilities = data.vulnerabilities || [];
      if (vulnerabilities.length === 0) break;

      // Process and Insert
      const ops = vulnerabilities.map(v => {
        const c = v.cve || {};
        const metrics = getSeverityAndScore(c);

        // Resolve Severity/Score logic similar to /recent
        let score = metrics.score;
        let severity = metrics.severity;

        // Fallback for missing severity
        if (!severity && typeof score === "number") {
          if (score >= 9.0) severity = "CRITICAL";
          else if (score >= 7.0) severity = "HIGH";
          else if (score >= 4.0) severity = "MEDIUM";
          else severity = "LOW";
        }

        return {
          updateOne: {
            filter: { id: c.id },
            update: {
              $set: {
                title: makeTitleFromDescription(c.id, getEnglishDescription(c)),
                summary: getEnglishDescription(c),
                vendor: extractVendorFromConfigurations(c.configurations) || extractVendorFromReferences(c.references) || extractVendorFromSource(c.sourceIdentifier),
                published: c.published,
                lastModified: c.lastModified,
                score: score,
                severity: severity || "UNKNOWN",
                source: "NVD"
              }
            },
            upsert: true
          }
        };
      });

      if (ops.length > 0) {
        await CVE.bulkWrite(ops);
        console.log(`Upserted ${ops.length} CVEs.`);
      }

      fetched += vulnerabilities.length;
      startIndex += vulnerabilities.length;

      // Sleep to respect rate limits (NVD w/o key is slow)
      // With no key: roughly 6s delay recommended? Or just wait 2s.
      // If user has key, it's faster.
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
    console.log("Seeding complete.");
  } catch (e) {
    console.error("Seeding failed:", e);
  }
});

/**
 * GET /api/cve/stats
 * Returns aggregation for donut chart
 */
router.get("/stats", async (req, res) => {
  try {
    const total = await CVE.countDocuments();

    // Aggregate by Severity
    const agg = await CVE.aggregate([
      {
        $group: {
          _id: { $toUpper: "$severity" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format: { Critical: 10, High: 50, ... }
    const buckets = { Critical: 0, High: 0, Medium: 0, Low: 0, Unknown: 0 };
    agg.forEach(g => {
      let key = g._id;
      // Capitalize first letter
      if (key) {
        key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
        if (buckets[key] !== undefined) buckets[key] = g.count;
        else buckets.Unknown += g.count; // map strange values to Unknown
      } else {
        buckets.Unknown += g.count;
      }
    });

    res.json({ total, buckets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Sync Threat News
router.post("/sync-news", requireAuth, async (req, res) => {
  try {
    const result = await fetchSecurityNews();
    res.json({ message: "Threat intelligence synced", stats: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cve/all (Stored DB Pagination)
router.get("/all", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const q = (req.query.q || "").trim();
    const skip = (page - 1) * limit;

    const filter = {};
    let sort = { published: -1 };
    let projection = {};

    if (q) {
      filter.$text = { $search: q };
      projection = { score: { $meta: "textScore" } };
      sort = { score: { $meta: "textScore" } };
    }

    const total = await CVE.countDocuments(filter);
    const items = await CVE.find(filter, projection).sort(sort).skip(skip).limit(limit);

    res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/cve/:id (Single Detail)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const cve = await CVE.findOne({ id: req.params.id });
    if (!cve) return res.status(404).json({ error: "CVE not found" });
    res.json(cve);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
