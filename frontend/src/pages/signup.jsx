import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/api/auth/signup", { email, password, name });
      // backend returns { token, user: { id, email, name } }
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user || {}));
      navigate("/"); // go to dashboard
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-cyber-black text-gray-100 flex items-center justify-center p-6 relative font-tech">
      <div className="absolute inset-0 z-0 bg-cyber-grid bg-[length:40px_40px] opacity-[0.2]"></div>

      <div className="relative z-10 w-full max-w-md bg-cyber-gray/40 border border-neon-cyan/30 rounded-lg p-8 shadow-2xl backdrop-blur-md">
        <h1 className="text-2xl font-cyber text-center mb-6 text-neon-cyan drop-shadow-md">INITIALIZE PROFILE</h1>

        {error && (
          <div className="mb-4 text-sm text-neon-pink border-l-2 border-neon-pink pl-2 bg-neon-pink/5 p-1">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded bg-black/60 border border-gray-700 focus:outline-none focus:border-neon-cyan text-white font-mono"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded bg-black/60 border border-gray-700 focus:outline-none focus:border-neon-cyan text-white font-mono"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded bg-black/60 border border-gray-700 focus:outline-none focus:border-neon-cyan text-white font-mono"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-gray-400 mb-1">Confirm password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded bg-black/60 border border-gray-700 focus:outline-none focus:border-neon-cyan text-white font-mono"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_15px_rgba(0,243,255,0.4)] disabled:opacity-60 px-4 py-2 rounded font-cyber uppercase tracking-wider transition-all"
          >
            {loading ? "CREATING..." : "ESTABLISH ID"}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-6 text-center">
          Already established?{" "}
          <Link to="/login" className="text-neon-green hover:underline hover:text-white">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}

