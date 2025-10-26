// src/pages/GlobalThreatMap.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { json as d3json } from "d3-fetch";
import { scaleLinear } from "d3-scale";
import api from "../api";

const WORLD_TOPO =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_REGEX = [
  { regex: /\b(United States|USA|U\.S\.A\.|US)\b/i, iso3: "USA" },
  { regex: /\b(United Kingdom|UK|England|Britain)\b/i, iso3: "GBR" },
  { regex: /\b(China|PRC)\b/i, iso3: "CHN" },
  { regex: /\b(Russia|Russian Federation)\b/i, iso3: "RUS" },
  { regex: /\b(Germany|Deutschland)\b/i, iso3: "DEU" },
  { regex: /\b(France|Français)\b/i, iso3: "FRA" },
  { regex: /\b(India|Bharat)\b/i, iso3: "IND" },
  { regex: /\b(Japan)\b/i, iso3: "JPN" },
  { regex: /\b(South Korea|Republic of Korea|Korea,? Republic)\b/i, iso3: "KOR" },
  { regex: /\b(Canada)\b/i, iso3: "CAN" },
  { regex: /\b(Australia)\b/i, iso3: "AUS" },
  { regex: /\b(Netherlands|Holland)\b/i, iso3: "NLD" },
  { regex: /\b(Brazil)\b/i, iso3: "BRA" },
  { regex: /\b(Italy)\b/i, iso3: "ITA" },
  { regex: /\b(Spain)\b/i, iso3: "ESP" },
  { regex: /\b(Israel)\b/i, iso3: "ISR" },
  { regex: /\b(UAE|United Arab Emirates)\b/i, iso3: "ARE" },
  { regex: /\b(Turkey|Türkiye)\b/i, iso3: "TUR" },
  { regex: /\b(Iran)\b/i, iso3: "IRN" },
];

const textOf = (item) =>
  [item?.vendor, item?.product, item?.summary, item?.title, item?.cveId]
    .filter(Boolean)
    .join(" ");

const inferCountryIso3 = (text) => {
  if (!text) return null;
  for (const { regex, iso3 } of COUNTRY_REGEX) if (regex.test(text)) return iso3;
  return null;
};

export default function GlobalThreatMap() {
  const [countries, setCountries] = useState([]); // GeoJSON features
  const [cveItems, setCveItems] = useState([]);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null); // {x,y,name,count}

  // Load world topojson -> GeoJSON
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const topo = await d3json(WORLD_TOPO);
        const geo = feature(topo, topo.objects.countries).features;
        if (!cancel) setCountries(geo);
      } catch (e) {
        if (!cancel) setError("Failed to load world map: " + e.message);
      }
    })();
    return () => (cancel = true);
  }, []);

  // Load recent CVEs
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setError("");
        const token = localStorage.getItem("token");
        const res = await api.get("/api/cve/recent?limit=300", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const items = res.data?.items || res.data || [];
        if (!cancel) setCveItems(items);
      } catch (e) {
        if (!cancel) setError(e?.response?.data?.error || e.message);
      }
    })();
    return () => (cancel = true);
  }, []);

  // Count CVEs per ISO3
  const counts = useMemo(() => {
    const m = new Map();
    for (const it of cveItems) {
      const iso3 = inferCountryIso3(textOf(it));
      if (!iso3) continue;
      m.set(iso3, (m.get(iso3) || 0) + 1);
    }
    return m;
  }, [cveItems]);

  const width = 1000;
  const height = 520;

  const projection = useMemo(
    () => geoMercator().fitSize([width, height], { type: "FeatureCollection", features: countries }),
    [countries]
  );

  const path = useMemo(() => geoPath(projection), [projection]);

  const maxVal = useMemo(
    () => Math.max(1, ...Array.from(counts.values())),
    [counts]
  );

  const color = useMemo(
    () => scaleLinear().domain([0, maxVal]).range(["#0f172a", "#ef4444"]),
    [maxVal]
  );

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-800/60">
        <div>
          <h1 className="text-xl font-semibold">Global Threat Map</h1>
          <p className="text-sm text-gray-400">
            Choropleth of recent CVEs by inferred country (demo)
          </p>
        </div>
        <a
          href="/"
          className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
        >
          ← Back to Dashboard
        </a>
      </header>

      <section className="p-6">
        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="grid md:grid-cols-[1fr_280px] gap-6">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 overflow-auto">
            <svg width={width} height={height}>
              <g>
                {countries.map((f) => {
                  // geo.id in this dataset is ISO3 (e.g., "USA", "IND")
                  const iso3 = f.id;
                  const val = counts.get(iso3) || 0;
                  return (
                    <path
                      key={iso3}
                      d={path(f)}
                      fill={color(val)}
                      stroke="#0f172a"
                      strokeWidth={0.5}
                      onMouseMove={(e) =>
                        setHover({
                          x: e.clientX + 12,
                          y: e.clientY + 12,
                          name: f.properties?.name || iso3,
                          count: val,
                        })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </g>
            </svg>

            {hover && (
              <div
                className="fixed z-50 px-3 py-2 text-sm rounded bg-black/80 border border-gray-700 pointer-events-none"
                style={{ left: hover.x, top: hover.y }}
              >
                <div className="font-medium">{hover.name}</div>
                <div className="text-gray-300">
                  CVEs matched: <span className="font-semibold">{hover.count}</span>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h2 className="font-semibold mb-2">Top Countries</h2>
            <ol className="space-y-1 text-sm">
              {Array.from(counts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([iso3, count]) => (
                  <li key={iso3} className="flex justify-between">
                    <span className="text-gray-300">{iso3}</span>
                    <span className="text-gray-100 font-semibold">{count}</span>
                  </li>
                ))}
              {counts.size === 0 && (
                <li className="text-gray-500">No country matches yet.</li>
              )}
            </ol>
            <div className="mt-3 text-xs text-gray-500">
              Country is inferred from vendor/summary keywords. Extend the
              keyword list for accuracy.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

