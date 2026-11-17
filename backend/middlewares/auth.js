const jwt = require('jsonwebtoken');

// The x-test-mode header used to let ANY caller act as an instructor or student
// without a token. It is now only honoured when explicitly enabled for local
// test scripts (ALLOW_TEST_AUTH_BYPASS=true) and never in production.
const testBypassEnabled = () =>
  process.env.ALLOW_TEST_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

function authMiddleware(req, res, next) {
  // For testing purposes - bypass authentication with special header
  if (req.header('x-test-mode') === 'true' && testBypassEnabled()) {
    // Check if this is an instructor route by checking the URL or method
    const isInstructorRoute = req.url.includes('/save') || req.url.includes('/instructor') ||
                              req.method === 'POST' && req.url.includes('/assessment');

    req.user = {
      id: isInstructorRoute ? 'test-instructor-id' : 'test-student-id',
      role: isInstructorRoute ? 'instructor' : 'student',
      name: isInstructorRoute ? 'Test Instructor' : 'Test Student'
    };
    return next();
  }

  // Get token from header (x-auth-token is the app convention; a standard
  // "Authorization: Bearer <token>" header is accepted as well)
  let token = req.header('x-auth-token');
  if (!token) {
    const authHeader = req.header('authorization') || '';
    if (/^Bearer\s+/i.test(authHeader)) {
      token = authHeader.replace(/^Bearer\s+/i, '').trim();
    }
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  // A validly signed token without the expected payload used to set
  // req.user = undefined and crash later handlers with a 500.
  if (!decoded || !decoded.user || !decoded.user.id) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  req.user = decoded.user;
  next();
}

/**
 * Role guard to use after authMiddleware, e.g. router.post('/x', auth, auth.requireRole('instructor'), handler)
 * Admins are always allowed.
 */
authMiddleware.requireRole = (...roles) => (req, res, next) => {
  const role = req.user && req.user.role;
  if (role && (role === 'admin' || roles.includes(role))) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: `This action requires the ${roles.join(' or ')} role`
  });
};

module.exports = authMiddleware;
