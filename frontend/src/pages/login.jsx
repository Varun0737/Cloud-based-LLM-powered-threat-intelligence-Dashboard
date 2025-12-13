import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function Login() {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api.post("/api/auth/login", { email, password });
      localStorage.setItem("token", r.data.token);
      window.location.href = "/";
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-tech text-gray-100 relative overflow-hidden">
      {/* Background Grid handled by App or local fallback */}
      <div className="absolute inset-0 bg-cyber-black z-0"></div>
      <div className="absolute inset-0 z-0 bg-cyber-grid bg-[length:40px_40px] opacity-[0.2]"></div>

      {/* Banner Section */}
      <div className="relative z-10 bg-black/60 backdrop-blur border-b border-neon-cyan/30 py-6 text-center shadow-[0_0_20px_rgba(0,243,255,0.1)]">
        <h1 className="text-3xl font-cyber font-bold tracking-widest text-neon-cyan drop-shadow-[0_0_10px_rgba(0,243,255,0.6)]">
          THREAT::INTEL
        </h1>
        <p className="text-sm text-neon-cyan/60 mt-1 uppercase tracking-[0.3em]">
          Secure Access Terminal
        </p>
      </div>

      {/* Login Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="bg-cyber-gray/40 backdrop-blur-md p-8 rounded-xl shadow-2xl w-full max-w-md border border-neon-cyan/30">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-cyber text-white tracking-wide">AUTHENTICATE</h2>
            <div className="h-0.5 w-16 bg-neon-cyan mx-auto mt-2 text-center shadow-[0_0_8px_rgba(0,243,255,0.8)]"></div>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase text-neon-cyan/80 mb-1 tracking-wider">Identity</label>
              <input
                className="w-full border border-neon-cyan/30 bg-black/50 text-white rounded px-4 py-2 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none transition-all placeholder-gray-600 font-mono"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="USER.ID"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-neon-cyan/80 mb-1 tracking-wider">Passcode</label>
              <input
                className="w-full border border-neon-cyan/30 bg-black/50 text-white rounded px-4 py-2 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none transition-all placeholder-gray-600 font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-neon-pink text-sm border border-neon-pink/30 bg-neon-pink/10 p-2 rounded text-center">{error}</p>}

            <button
              className="w-full rounded bg-neon-cyan/10 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black font-cyber font-bold py-2 disabled:opacity-50 transition-all tracking-wider uppercase"
              disabled={busy}
            >
              {busy ? "VERIFYING..." : "ENTER SYSTEM"}
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-6 text-center font-mono">
            // DEBUG MODE: Credentials prefilled.
          </p>

          <p className="text-sm text-gray-400 mt-4 text-center">
            New User?{" "}
            <Link to="/signup" className="text-neon-pink hover:text-white font-medium transition-colors">
              Initialize Profile
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

