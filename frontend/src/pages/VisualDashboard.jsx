import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import api from "../api";
import { Link } from "react-router-dom";

export default function VisualDashboard() {
  const [loading, setLoading] = useState(true);

  // Data States
  const [severity, setSeverity] = useState({ labels: [], values: [] });
  const [vendors, setVendors] = useState({ names: [], counts: [] });
  const [trend, setTrend] = useState({ dates: [], counts: [] });
  const [sources, setSources] = useState({ names: [], counts: [] });

  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Severity Distribution
        const sRes = await api.get("/api/cve/stats", { headers });
        const sBuckets = sRes.data.buckets;
        setSeverity({
          labels: Object.keys(sBuckets),
          values: Object.values(sBuckets)
        });

        // 2. Top Vendors
        const vRes = await api.get("/api/stats/cve-vendors", { headers });
        setVendors({
          names: vRes.data.map(d => d._id),
          counts: vRes.data.map(d => d.count)
        });

        // 3. Trend
        const tRes = await api.get("/api/stats/cve-trend", { headers });
        setTrend({
          dates: tRes.data.map(d => d.period),
          counts: tRes.data.map(d => d.count)
        });

        // 4. Sources (Legacy Meta)
        const srcRes = await api.get("/api/stats/top-sources", { headers });
        setSources({
          names: srcRes.data?.data?.map(d => d.source) || [],
          counts: srcRes.data?.data?.map(d => d.count) || []
        });

      } catch (e) {
        if (alive) setErr(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-cyber-black flex items-center justify-center font-mono text-neon-cyan animate-pulse">
      INITIALIZING VISUALIZATION ENGINE...
    </div>
  );

  return (
    <main className="min-h-screen p-6 font-tech text-gray-100 bg-cyber-black scrollbar-hide">
      <header className="flex items-center justify-between mb-8 border-b border-neon-purple/20 pb-4">
        <div>
          <h1 className="text-3xl font-cyber text-neon-purple drop-shadow-[0_0_15px_rgba(157,0,255,0.6)]">
            Global Analytics Center
          </h1>
          <p className="text-sm text-gray-400 font-mono tracking-wide mt-1">
            Real-time Threat Telemetry & Statistical Modeling
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={loading}
            onClick={async (e) => {
              if (!window.confirm("This will fetch fresh CVE data from the last 120 days. Continue?")) return;
              const btn = e.target;
              const originalText = btn.innerText;
              btn.innerText = "Syncing...";
              btn.disabled = true;
              try {
                await api.post("/api/cve/seed", {}, {
                  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                alert("Update started! Charts will appear in ~1 minute.");
              } catch (e) {
                alert("Failed: " + e.message);
              } finally {
                setTimeout(() => {
                  btn.innerText = originalText;
                  btn.disabled = false;
                }, 5000);
              }
            }}
            className="text-sm font-bold uppercase tracking-wider border border-neon-cyan/30 px-4 py-2 rounded hover:bg-neon-cyan/10 hover:border-neon-cyan text-neon-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↻ Update DB
          </button>
          <Link to="/" className="text-sm font-bold uppercase tracking-wider border border-neon-purple/30 px-6 py-2 rounded hover:bg-neon-purple/10 hover:border-neon-purple text-neon-purple transition-all">
            Main Dashboard
          </Link>
        </div>
      </header>

      {err && <div className="p-4 bg-red-900/30 border border-red-500/50 text-red-200 mb-6 rounded">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">

        {/* ROW 1: Severity Pie & Trend Area */}

        <div className="bg-cyber-gray/20 rounded-xl border border-neon-pink/30 p-4 shadow-[0_0_20px_rgba(255,0,60,0.05)] backdrop-blur-sm">
          <h3 className="text-xl font-cyber text-neon-pink mb-2 border-b border-neon-pink/20 pb-2 pl-2">Severity Distribution</h3>
          <Plot
            data={[{
              type: "pie",
              labels: severity.labels,
              values: severity.values,
              hole: 0.4,
              textinfo: "label+percent",
              marker: {
                colors: ["#ff003c", "#ff8000", "#fcee0a", "#00f3ff", "#808080"] // Crit, High, Med, Low, Unk
              },
              textposition: 'inside',
              hoverinfo: 'label+value'
            }]}
            layout={{
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e5e7eb", family: "Rajdhani" },
              margin: { t: 20, b: 20, l: 20, r: 20 },
              showlegend: true,
              legend: { orientation: 'h', y: -0.1 }
            }}
            useResizeHandler
            style={{ width: "100%", height: "300px" }}
            config={{ displayModeBar: false }}
          />
        </div>

        <div className="bg-cyber-gray/20 rounded-xl border border-neon-cyan/30 p-4 shadow-[0_0_20px_rgba(0,243,255,0.05)] backdrop-blur-sm">
          <h3 className="text-xl font-cyber text-neon-cyan mb-2 border-b border-neon-cyan/20 pb-2 pl-2">Disclosure Timeline</h3>
          <Plot
            data={[{
              type: "scatter",
              mode: "lines+markers",
              fill: 'tozeroy', // Area chart
              x: trend.dates,
              y: trend.counts,
              line: { color: "#00f3ff", shape: 'spline' },
              marker: { color: "#00f3ff", size: 6 }
            }]}
            layout={{
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e5e7eb", family: "Rajdhani" },
              xaxis: { showgrid: false, zeroline: false, color: "#6b7280" },
              yaxis: { gridcolor: "#374151", zeroline: false, color: "#6b7280" },
              margin: { t: 20, b: 40, l: 40, r: 20 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "300px" }}
            config={{ displayModeBar: false }}
          />
        </div>

        {/* ROW 2: Vendors Bar & Sources Bar */}

        <div className="lg:col-span-2 bg-cyber-gray/20 rounded-xl border border-neon-purple/30 p-6 shadow-[0_0_20px_rgba(157,0,255,0.05)] backdrop-blur-sm">
          <h3 className="text-xl font-cyber text-neon-purple mb-4 border-b border-neon-purple/20 pb-2 pl-2">Top Affected Vendors</h3>
          {vendors.names.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center text-gray-500 font-mono border border-dashed border-gray-700 rounded">
              NO VENDOR DATA AVAILABLE - TRY UPDATING DB
            </div>
          ) : (
            <Plot
              data={[{
                type: "bar",
                x: vendors.names,
                y: vendors.counts,
                text: vendors.counts.map(String), // Show numbers on bars
                textposition: 'auto',
                marker: {
                  color: '#00f3ff', // Bright Cyan for max contrast
                  opacity: 1.0,
                  line: {
                    color: '#ffffff',
                    width: 1
                  }
                }
              }]}
              layout={{
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: { color: "#e5e7eb", family: "Rajdhani" },
                xaxis: { tickangle: -45, color: "#9ca3af" },
                yaxis: { color: "#9ca3af", gridcolor: "#374151" },
                margin: { t: 20, b: 80, l: 50, r: 20 },
              }}
              useResizeHandler
              style={{ width: "100%", height: "350px" }}
              config={{ displayModeBar: false }}
            />
          )}
        </div>

        <div className="lg:col-span-2 bg-cyber-gray/20 rounded-xl border border-neon-green/30 p-6 shadow-[0_0_20px_rgba(0,255,157,0.05)] backdrop-blur-sm">
          <h3 className="text-xl font-cyber text-neon-green mb-4 border-b border-neon-green/20 pb-2 pl-2">Intelligence Source Volume</h3>
          <Plot
            data={[{
              type: "bar",
              x: sources.names,
              y: sources.counts,
              orientation: 'h', // Horizontal bar
              marker: {
                color: '#00ff9d',
                opacity: 0.8
              }
            }]}
            layout={{
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#e5e7eb", family: "Rajdhani" },
              xaxis: { color: "#9ca3af", gridcolor: "#374151" },
              yaxis: { color: "#9ca3af", automargin: true },
              margin: { t: 20, b: 40, l: 150, r: 20 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "350px" }}
            config={{ displayModeBar: false }}
          />
        </div>

      </div>
    </main>
  );
}
