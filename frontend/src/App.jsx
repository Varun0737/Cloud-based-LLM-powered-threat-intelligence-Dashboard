import VisualDashboard from "./pages/VisualDashboard.jsx";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/login.jsx";
import SearchDashboard from "./pages/SearchDashboard.jsx";
import AiAskDashboard from "./pages/AIaskDashboard.jsx";
import Signup from "./pages/signup";
import RecentCVEs from "./pages/RecentCVEs";
import StoredCVEs from "./pages/StoredCVEs";
import CVEDetails from "./pages/CVEDetails";
import GlobalThreatMap from "./pages/GlobalThreatMap";
import CyberEffects from "./components/CyberEffects";

function Nav() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  return (
    <header className="sticky top-0 z-40 bg-cyber-black/80 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-cyber font-bold tracking-widest text-neon-cyan drop-shadow-[0_0_5px_rgba(0,243,255,0.5)]">
          THREAT::INTEL
        </Link>
        <nav className="ml-auto flex items-center gap-3">
          {token ? (
            <button
              className="text-xs uppercase tracking-wider border border-white/20 px-4 py-1.5 rounded hover:bg-neon-pink hover:border-transparent hover:text-black transition-colors"
              onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}
            >
              Logout / Exit
            </button>
          ) : (
            <Link to="/login" className="text-xs uppercase tracking-wider border border-white/20 px-4 py-1.5 rounded hover:bg-neon-cyan hover:border-transparent hover:text-black transition-colors">
              Initialize
            </Link>
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
    <div className="min-h-screen bg-cyber-black text-gray-100 font-tech selection:bg-neon-cyan selection:text-black">
      <CyberEffects />
      <div className="fixed inset-0 z-0 bg-cyber-grid bg-[length:40px_40px] opacity-[0.15] pointer-events-none" />

      <div className="relative z-10">

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <Guard>
                <SearchDashboard />
              </Guard>
            }
          />
          <Route path="/visuals" element={<Guard><VisualDashboard /></Guard>} />
          <Route path="/ask" element={<Guard><AiAskDashboard /></Guard>} />
          <Route path="/cve" element={<Guard><RecentCVEs /></Guard>} />
          <Route path="/cve/all" element={<Guard><StoredCVEs /></Guard>} />
          <Route path="/cve/details/:id" element={<Guard><CVEDetails /></Guard>} />
          <Route path="/map" element={<Guard><GlobalThreatMap /></Guard>} />
        </Routes>
      </div>
    </div>
  );
}
