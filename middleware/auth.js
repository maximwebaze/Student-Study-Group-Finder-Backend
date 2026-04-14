import jwt from 'jsonwebtoken';

// ── Verify any authenticated user ──────────────────────────
export function authenticate(req, res, next) {
  // Expect header: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ message: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1]; // extract the token part

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// ── Verify admin role only ──────────────────────────────────
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
}
