// frontend/src/components/SeverityDonut.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

// Map a CVSS score to a severity label
function labelFromCvss(score) {
  if (typeof score !== "number") return "Unknown";
  if (score >= 9.0) return "Critical";
  if (score >= 7.0) return "High";
  if (score >= 4.0) return "Medium";
  if (score > 0)   return "Low";
  return "Unknown";
}

// Build SVG donut segments from buckets
function buildSegments(buckets) {
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return Object.entries(buckets).map(([k, v]) => {
    const pct = (v / total) * 100;
    const seg = { key: k, pct, start: acc, end: acc + pct };
    acc += pct;
    return seg;
  });
}

// Simple palette (dark-theme friendly)
const COLORS = {
  Critical: "#ef4444", // red-500
  High:     "#f59e0b", // amber-500
  Medium:   "#22c55e", // green-500
  Low:      "#3b82f6", // blue-500
  Unknown:  "#64748b", // slate-500
};

export default function SeverityDonut() {
  const [items, setItems]   = useState([]);
  const [busy, setBusy]     = useState(true);
  const [err, setErr]       = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setBusy(true);
        setErr("");
        const token = localStorage.getItem("token");
        const res = await api.get("/api/cve/recent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!live) return;
        setItems(res.data?.items || []);
      } catch (e) {
        if (!live) return;
        setErr(e?.response?.data?.error || e.message);
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => { live = false; };
  }, []);

  // Aggregate into buckets
  const buckets = useMemo(() => {
    const init = { Critical: 0, High: 0, Medium: 0, Low: 0, Unknown: 0 };
    for (const it of items) {
      const label = labelFromCvss(it.cvssScore);
      init[label] += 1;
    }
    return init;
  }, [items]);

  const segments = useMemo(() => buildSegments(buckets), [buckets]);
  const total = useMemo(
    () => Object.values(buckets).reduce((a, b) => a + b, 0),
    [buckets]
  );

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">CVE Severity Breakdown</h2>
        <p className="text-[11px] text-gray-400">
          Distribution by CVSS (last 30–90 days)
        </p>
      </div>

      {busy ? (
        <div className="text-gray-400 text-sm">Loading severity…</div>
      ) : err ? (
        <div className="text-red-400 text-sm">{err}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Donut */}
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-60 h-60">
              {/* base ring */}
              <circle
                cx="60"
                cy="60"
                r="40"
                fill="none"
                stroke="#1f2937"  // gray-800 track on dark bg
                strokeWidth="18"
              />
              {segments.map((s) => {
                // Convert percentage segment to stroke-dasharray on a circle
                // circumference = 2πr. r=40 => ~251.3
                const C = 2 * Math.PI * 40;
                const dash = (s.pct / 100) * C;
                const gap = C - dash;
                const rotation = (s.start / 100) * 360 - 90; // start at 12 o'clock
                return (
                  <g key={s.key} transform={`rotate(${rotation} 60 60)`}>
                    <circle
                      cx="60"
                      cy="60"
                      r="40"
                      fill="none"
                      stroke={COLORS[s.key]}
                      strokeWidth="18"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeLinecap="butt"
                    />
                  </g>
                );
              })}
              {/* center label */}
              <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gray-200"
                fontSize="12"
              >
                {total} CVEs
              </text>
            </svg>
          </div>

          {/* Legend + bars */}
          <div className="flex flex-col justify-center gap-3">
            {Object.keys(buckets).map((key) => {
              const count = buckets[key];
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded"
                        style={{ background: COLORS[key] }}
                      />
                      <span>{key}</span>
                    </div>
                    <div className="text-gray-400">
                      {count} <span className="ml-1 text-xs">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded bg-gray-800 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background: COLORS[key],
                        transition: "width .4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
