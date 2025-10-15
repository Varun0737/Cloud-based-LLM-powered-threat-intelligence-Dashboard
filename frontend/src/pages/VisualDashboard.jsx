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
  const yCounts  = top.map(d => d.count);

  const volX = vol.map(d => d.bucket);
  const volY = vol.map(d => d.count);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="px-6 py-4 border-b bg-white/80 backdrop-blur">
        <h1 className="text-xl font-semibold">Threat Analytics</h1>
        <p className="text-sm text-gray-500">Week 8 · Stage 2 (live data)</p>
      </header>

      <section className="max-w-6xl mx-auto p-6 space-y-8">
        {loading && <p className="text-gray-500">Loading charts…</p>}
        {err && <p className="text-red-600">{err}</p>}

        {/* Top Sources - Bar */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Top Sources (Bar)</h2>
          <Plot
            data={[
              {
                type: "bar",
                x: xSources,
                y: yCounts,
                hovertemplate: "%{x}: %{y} reports<extra></extra>",
              },
            ]}
            layout={{
              margin: { t: 10, r: 20, b: 60, l: 50 },
              xaxis: { title: "Source" },
              yaxis: { title: "Count" },
              autosize: true,
            }}
            useResizeHandler
            style={{ width: "100%", height: "420px" }}
            config={{ displaylogo: false, responsive: true }}
          />
        </div>

        {/* Top Sources - Pie */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Top Sources (Share)</h2>
          <Plot
            data={[
              {
                type: "pie",
                labels: xSources,
                values: yCounts,
                textinfo: "label+percent",
                hovertemplate: "%{label}: %{value} reports<extra></extra>",
              },
            ]}
            layout={{ margin: { t: 10, r: 10, b: 10, l: 10 }, autosize: true }}
            useResizeHandler
            style={{ width: "100%", height: "420px" }}
            config={{ displaylogo: false, responsive: true }}
          />
        </div>

        {/* Volume Line (only if we have data) */}
        {vol.length > 0 && (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Documents Over Time</h2>
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: volX,
                  y: volY,
                  hovertemplate: "%{x}: %{y}<extra></extra>",
                },
              ]}
              layout={{
                margin: { t: 10, r: 20, b: 60, l: 50 },
                xaxis: { title: "Date" },
                yaxis: { title: "Count" },
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

