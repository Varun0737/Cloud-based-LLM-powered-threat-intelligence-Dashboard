// frontend/src/components/SeverityDonut.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

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

// Neon Palette for Cyber Theme
const COLORS = {
  Critical: "#ff003c", // Neon Pink/Red
  High: "#fcee0a", // Neon Yellow
  Medium: "#00ff9d", // Neon Green
  Low: "#00f3ff", // Neon Blue
  Unknown: "#6b7280", // Gray
};

export default function SeverityDonut() {
  const [buckets, setBuckets] = useState({ Critical: 0, High: 0, Medium: 0, Low: 0, Unknown: 0 });
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [err, setErr] = useState("");

  const loadStats = async () => {
    try {
      setBusy(true);
      setErr("");
      const token = localStorage.getItem("token");
      const res = await api.get("/api/cve/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBuckets(res.data?.buckets || {});
      setTotal(res.data?.total || 0);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const triggerSeed = async () => {
    if (!window.confirm("This will fetch ~10,000 items from NVD in the background. It may take a minute. Continue?")) return;
    setSeeding(true);
    try {
      const token = localStorage.getItem("token");
      await api.post("/api/cve/seed", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Seeding started! Refresh in a few minutes to see updated stats.");
    } catch (e) {
      alert("Failed to start seed: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const segments = useMemo(() => buildSegments(buckets), [buckets]);

  return (
    <section className="mt-10 p-6 rounded-xl border border-neon-cyan/20 bg-cyber-gray/30 backdrop-blur-sm shadow-[0_0_20px_rgba(0,243,255,0.05)]">
      <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-3">
        <div>
          <h2 className="text-lg font-cyber text-neon-cyan tracking-wide">CONFIRMED VULNERABILITIES</h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Global Database Distribution ({total.toLocaleString()} records)
          </p>
        </div>
        <button
          onClick={triggerSeed}
          disabled={seeding}
          className="text-xs border border-neon-green/30 text-neon-green hover:bg-neon-green/10 px-3 py-1 rounded uppercase font-bold tracking-wider transition-all disabled:opacity-50"
        >
          {seeding ? "SYNCING..." : "SYNC DATABASE"}
        </button>
      </div>

      {busy ? (
        <div className="text-neon-cyan animate-pulse font-mono text-sm">&gt;&gt; ANALYZING DATA BLOCKS...</div>
      ) : err ? (
        <div className="text-neon-pink font-mono text-sm">ERROR: {err}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Donut */}
          <div className="flex items-center justify-center relative">
            <svg viewBox="0 0 120 120" className="w-64 h-64 drop-shadow-[0_0_10px_rgba(0,243,255,0.2)]">
              {/* base ring */}
              <circle
                cx="60"
                cy="60"
                r="40"
                fill="none"
                stroke="#111827"
                strokeWidth="12"
              />
              {segments.map((s) => {
                const C = 2 * Math.PI * 40;
                const dash = (s.pct / 100) * C;
                const gap = C - dash;
                const rotation = (s.start / 100) * 360 - 90;
                return (
                  <g key={s.key} transform={`rotate(${rotation} 60 60)`}>
                    <circle
                      cx="60"
                      cy="60"
                      r="40"
                      fill="none"
                      stroke={COLORS[s.key]}
                      strokeWidth="12"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeLinecap="butt"
                      className="transition-all duration-1000 ease-out"
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
                className="fill-white font-cyber font-bold drop-shadow-md"
                fontSize="14"
              >
                {total > 1000 ? (total / 1000).toFixed(1) + "k" : total}
              </text>
            </svg>
            {/* Decorative spinner ring */}
            <div className="absolute inset-0 border-2 border-dashed border-neon-cyan/20 rounded-full w-64 h-64 animate-[spin_10s_linear_infinite] pointer-events-none"></div>
          </div>

          {/* Legend + bars */}
          <div className="flex flex-col justify-center gap-4 font-mono">
            {Object.keys(buckets).map((key) => {
              const count = buckets[key];
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key} className="space-y-1 group">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="text-neon-cyan font-bold w-4">{key === "Critical" ? "CRIT" : key.slice(0, 4).toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-white font-bold">{count.toLocaleString()}</span> <span className="text-gray-500">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-black/50 overflow-hidden relative border border-gray-800 group-hover:border-white/20 transition-colors">
                    <div
                      className="h-full relative overflow-hidden"
                      style={{
                        width: `${pct}%`,
                        background: COLORS[key],
                        boxShadow: `0 0 10px ${COLORS[key]}`
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
