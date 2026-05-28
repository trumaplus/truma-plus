const jwt = require('jsonwebtoken');

// ── Basic token verification ───────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Role guards ────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function requireSynagogue(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'synagogue') {
      return res.status(403).json({ error: 'Synagogue access required' });
    }
    next();
  });
}

function requireAdminOrSynagogue(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'synagogue') {
      return res.status(403).json({ error: 'Authentication required' });
    }
    next();
  });
}

/**
 * requireOwnerOrAdmin(getIdFromReq)
 *
 * Middleware factory that enforces resource ownership:
 *   - Admin → always allowed
 *   - Synagogue → allowed only if JWT synagogueId === getIdFromReq(req)
 *
 * IMPORTANT: for synagogue role, the synagogueId is taken ONLY from the JWT,
 * never from req.body or req.params, so it cannot be spoofed by the client.
 *
 * Usage:
 *   router.put('/:id', requireOwnerOrAdmin((req) => req.params.id), handler)
 */
function requireOwnerOrAdmin(getIdFromReq) {
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (req.user.role === 'admin') return next();

      if (req.user.role === 'synagogue') {
        const resourceId = getIdFromReq(req);
        // synagogueId from JWT is the only source of truth
        if (!resourceId || req.user.synagogueId !== resourceId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        return next();
      }

      return res.status(403).json({ error: 'Access denied' });
    });
  };
}

module.exports = {
  authenticate,
  requireAdmin,
  requireSynagogue,
  requireAdminOrSynagogue,
  requireOwnerOrAdmin,
};
