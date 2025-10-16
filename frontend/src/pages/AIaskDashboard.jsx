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
    <main className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/60">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-300 hover:text-white">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold tracking-wide">Ask AI</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
          >
            Search
          </Link>
          <Link
            to="/visuals"
            className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
          >
            Visuals
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }}
            className="text-sm bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Ask box */}
      <section className="p-6 max-w-4xl mx-auto">
        <label className="block text-sm mb-2 text-gray-300">
          Ask a question about your scraped data
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='e.g., "Summarize recent phishing activity"'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button
            onClick={ask}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            {loading ? "Thinking…" : "Ask AI"}
          </button>
        </div>

        {error && <p className="mt-3 text-red-400">{error}</p>}
      </section>

      {/* Answer */}
      <section className="max-w-4xl mx-auto px-6">
        {answer && (
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 mb-6">
            <h2 className="font-semibold mb-2">Answer</h2>
            <pre className="whitespace-pre-wrap text-gray-200">{answer}</pre>
          </div>
        )}

        {/* Citations */}
        {citations?.length > 0 && (
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="font-semibold mb-3">Citations</h3>
            <ul className="space-y-3">
              {citations.map((c, i) => {
                const link = c.final_url || c.url || null;
                return (
                  <li key={i} className="text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">[{i + 1}]</span>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline break-all"
                        >
                          {link}
                        </a>
                      ) : (
                        <span className="text-gray-400">{c.id}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700">
                        {c.source || "source"}
                      </span>
                    </div>
                    {c.snippet && (
                      <p className="mt-1 text-gray-400">
                        {String(c.snippet).slice(0, 350)}…
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

