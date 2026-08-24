const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Unauthorized - Token not provided');
    err.statusCode = 401;
    return next(err);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, ... }
    next();
  } catch (error) {
    const err = new Error('Unauthorized - Invalid or expired token');
    err.statusCode = 401;
    next(err);
  }
};

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const err = new Error('Forbidden - Insufficient permissions');
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
};

module.exports = {
  authenticate,
  authorizeRole,
};
