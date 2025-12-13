import { Link } from "react-router-dom";
import { useState } from "react";
import api from "../api";
import ProfileMenu from "../components/ProfileMenu";
import WorldThreatMap from "../components/WorldThreatMap"; // Can be removed later if unused
import SeverityDonut from "../components/SeverityDonut";
import CyberGlobe from "../components/CyberGlobe";

export default function SearchDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [mode, setMode] = useState("local"); // or "openai"

  const runSearch = async (selectedMode = "local") => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    setAnswer(""); // clear previous
    setMode(selectedMode);

    try {
      const token = localStorage.getItem("token");
      const res = await api.get(
        `/api/search?q=${encodeURIComponent(query)}&mode=${selectedMode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(res.data.results || []);
      if (res.data.answer) setAnswer(res.data.answer);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 font-tech text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 border-b border-neon-cyan/20 pb-4">
        <h1 className="text-2xl font-cyber text-neon-cyan tracking-wide drop-shadow-[0_0_5px_rgba(0,243,255,0.4)]">
          Threat Intel Dashboard
        </h1>
        <ProfileMenu />

        <div className="flex items-center gap-2">
          <a
            href="/cve"
            className="border border-neon-green/30 text-neon-green hover:bg-neon-green/10 text-xs uppercase px-3 py-1.5 rounded transition-colors"
          >
            Confirmed Targets (CVE)
          </a>
          <Link
            to="/map"
            className="border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/10 text-xs uppercase px-3 py-1.5 rounded transition-colors"
          >
            Global Map
          </Link>
          <Link
            to="/visuals"
            className="border border-neon-yellow/30 text-neon-yellow hover:bg-neon-yellow/10 text-xs uppercase px-3 py-1.5 rounded transition-colors"
          >
            Data Visuals
          </Link>
          <Link
            to="/ask"
            className="btn-cyan-solid text-xs uppercase font-bold px-3 py-1.5 rounded"
          >
            Ask AI
          </Link>
        </div>
      </header>

      {/* Search Section */}
      <section className="p-6 max-w-4xl mx-auto rounded-xl bg-cyber-gray/30 backdrop-blur-sm border border-neon-cyan/20 shadow-[0_0_20px_rgba(0,243,255,0.05)]">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 px-4 py-3 rounded bg-black/50 border border-neon-cyan/30 text-neon-cyan placeholder-gray-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all font-mono"
            placeholder="Initialize search sequence (e.g., 'Target: Phishing', 'ID: CVE-2024')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => runSearch("local")}
            disabled={loading}
            className="btn-cyan px-6 py-2 rounded disabled:opacity-50 font-cyber uppercase text-sm tracking-wider"
          >
            Scan Records
          </button>
          <button
            onClick={() => runSearch("openai")}
            disabled={loading}
            className="btn-purple px-6 py-2 rounded disabled:opacity-50 font-cyber uppercase text-sm tracking-wider"
          >
            AI Analysis
          </button>
        </div>

        {loading && (
          <p className="text-neon-cyan animate-pulse font-mono text-sm">&gt;&gt; ACCESSING CLASSIFIED DATABASE...</p>
        )}
        {error && <p className="text-neon-pink font-bold">ERROR: {error}</p>}
      </section>

      {/* Results Section */}
      <section className="max-w-4xl mx-auto pt-8 pb-10">
        {answer && (
          <div className="mb-8 p-6 bg-cyber-black/80 rounded-lg border border-neon-purple/50 shadow-[0_0_15px_rgba(180,0,255,0.2)]">
            <h2 className="font-cyber text-neon-purple mb-3 border-b border-neon-purple/20 pb-2 tracking-wider">
              SENTINEL ANALYSIS
            </h2>
            <div className="whitespace-pre-wrap text-gray-200 leading-relaxed font-mono text-sm border-l-2 border-neon-purple pl-4">
              {answer}
            </div>
          </div>
        )}

        {results.length > 0 ? (
          <ul className="space-y-6">
            {results.map((r, idx) => (
              <li
                key={idx}
                className="p-5 bg-cyber-gray/20 rounded-lg border border-gray-800 hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(0,243,255,0.1)] transition-all group"
              >
                <h3 className="font-cyber text-lg mb-2 text-gray-100 group-hover:text-neon-cyan transition-colors">{r.title}</h3>
                <p className="text-gray-400 text-sm mb-3 leading-relaxed font-mono">
                  {(r.snippet || "").slice(0, 400)}...
                </p>
                <div className="text-xs text-gray-500 font-mono flex gap-4 border-t border-gray-800 pt-3">
                  <span className="text-neon-cyan/60">SOURCE::{(r.source || "UNKNOWN").toUpperCase()}</span>
                  <span>ID::{r.id}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !loading &&
          !error &&
          !answer && (
            <p className="text-gray-600 italic text-center mt-10 font-mono">
              // Awaiting operator input...
            </p>
          )
        )}
      </section>

      {/* Global Threat Map panel */}
      <section className="max-w-6xl mx-auto pt-8 pb-16">
        <div className="flex items-center justify-between mb-3 border-l-4 border-neon-yellow pl-3">
          <h2 className="text-lg font-cyber text-gray-200">Global Threat Visualizer</h2>
          <span className="text-xs text-neon-yellow px-2 py-0.5 border border-neon-yellow/30 rounded bg-neon-yellow/5">
            LIVE FEED
          </span>
        </div>

        {/* Replaced WorldThreatMap with CyberGlobe */}
        <CyberGlobe />

      </section>
      {/* NEW: Severity donut directly under the map */}
      <SeverityDonut />
    </main>
  );
}
