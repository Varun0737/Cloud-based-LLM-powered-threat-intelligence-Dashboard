// frontend/src/pages/RecentCVEs.jsx
import { useEffect, useState } from "react";
import api from "../api";

export default function RecentCVEs() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      try {
        const r = await api.get("/api/cve/recent?days=7&limit=50", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setItems(r.data.items || []);
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/60">
        <h1 className="text-xl font-semibold">Threat Intel Dashboard</h1>
        <a href="/" className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">
          ← Back to Dashboard
        </a>
      </header>

      <section className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent CVEs</h2>
          <span className="text-xs text-gray-400">Last 7 days</span>
        </div>

        {loading && <p className="text-gray-400">Loading…</p>}
        {err && <p className="text-red-400">{err}</p>}

        {!loading && !err && items.length === 0 && (
          <p className="text-gray-400">No data.</p>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto rounded border border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-800/50 text-gray-300">
                <tr>
                  <th className="text-left px-3 py-2">CVE</th>
                  <th className="text-left px-3 py-2">Severity</th>
                  <th className="text-left px-3 py-2">CVSS</th>
                  <th className="text-left px-3 py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-800">
                    <td className="px-3 py-2">
                      <a
                        className="text-blue-400 hover:underline"
                        href={`https://nvd.nist.gov/vuln/detail/${it.id}`}
                        target="_blank" rel="noreferrer"
                      >
                        {it.id}
                      </a>
                    </td>
                    <td className="px-3 py-2">{it.severity}</td>
                    <td className="px-3 py-2">{it.score}</td>
                    <td className="px-3 py-2">
                      {it.summary?.slice(0, 220) || ""}
                      {it.summary?.length > 220 ? "…" : ""}
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

