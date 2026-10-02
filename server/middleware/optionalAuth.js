const JWT = require('jsonwebtoken');

// Attaches req.user when a valid token is present, but never blocks the request.
const optionalAuth = (req, _res, next) => {
  try {
    let token = req.cookies?.token || null;
    if (!token) {
      const h = req.headers.authorization;
      if (h && h.startsWith('Bearer ')) token = h.substring(7);
    }
    if (token && process.env.JWT_SECRET) {
      const payload = JWT.verify(token, process.env.JWT_SECRET);
      req.user = {
        _id: payload.id,
        id: payload.id,
        email: payload.email,
        isAdmin: payload.isAdmin,
        name: payload.name,
      };
    }
  } catch (_) {
    // invalid/expired token -> treat as guest
  }
  next();
};

module.exports = optionalAuth;
