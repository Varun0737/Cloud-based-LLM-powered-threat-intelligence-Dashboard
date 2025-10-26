import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import api from "../api";

// Very small keyword → ISO A2 mapping (extend as you like)
const COUNTRY_HINTS = [
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

function inferIso2(text) {
  if (!text) return null;
  for (const r of COUNTRY_HINTS) {
    if (r.k.test(text)) return r.iso2;
  }
  // domain TLD hint
  const tld = text.match(/\.(cn|ru|de|fr|in|us|uk|tr|il|ca)\b/i);
  if (tld) {
    const m = tld[1].toLowerCase();
    const map = { us: "US", uk: "GB", cn: "CN", ru: "RU", de: "DE", fr: "FR", in: "IN", tr: "TR", il: "IL", ca: "CA" };
    return map[m] || null;
  }
  return null;
}

export default function WorldThreatMap({ height = 340 }) {
  const svgRef = useRef(null);
  const [topList, setTopList] = useState([]);

  useEffect(() => {
    let alive = true;

    async function go() {
      try {
        // 1) fetch some recent CVEs you already have
        const r = await api.get("/api/cve/recent?limit=200");
        const items = r.data?.items || [];

        // 2) create a country frequency map
        const counts = new Map();
        for (const it of items) {
          const bag = [
            it.vendor,
            it.summary,
            it.cveId,
            it.url,
          ]
            .filter(Boolean)
            .join(" | ");

          const iso2 = inferIso2(bag);
          if (iso2) counts.set(iso2, (counts.get(iso2) || 0) + 1);
        }

        // 3) Prepare data for coloring
        const countries = feature(worldData, worldData.objects.countries);
        const idToIso2 = (obj) => obj.properties?.iso_a2 || obj.properties?.iso2 || obj.id; // depends on atlas version
        const vals = countries.features.map((f) => counts.get(idToIso2(f)) || 0);
        const max = d3.max(vals) || 0;
        const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, max || 1]);

        // 4) draw
        const width = svgRef.current.parentElement.clientWidth;
        const svg = d3.select(svgRef.current).attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%");
        svg.selectAll("*").remove();

        const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
        const path = d3.geoPath(projection);

        // water
        svg.append("path")
          .datum({ type: "Sphere" })
          .attr("d", path)
          .attr("fill", "#0f172a"); // slate-900-ish

        // countries
        svg.append("g")
          .selectAll("path")
          .data(countries.features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d) => color(counts.get(idToIso2(d)) || 0))
          .attr("stroke", "#1f2937")
          .attr("stroke-width", 0.5)
          .append("title")
          .text((d) => {
            const iso2 = idToIso2(d);
            const c = counts.get(iso2) || 0;
            const name = d.properties?.name || iso2 || "Unknown";
            return `${name}: ${c}`;
          });

        // top list for side panel
        const arr = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (alive) setTopList(arr);
      } catch (e) {
        console.error("map load failed:", e);
        if (alive) setTopList([]);
      }
    }

    go();
    return () => (alive = false);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-3 bg-gray-800/50 rounded-lg border border-gray-700 p-3">
        <svg ref={svgRef} />
      </div>
      <aside className="col-span-1 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <h3 className="font-medium mb-2">Top Countries</h3>
        {topList.length === 0 ? (
          <p className="text-sm text-gray-400">No country matches yet.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {topList.map(([iso2, c]) => (
              <li key={iso2} className="flex justify-between">
                <span>{iso2}</span>
                <span className="text-gray-300">{c}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-500 mt-3">
          Country is inferred from vendor/summary keywords. Expand the hints for better accuracy.
        </p>
      </aside>
    </div>
  );
}

