import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../requireAuth.js";
import CVE from "../models/CVE.js"; // Import CVE model

const router = Router();

// Path to your meta.json file
const META_PATH = process.env.META_PATH || path.join(process.cwd(), "../llm-reader/data/meta.json");

let META = [];
function loadMeta() {
  try {
    const raw = fs.readFileSync(META_PATH, "utf-8");
    META = JSON.parse(raw);
    console.log(`[stats] Loaded ${META.length} items from meta.json`);
  } catch (e) {
    console.error("[stats] Failed to read META_PATH:", META_PATH, e);
    META = [];
  }
}
loadMeta();

/**
 * GET /api/stats/top-sources
 * Returns a list of sources and how many items each has
 */
router.get("/top-sources", requireAuth, (req, res) => {
  const counts = new Map();
  for (const it of META) {
    const src = it.source || "unknown";
    counts.set(src, (counts.get(src) || 0) + 1);
  }

  const data = [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ total: META.length, data });
});

/**
 * Optional: GET /api/stats/volume
 * Returns a timeline of documents per day (if timestamp data exists)
 */
router.get("/volume", requireAuth, (req, res) => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const counts = new Map();
  let usedTs = false;

  for (const it of META) {
    const ts = it.ts || it.timestamp || it.date;
    if (!ts) continue;
    usedTs = true;
    const d = new Date(ts);
    if (isNaN(d)) continue;
    const key = fmt.format(d);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  if (!usedTs) {
    return res.json({ note: "No timestamps found; skipping volume chart", data: [] });
  }

  const data = [...counts.entries()]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));

  res.json({ bucket: "day", data });
});

// --- New CVE Analytics ---

// GET /api/stats/cve-vendors (Top 5 Vendors)
router.get("/cve-vendors", requireAuth, async (req, res) => {
  try {
    const agg = await CVE.aggregate([
      { $match: { vendor: { $exists: true, $ne: null } } },
      { $match: { vendor: { $ne: "" } } },
      { $group: { _id: "$vendor", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    console.log("[DEBUG] Vendors Agg:", agg);
    res.json(agg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats/cve-trend (By Month)
router.get("/cve-trend", requireAuth, async (req, res) => {
  try {
    const agg = await CVE.aggregate([
      { $match: { published: { $exists: true } } },
      {
        $group: {
          _id: {
            year: { $year: "$published" },
            month: { $month: "$published" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format for frontend: "2023-01"
    const data = agg.map(item => ({
      period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

