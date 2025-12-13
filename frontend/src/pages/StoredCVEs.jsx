import { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";

export default function StoredCVEs() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");

    const fetchStored = async (pageNum, q = "") => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            const res = await api.get(`/api/cve/all?page=${pageNum}&limit=50&q=${encodeURIComponent(q)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(res.data.items || []);
            setTotalPages(res.data.totalPages);
            setPage(pageNum);
        } catch (e) {
            setError("Failed to load local database: " + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchStored(1, query);
    };

    useEffect(() => {
        fetchStored(1);
    }, []);

    return (
        <main className="min-h-screen p-6 font-tech text-gray-100">
            <header className="flex items-center justify-between mb-8 border-b border-neon-purple/30 pb-4">
                <div>
                    <h1 className="text-2xl font-cyber text-neon-purple drop-shadow-[0_0_8px_rgba(157,0,255,0.4)]">
                        Classified Records
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-gray-400 mt-1">Local Database Access</p>
                </div>
                <Link to="/cve" className="text-sm font-bold uppercase tracking-wider border border-neon-purple/30 px-4 py-2 rounded hover:bg-neon-purple/10 text-neon-purple transition-colors">
                    ← Back to Live Feed
                </Link>
            </header>

            <form onSubmit={handleSearch} className="mb-6 flex gap-2 max-w-2xl">
                <input
                    className="flex-1 bg-black/50 border border-gray-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple font-mono"
                    placeholder="Search keywords (e.g., 'SQL', 'Microsoft', 'RCE')..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="bg-neon-purple/20 border border-neon-purple text-neon-purple hover:bg-neon-purple hover:text-black px-6 py-2 rounded font-cyber uppercase font-bold transition-all">
                    Search
                </button>
            </form>

            {error && <div className="p-4 border border-red-500 text-red-400 mb-4 rounded">{error}</div>}

            {loading ? (
                <div className="text-center mt-20 text-neon-purple animate-pulse font-mono">ACCESSING ENCRYPTED ARCHIVES...</div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded border border-gray-800 bg-cyber-gray/40 backdrop-blur-sm shadow-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-black/40 text-neon-purple uppercase tracking-wider border-b border-gray-700 font-bold">
                                <tr>
                                    <th className="text-left px-4 py-3">CVE ID</th>
                                    <th className="text-left px-4 py-3">Severity</th>
                                    <th className="text-left px-4 py-3">Score</th>
                                    <th className="text-left px-4 py-3">Title</th>
                                    <th className="text-left px-4 py-3">Published</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {items.map((it) => (
                                    <tr
                                        key={it.id}
                                        onClick={() => window.location.href = `/cve/details/${it.id}`}
                                        className="hover:bg-neon-purple/10 transition-colors group cursor-pointer border-b border-gray-800/50"
                                    >
                                        <td className="px-4 py-4 font-mono text-neon-cyan font-bold tracking-wide">
                                            {it.id}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${(it.severity || "").toUpperCase() === "CRITICAL" ? "border-neon-pink text-neon-pink bg-neon-pink/10 shadow-[0_0_8px_rgba(255,0,60,0.3)]" :
                                                    (it.severity || "").toUpperCase() === "HIGH" ? "border-orange-500 text-orange-400 bg-orange-500/10" :
                                                        "border-gray-600 text-gray-400"
                                                }`}>
                                                {it.severity || "UNKNOWN"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 font-mono font-bold text-white">{it.score}</td>
                                        <td className="px-4 py-4 text-gray-300 truncate max-w-md font-sans text-sm">{it.title}</td>
                                        <td className="px-4 py-4 text-gray-500 text-xs font-mono">{new Date(it.published).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-center mt-6 gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => fetchStored(page - 1, query)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded font-mono"
                        >
                            &lt; PREV
                        </button>
                        <span className="px-4 py-2 font-cyber text-neon-purple">PAGE {page} / {totalPages}</span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => fetchStored(page + 1, query)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded font-mono"
                        >
                            NEXT &gt;
                        </button>
                    </div>
                </>
            )}
        </main>
    );
}
