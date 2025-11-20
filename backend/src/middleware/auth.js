const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = verifyToken(token);
    
    // Get user from database to ensure they still exist and get latest data
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    // Add user info to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Token verification failed.',
    });
  }
};

/**
 * Middleware to authorize specific roles
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: roles,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is owner
 */
const isOwner = authorize('owner');

/**
 * Middleware to check if user is owner or employee
 */
const isOwnerOrEmployee = authorize('owner', 'employee');

/**
 * Middleware to check if user is owner, employee, or vendor
 */
const isOwnerEmployeeOrVendor = authorize('owner', 'employee', 'vendor');

/**
 * Middleware to check if user is authenticated (any role)
 */
const isAuthenticated = authenticate;

module.exports = {
  authenticate,
  authorize,
  isOwner,
  isOwnerOrEmployee,
  isOwnerEmployeeOrVendor,
  isAuthenticated,
};
