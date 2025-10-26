import { useState, useEffect } from "react";

export default function ProfileMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Load user info from localStorage (decoded after login/signup)
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const userData = JSON.parse(atob(token.split(".")[1])); // Decode JWT
      setUser(userData);
    } catch {
      console.warn("User not logged in or invalid token");
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div className="relative">
      {/* Profile Button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors border border-gray-700"
      >
        <img
          src={`https://ui-avatars.com/api/?name=${user?.email?.[0] || "U"}&background=4f46e5&color=fff`}
          alt="avatar"
          className="w-8 h-8 rounded-full border border-gray-600"
        />
        <span className="text-sm text-gray-200">{user?.email || "User"}</span>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
          <div className="px-4 py-2 text-sm text-gray-300 border-b border-gray-700">
            <p className="font-semibold">{user?.email}</p>
            <p className="text-xs text-gray-400">
              {user?.roles?.join(", ") || "user"}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-b-lg"
          >
            🚪 Logout
          </button>
        </div>
      )}
    </div>
  );
}

