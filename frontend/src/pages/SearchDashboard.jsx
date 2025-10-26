// src/pages/SearchDashboard.jsx
import { Link } from "react-router-dom";
import { useState } from "react";
import api from "../api";
import ProfileMenu from "../components/ProfileMenu";
import WorldThreatMap from "../components/WorldThreatMap";
import SeverityDonut from "../components/SeverityDonut";

export default function SearchDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("local"); // or "openai"

  const runSearch = async (selectedMode = "local") => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setMode(selectedMode);

    try {
      const token = localStorage.getItem("token");
      const res = await api.get(
        `/api/search?q=${encodeURIComponent(query)}&mode=${selectedMode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(res.data.results || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/60">
        <h1 className="text-xl font-semibold tracking-wide">
          Threat Intel Dashboard
        </h1>
        <ProfileMenu />

        <div className="flex items-center gap-2">
          <a
            href="/cve"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-md transition-colors"
          >
            View CVE Feed
          </a>
          <Link
            to="/map"
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
          >
            Map
          </Link>
          <Link
            to="/visuals"
            className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
          >
            Visuals
          </Link>
          <Link
            to="/ask"
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
          >
            Ask AI
          </Link>
        </div>
      </header>

      {/* Search Section */}
      <section className="p-6 max-w-4xl mx-auto">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search threats (e.g., phishing, CVE-2024)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => runSearch("local")}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-60"
          >
            Snippets
          </button>
          <button
            onClick={() => runSearch("openai")}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded disabled:opacity-60"
          >
            AI Explanation
          </button>
        </div>

        {loading && (
          <p className="text-gray-400 italic">Searching {mode} results...</p>
        )}
        {error && <p className="text-red-400">{error}</p>}
      </section>

      {/* Results Section */}
      <section className="max-w-4xl mx-auto px-6 pb-10">
        {results.length > 0 ? (
          <ul className="space-y-6">
            {results.map((r, idx) => (
              <li
                key={idx}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-sm"
              >
                <h3 className="font-semibold text-lg mb-2">{r.title}</h3>
                <p className="text-gray-300 text-sm mb-2">
                  {(r.snippet || "").slice(0, 400)}...
                </p>
                <div className="text-xs text-gray-500">
                  <span>Source: {r.source || "unknown"}</span> ·{" "}
                  <span>ID: {r.id}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !loading &&
          !error && (
            <p className="text-gray-400 italic text-center mt-10">
              No results yet. Try searching something like “phishing”.
            </p>
          )
        )}
      </section>

      {/* NEW: Global Threat Map panel (always visible on the home dashboard) */}
      <section className="max-w-6xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Global Threat Map</h2>
          <span className="text-xs text-gray-400">
            Choropleth of recent CVEs by inferred country (demo)
          </span>
        </div>
        <WorldThreatMap />
      </section>
     {/* NEW: Severity donut directly under the map */}
  <SeverityDonut />
</main>
  );
}
