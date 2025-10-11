import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import SearchDashboard from "./pages/SearchDashboard.jsx";

function Nav() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-semibold">Threat Intel Dashboard</Link>
        <nav className="ml-auto flex items-center gap-3">
          {token ? (
            <button
              className="text-sm border px-3 py-1 rounded"
              onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}
            >
              Logout
            </button>
          ) : (
            <Link to="/login" className="text-sm border px-3 py-1 rounded">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Guard({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guard><SearchDashboard /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

