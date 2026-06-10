/**
 * Admin Middleware
 * Checks if authenticated user has admin role
 * Must be used after authMiddleware
 */

const adminMiddleware = (req, res, next) => {
  try {
    // Check if user exists (should be set by authMiddleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user is admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();

  } catch (error) {
    console.error('Admin Middleware Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authorization.'
    });
  }
};

module.exports = adminMiddleware;
