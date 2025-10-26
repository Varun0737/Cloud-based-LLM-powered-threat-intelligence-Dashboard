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
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Banner Section */}
      <div className="bg-gradient-to-r from-blue-700 via-purple-700 to-indigo-700 py-6 text-center shadow-lg">
        <h1 className="text-3xl font-bold tracking-wide text-white">
          🛡️ Threat Intelligence Dashboard
        </h1>
        <p className="text-sm text-gray-200 mt-1">
          Secure • Analyze • Defend
        </p>
      </div>

      {/* Login Section */}
      <main className="flex-1 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-700">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            Sign In
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <input
              className="w-full border border-gray-600 bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
            <input
              className="w-full border border-gray-600 bg-gray-700 text-white rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 disabled:opacity-60 transition-colors"
              disabled={busy}
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-3 text-center">
            Demo credentials are prefilled for testing.
          </p>

          <p className="text-sm text-gray-400 mt-4 text-center">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

