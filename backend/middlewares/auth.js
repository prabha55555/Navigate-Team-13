const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
<<<<<<< HEAD
  // For testing purposes - bypass authentication with special header
  if (req.header('x-test-mode') === 'true') {
    // Check if this is an instructor route by checking the URL or method
    const isInstructorRoute = req.url.includes('/save') || req.url.includes('/instructor') || 
                              req.method === 'POST' && req.url.includes('/assessment');
    
    req.user = {
      id: isInstructorRoute ? 'test-instructor-id' : 'test-student-id',
      role: isInstructorRoute ? 'instructor' : 'student',
      name: isInstructorRoute ? 'Test Instructor' : 'Test Student'
=======
  // For development, bypass authentication
  if (process.env.NODE_ENV === 'development') {
    // Add a mock user for development
    req.user = {
      id: 'mock-user-id',
      name: 'Test User',
      email: 'test@example.com',
      role: 'instructor'
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
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