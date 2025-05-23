const jwt = require('jsonwebtoken');
const { get } = require('../database');

// Middleware to authenticate JWT tokens
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', err.message);
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    try {
      // Verify user still exists in database
      const user = await get('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
      
      if (!user) {
        return res.status(403).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      // Add user info to request
      req.user = {
        userId: user.id,
        email: user.email
      };

      next();
    } catch (dbError) {
      console.error('Database error during authentication:', dbError);
      return res.status(500).json({ 
        success: false, 
        error: 'Authentication failed' 
      });
    }
  });
}

// Optional middleware for admin-only routes
async function requireAdmin(req, res, next) {
  try {
    const { userId } = req.user;
    
    // Check if user is admin (you can customize this logic)
    const adminEmail = process.env.ADMIN_EMAIL;
    const user = await get('SELECT email FROM users WHERE id = ?', [userId]);
    
    if (!user || user.email !== adminEmail) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authorization failed' 
    });
  }
}

// Middleware for optional authentication (user info if present, but not required)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continue without user info
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return next(); // Invalid token, continue without user info
    }

    try {
      const user = await get('SELECT id, email FROM users WHERE id = ?', [decoded.userId]);
      
      if (user) {
        req.user = {
          userId: user.id,
          email: user.email
        };
      }
    } catch (dbError) {
      console.error('Database error during optional auth:', dbError);
      // Continue without user info
    }

    next();
  });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
}; 