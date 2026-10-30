// server/middleware/auth.js
const crypto = require('crypto');
const store = require('../data/store');

// Active in-memory session tokens map (token -> { userId, expiresAt })
const tokenSessions = new Map();

function createSessionToken(userId) {
  const token = 'mai_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  tokenSessions.set(token, { userId, expiresAt });
  return token;
}

function revokeSessionToken(token) {
  if (token) {
    tokenSessions.delete(token);
  }
}

function resolveUserFromToken(token) {
  if (!token) return null;

  // Handle demo token prefix or standard session token
  let userId = null;
  if (token.startsWith('demo-token-')) {
    userId = token.replace('demo-token-', '');
  } else if (tokenSessions.has(token)) {
    const session = tokenSessions.get(token);
    if (Date.now() > session.expiresAt) {
      tokenSessions.delete(token);
      return null;
    }
    userId = session.userId;
  }

  if (!userId) return null;
  let user = store.find('users', u => u.id === userId);
  if (!user && token.startsWith('demo-token-')) {
    user = store.find('users', u => u.role === 'customer');
  }
  return user || null;
}

// Authentication Middleware: requires valid user
function requireAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.mai_token) {
    token = req.cookies.mai_token;
  }

  const user = resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required to access this resource.' 
    });
  }

  req.user = user;
  req.token = token;
  next();
}

// Optional Auth Middleware: attaches user if present, proceeds otherwise
function optionalAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.mai_token) {
    token = req.cookies.mai_token;
  }

  if (token) {
    req.user = resolveUserFromToken(token);
    req.token = token;
  }
  next();
}

// Customer Role Guard
function requireCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'This action is restricted to Customer / Project Owner accounts.' 
    });
  }
  next();
}

// Password hashing and verification
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

module.exports = {
  createSessionToken,
  revokeSessionToken,
  resolveUserFromToken,
  requireAuth,
  optionalAuth,
  requireCustomer,
  hashPassword,
  verifyPassword
};
