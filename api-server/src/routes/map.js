import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

// Example: aggregate from your own CVE feed (or DB) on the server
router.get("/country-counts", async (_req, res) => {
  try {
    const r = await fetch("http://localhost:8080/api/cve/recent?limit=300"); // or your DB
    const data = await r.json();
    const items = data?.items || [];

    const hints = [
      { k: /usa|united states|microsoft|google|cisco|vmware/i, iso2: "US" },
      { k: /china|huawei|alibaba|tencent|cn\b/i, iso2: "CN" },
      { k: /russia|ru\b|kaspersky/i, iso2: "RU" },
      { k: /iran|ir\b/i, iso2: "IR" },
      { k: /north korea|dprk|kp\b/i, iso2: "KP" },
      { k: /india|in\b|tata|infosys/i, iso2: "IN" },
      { k: /uk|united kingdom|gb\b|british/i, iso2: "GB" },
      { k: /germany|de\b/i, iso2: "DE" },
      { k: /france|fr\b/i, iso2: "FR" },
      { k: /canada|ca\b/i, iso2: "CA" },
      { k: /israel|il\b|checkpoint|palo alto/i, iso2: "IL" },
      { k: /turkey|tr\b/i, iso2: "TR" },
    ];

    const counts = {};
    function inferIso2(txt) {
      if (!txt) return null;
      for (const h of hints) if (h.k.test(txt)) return h.iso2;
      const tld = txt.match(/\.(cn|ru|de|fr|in|us|uk|tr|il|ca)\b/i);
      if (tld) {
        const m = tld[1].toLowerCase();
        const map = { us: "US", uk: "GB", cn: "CN", ru: "RU", de: "DE", fr: "FR", in: "IN", tr: "TR", il: "IL", ca: "CA" };
        return map[m] || null;
      }
      return null;
    }

    for (const it of items) {
      const bag = [it.vendor, it.summary, it.cveId, it.url].filter(Boolean).join(" | ");
      const iso2 = inferIso2(bag);
      if (iso2) counts[iso2] = (counts[iso2] || 0) + 1;
    }

    const result = Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ countries: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "map aggregation failed" });
  }
});

export default router;

