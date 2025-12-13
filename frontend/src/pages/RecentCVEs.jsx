// frontend/src/pages/RecentCVEs.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function RecentCVEs() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCVEs = async () => {
      const token = localStorage.getItem("token");
      try {
        const r = await api.get("/api/cve/recent?days=7&limit=60", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setItems(r.data.items || []);
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCVEs(); // Update immediately
    const interval = setInterval(fetchCVEs, 60000); // And every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen text-gray-100 p-6 font-tech">
      <div className="flex items-center justify-between mb-6 border-b border-neon-green/20 pb-4">
        <div>
          <h1 className="text-2xl font-cyber text-neon-green drop-shadow-[0_0_8px_rgba(0,255,157,0.4)]">Threat Intel Dashboard</h1>
          <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">System Status: Active Monitoring</p>
        </div>
        <a href="/" className="text-sm font-bold uppercase tracking-wider border border-neon-green/30 px-4 py-2 rounded hover:bg-neon-green/10 hover:border-neon-green text-neon-green transition-colors">
          ← Dashboard
        </a>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-cyber text-gray-100 border-l-4 border-neon-green pl-3">Recent CVEs</h2>
            <a href="/cve/all" className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green hover:text-black px-4 py-1.5 rounded text-xs font-bold uppercase transition-all">
              Call All CVEs
            </a>
          </div>
          <span className="text-xs bg-neon-green/10 text-neon-green px-2 py-1 rounded border border-neon-green/20">T-Minus 7 Days</span>
        </div>

        {loading && <p className="text-neon-cyan animate-pulse">Scanning vulnerable systems...</p>}
        {err && <p className="text-neon-pink font-bold">ERROR: {err}</p>}

        {!loading && !err && items.length === 0 && (
          <p className="text-gray-500 italic">No threats detected in sector.</p>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded border border-gray-800 bg-cyber-gray/40 backdrop-blur-sm shadow-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-black/40 text-neon-green uppercase tracking-wider border-b border-gray-700 font-bold">
                <tr>
                  <th className="text-left px-4 py-3">CVE ID</th>
                  <th className="text-left px-4 py-3">Severity</th>
                  <th className="text-left px-4 py-3">Score</th>
                  <th className="text-left px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-neon-cyan/5 transition-colors group">
                    <td className="px-4 py-3 font-mono text-neon-cyan group-hover:drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${it.id}`}
                        target="_blank" rel="noreferrer"
                      >
                        {it.id}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${(it.severity || "").toUpperCase() === "CRITICAL" ? "border-neon-pink text-neon-pink bg-neon-pink/10" :
                        (it.severity || "").toUpperCase() === "HIGH" ? "border-orange-500 text-orange-400 bg-orange-500/10" :
                          "border-gray-600 text-gray-400"
                        }`}>
                        {it.severity || "UNKNOWN"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{it.score || "-"}</td>
                    <td className="px-4 py-3 text-gray-400 group-hover:text-gray-200 transition-colors">
                      {it.summary?.slice(0, 180) || ""}
                      {it.summary?.length > 180 ? "..." : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

