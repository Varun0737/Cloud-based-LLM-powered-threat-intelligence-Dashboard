// api-server/src/requireRole.js
export function requireRole(roles = []) {
  return (req, res, next) => {
    try {
      const user = req.user; // set by requireAuth
      if (!user) return res.status(401).json({ error: "Unauthenticated" });
      const has = (user.roles || []).some(r => roles.includes(r));
      if (!has) return res.status(403).json({ error: "Forbidden" });
      next();
    } catch (e) {
      next(e);
    }
  };
}

