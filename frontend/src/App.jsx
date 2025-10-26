import VisualDashboard from "./pages/VisualDashboard.jsx";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import SearchDashboard from "./pages/SearchDashboard.jsx";
import AiAskDashboard from "./pages/AiAskDashboard.jsx";
import Signup from "./pages/Signup";
import RecentCVEs from "./pages/RecentCVEs";
import GlobalThreatMap from "./pages/GlobalThreatMap";

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
        <Route path="/ask" element={<AiAskDashboard />} />
        <Route path="/visuals" element={<Guard><VisualDashboard /></Guard>} />
        <Route path="/" element={<Guard><SearchDashboard /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/map" element={<GlobalThreatMap />} />
        <Route path="/cve" element={<RecentCVEs />} />
      </Routes>
    </div>
  );
}

