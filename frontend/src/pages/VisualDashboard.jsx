import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import api from "../api";

export default function VisualDashboard() {
  const [top, setTop] = useState([]);        // [{source, count}]
  const [vol, setVol] = useState([]);        // [{bucket, count}]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        // Top sources
        const t = await api.get("/api/stats/top-sources", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        // Volume (may be empty if timestamps missing)
        let v = { data: [] };
        try {
          const r = await api.get("/api/stats/volume?bucket=day", {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          });
          v = r.data || { data: [] };
        } catch (e) {
          // non-fatal if missing
          console.warn("volume fetch failed/disabled:", e?.response?.data || e.message);
        }

        if (!alive) return;
        setTop(t.data?.data || []);
        setVol(v.data || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  const xSources = top.map(d => d.source);
  const yCounts = top.map(d => d.count);

  const volX = vol.map(d => d.bucket);
  const volY = vol.map(d => d.count);

  return (
    <main className="min-h-screen p-6 font-tech text-gray-100">
      <header className="flex items-center justify-between mb-8 border-b border-neon-purple/20 pb-4">
        <div>
          <h1 className="text-2xl font-cyber text-neon-purple drop-shadow-[0_0_8px_rgba(157,0,255,0.4)]">Threat Analytics</h1>
          <p className="text-sm text-gray-400 font-mono tracking-wide">Analysis Cycle: Active · Live Data Feed</p>
        </div>
        <a href="/" className="text-sm font-bold uppercase tracking-wider border border-neon-purple/30 px-4 py-2 rounded hover:bg-neon-purple/10 hover:border-neon-purple text-neon-purple transition-colors">
          ← Dashboard
        </a>
      </header>

      <section className="max-w-6xl mx-auto space-y-8">
        {loading && <p className="text-neon-cyan animate-pulse">Processing data streams...</p>}
        {err && <p className="text-red-600">{err}</p>}

        {/* Top Sources - Bar */}
        <div className="rounded-xl border border-neon-purple/20 bg-cyber-gray/30 backdrop-blur-sm p-5 shadow-[0_0_15px_rgba(157,0,255,0.05)]">
          <h2 className="text-lg font-cyber text-gray-200 mb-4 border-l-4 border-neon-purple pl-3">Top Threat Sources</h2>
          <Plot
            data={[
              {
                type: "bar",
                x: xSources,
                y: yCounts,
                hovertemplate: "%{x}: %{y} reports<extra></extra>",
                marker: { color: "#9d00ff", opacity: 0.8 },
              },
            ]}
            layout={{
              margin: { t: 10, r: 20, b: 60, l: 50 },
              xaxis: { title: "Source", color: "#9ca3af" },
              yaxis: { title: "Count", color: "#9ca3af" },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e5e7eb", family: "Rajdhani" },
              autosize: true,
            }}
            useResizeHandler
            style={{ width: "100%", height: "420px" }}
            config={{ displaylogo: false, responsive: true }}
          />
        </div>

        {/* Top Sources - Pie */}
        <div className="rounded-xl border border-neon-pink/20 bg-cyber-gray/30 backdrop-blur-sm p-5 shadow-[0_0_15px_rgba(255,0,60,0.05)]">
          <h2 className="text-lg font-cyber text-gray-200 mb-4 border-l-4 border-neon-pink pl-3">Target Distribution</h2>
          <Plot
            data={[
              {
                type: "pie",
                labels: xSources,
                values: yCounts,
                textinfo: "label+percent",
                hovertemplate: "%{label}: %{value} reports<extra></extra>",
                marker: { colors: ["#00f3ff", "#ff003c", "#00ff9d", "#fcee0a", "#9d00ff"] },
              },
            ]}
            layout={{
              margin: { t: 10, r: 10, b: 10, l: 10 },
              autosize: true,
              paper_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e5e7eb", family: "Rajdhani" },
            }}
            useResizeHandler
            style={{ width: "100%", height: "420px" }}
            config={{ displaylogo: false, responsive: true }}
          />
        </div>

        {/* Volume Line (only if we have data) */}
        {vol.length > 0 && (
          <div className="rounded-xl border border-neon-cyan/20 bg-cyber-gray/30 backdrop-blur-sm p-5 shadow-[0_0_15px_rgba(0,243,255,0.05)]">
            <h2 className="text-lg font-cyber text-gray-200 mb-4 border-l-4 border-neon-cyan pl-3">Temporal Analysis</h2>
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: volX,
                  y: volY,
                  hovertemplate: "%{x}: %{y}<extra></extra>",
                  line: { color: "#00f3ff" },
                },
              ]}
              layout={{
                margin: { t: 10, r: 20, b: 60, l: 50 },
                xaxis: { title: "Date", color: "#9ca3af" },
                yaxis: { title: "Count", color: "#9ca3af" },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: { color: "#e5e7eb", family: "Rajdhani" },
                autosize: true,
              }}
              useResizeHandler
              style={{ width: "100%", height: "420px" }}
              config={{ displaylogo: false, responsive: true }}
            />
          </div>
        )}

        {vol.length === 0 && (
          <p className="text-sm text-gray-500">
            No timestamps found in meta; time-series chart is hidden. You can add a `ts` field to items to enable it.
          </p>
        )}
      </section>
    </main>
  );
}

