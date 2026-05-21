const jwt = require('jsonwebtoken');

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

module.exports = { authenticate, requireAdmin, requireSynagogue, requireAdminOrSynagogue };
