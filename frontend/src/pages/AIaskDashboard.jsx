import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function AiAskDashboard() {
  const nav = useNavigate();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // simple auth guard
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) nav("/login");
  }, [nav]);

  const syncNews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      await api.post("/api/cve/sync-news", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("INTEL FEED UPDATED: Latest security reports ingested.");
    } catch (e) {
      alert("SYNC FAILED: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setCitations([]);

    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        "/api/ask",
        { question },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnswer(res.data.answer || "");
      setCitations(res.data.citations || []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 font-tech text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 border-b border-neon-cyan/20 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-neon-cyan/60 hover:text-neon-cyan uppercase tracking-wider">
            ← Return
          </Link>
          <h1 className="text-2xl font-cyber text-neon-cyan tracking-wide drop-shadow-[0_0_5px_rgba(0,243,255,0.4)]">AI Intelligence</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs font-bold uppercase tracking-wider border border-neon-green/30 px-4 py-1.5 rounded hover:bg-neon-green/10 hover:border-neon-green text-neon-green transition-colors"
          >
            Search
          </Link>
          <Link
            to="/visuals"
            className="text-xs font-bold uppercase tracking-wider border border-neon-yellow/30 px-4 py-1.5 rounded hover:bg-neon-yellow/10 hover:border-neon-yellow text-neon-yellow transition-colors"
          >
            Visuals
          </Link>
        </div>
      </header>

      {/* Ask box */}
      <section className="p-6 max-w-4xl mx-auto rounded-xl bg-cyber-gray/30 backdrop-blur-sm border border-neon-cyan/20 shadow-[0_0_20px_rgba(0,243,255,0.05)]">
        <label className="block text-sm mb-2 text-neon-cyan font-cyber tracking-wider flex justify-between">
          <span>QUERY CLASSIFIED DATA STREAMS</span>
          <button onClick={syncNews} className="text-[10px] text-neon-green hover:underline">
            [SYNC EXTERNAL INTEL]
          </button>
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded bg-black/50 border border-neon-cyan/30 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all font-mono"
            placeholder='e.g., "Summarize recent phishing activity"'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button
            onClick={ask}
            disabled={loading}
            className="bg-neon-cyan text-black hover:bg-white hover:text-black px-6 py-2 rounded font-cyber uppercase font-bold tracking-wider transition-colors disabled:opacity-50"
          >
            {loading ? "PROCESSING..." : "EXECUTE"}
          </button>
        </div>

        {error && <p className="mt-3 text-neon-pink font-mono">ERROR: {error}</p>}
      </section>

      {/* Answer */}
      <section className="max-w-4xl mx-auto px-6 mt-8">
        {answer && (
          <div className="p-6 bg-cyber-black/80 rounded-lg border border-neon-cyan/30 shadow-[0_0_15px_rgba(0,243,255,0.1)] mb-6">
            <h2 className="font-cyber text-neon-cyan mb-3 border-b border-neon-cyan/20 pb-2">INTELLIGENCE REPORT</h2>
            <div className="whitespace-pre-wrap text-gray-200 leading-relaxed font-mono text-sm border-l-2 border-neon-cyan pl-4">
              {answer}
            </div>
          </div>
        )}

        {/* Citations */}
        {citations?.length > 0 && (
          <div className="p-6 bg-cyber-black/60 rounded-lg border border-gray-700">
            <h3 className="font-cyber text-gray-400 mb-4 uppercase text-sm tracking-widest">Confidence Sources</h3>
            <ul className="space-y-4">
              {citations.map((c, i) => {
                const link = c.final_url || c.url || null;
                return (
                  <li key={i} className="text-sm text-gray-300 font-mono flex flex-col gap-1 border-b border-gray-800 pb-3 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-neon-cyan">[{i + 1}]</span>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neon-green hover:underline break-all truncate"
                        >
                          {link}
                        </a>
                      ) : (
                        <span className="text-gray-500">{c.id}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 uppercase border border-gray-700">
                        {c.source || "source"}
                      </span>
                    </div>
                    {c.snippet && (
                      <p className="text-gray-500 text-xs italic pl-6 border-l border-gray-700">
                        "{String(c.snippet).slice(0, 300)}..."
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

