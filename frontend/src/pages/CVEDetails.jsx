import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";

export default function CVEDetails() {
    const { id } = useParams();
    const [cve, setCve] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await api.get(`/api/cve/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCve(res.data);
            } catch (e) {
                setError(e.response?.data?.error || e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-cyber-black text-neon-cyan font-mono animate-pulse">
            ACCESSING RESTRICTED FILE: {id}...
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cyber-black text-neon-pink">
            <h1 className="text-3xl font-cyber mb-4">ACCESS DENIED</h1>
            <p className="font-mono mb-6">ERROR: {error}</p>
            <Link to="/cve/all" className="border border-neon-pink px-6 py-2 rounded text-neon-pink hover:bg-neon-pink hover:text-black transition-colors uppercase font-bold">
                Return to Archive
            </Link>
        </div>
    );

    if (!cve) return null;

    const isCritical = (cve.severity || "").toUpperCase() === "CRITICAL";

    return (
        <main className="min-h-screen p-8 font-tech text-gray-100 bg-cyber-black relative overflow-hidden">
            {/* Background decoration */}
            <div className={`absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 pointer-events-none ${isCritical ? "bg-neon-pink" : "bg-neon-cyan"}`} />

            <header className="relative z-10 flex items-center justify-between mb-10 border-b border-gray-800 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className={`text-4xl font-cyber tracking-widest ${isCritical ? "text-neon-pink drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]" : "text-neon-cyan drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]"}`}>
                            {cve.id}
                        </h1>
                        <span className={`px-3 py-1 rounded text-sm font-bold border ${isCritical ? "border-neon-pink text-neon-pink bg-neon-pink/10" : "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                            }`}>
                            {cve.severity || "UNKNOWN"}
                        </span>
                    </div>
                    <p className="text-gray-400 font-mono text-sm">SOURCE::Local_Database_Archive</p>
                </div>
                <Link to="/cve/all" className="px-6 py-2 border border-gray-600 rounded hover:border-white hover:bg-white hover:text-black transition-all font-mono text-sm uppercase">
                    X Close File
                </Link>
            </header>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Info */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-cyber-gray/30 p-6 rounded-lg border border-gray-800 backdrop-blur-sm">
                        <h2 className="text-neon-cyan font-cyber mb-4 tracking-wider border-b border-gray-800 pb-2">Vulnerability Description</h2>
                        <p className="text-lg leading-relaxed text-gray-200 font-sans">
                            {cve.summary || "No detailed summary available."}
                        </p>
                    </section>

                    <section className="bg-cyber-gray/30 p-6 rounded-lg border border-gray-800 backdrop-blur-sm">
                        <h2 className="text-neon-cyan font-cyber mb-4 tracking-wider border-b border-gray-800 pb-2">Technical Analysis</h2>
                        <ul className="space-y-4 font-mono text-sm text-gray-300">
                            <li className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-500">AFFECTED VENDOR</span>
                                <span className="text-white">{cve.vendor || "Unknown"}</span>
                            </li>
                            <li className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-500">PUBLISHED DATE</span>
                                <span className="text-white">{new Date(cve.published).toLocaleString()}</span>
                            </li>
                            <li className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-500">LAST MODIFIED</span>
                                <span className="text-white">{new Date(cve.lastModified).toLocaleString()}</span>
                            </li>
                            <li className="flex justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-500">DATA SOURCE</span>
                                <span className="text-white">{cve.source}</span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Metrics Side Panel */}
                <div className="space-y-6">
                    <div className={`p-8 rounded-xl border flex flex-col items-center justify-center text-center ${isCritical ? "bg-neon-pink/5 border-neon-pink/40" : "bg-neon-cyan/5 border-neon-cyan/40"
                        }`}>
                        <span className="text-gray-400 font-cyber text-sm mb-2">BASE SCORE (CVSS)</span>
                        <div className={`text-6xl font-bold font-mono ${isCritical ? "text-neon-pink" : "text-neon-cyan"
                            }`}>
                            {cve.score || "N/A"}
                        </div>
                        <div className="w-full bg-gray-800 h-2 mt-4 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${isCritical ? "bg-neon-pink" : "bg-neon-cyan"}`}
                                style={{ width: `${(cve.score || 0) * 10}%` }}
                            />
                        </div>
                    </div>

                    <div className="p-6 rounded-lg border border-gray-800 bg-black/40">
                        <h3 className="text-gray-500 font-cyber mb-4 text-sm">EXTERNAL REFERENCES</h3>
                        <a
                            href={`https://nvd.nist.gov/vuln/detail/${cve.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full text-center py-3 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan hover:text-black transition-all rounded font-bold uppercase text-sm"
                        >
                            View on NIST NVD ↗
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}
