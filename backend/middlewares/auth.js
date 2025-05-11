const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // For development, bypass authentication
  if (process.env.NODE_ENV === 'development') {
    // Add a mock user for development
    req.user = {
      id: 'mock-user-id',
      name: 'Test User',
      email: 'test@example.com',
      role: 'instructor'
    };
    return next();
  }

  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};