const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Longer-lived refresh token
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || `${JWT_SECRET}_refresh`;

// Roles a user may pick for themselves at sign-up. 'admin' is never self-assignable.
const SELF_ASSIGNABLE_ROLES = ['student', 'instructor'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// Refresh tokens are verified statelessly (signature + expiry), so they survive
// server restarts. Only logged-out tokens are tracked, until they would expire anyway.
const revokedRefreshTokens = new Set();

const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
});

const issueTokens = (user) => {
  const payload = { user: { id: user._id, role: user.role } };
  return {
    token: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload)
  };
};

const dbUnavailable = () => mongoose.connection.readyState !== 1;

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const role = SELF_ASSIGNABLE_ROLES.includes(req.body.role) ? req.body.role : 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (dbUnavailable()) {
      return res.status(503).json({ message: 'Database is unavailable. Please try again shortly.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const newUser = new User({ name, email, password, role }); // password hashed by pre-save hook
    await newUser.save();

    res.status(201).json({ ...issueTokens(newUser), user: toPublicUser(newUser) });
  } catch (err) {
    // Two simultaneous sign-ups with the same email hit the unique index.
    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (dbUnavailable()) {
      return res.status(503).json({ message: 'Database is unavailable. Please try again shortly.' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    res.json({ ...issueTokens(user), user: toPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/auth/refresh-token
// @desc    Get new access token using refresh token
// @access  Public
router.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token is required' });
  }
  if (revokedRefreshTokens.has(refreshToken)) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    res.json({ token: generateAccessToken({ user: decoded.user }) });
  } catch (err) {
    res.status(403).json({ message: 'Invalid refresh token' });
  }
});

// @route   POST api/auth/logout
// @desc    Logout user by invalidating refresh token
// @access  Public
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    revokedRefreshTokens.add(refreshToken);
    // Forget the token once it would have expired anyway, so the set stays small.
    const decoded = jwt.decode(refreshToken);
    if (decoded && decoded.exp) {
      const ttl = Math.max(0, decoded.exp * 1000 - Date.now());
      setTimeout(() => revokedRefreshTokens.delete(refreshToken), ttl).unref();
    }
  }
  res.json({ message: 'Logged out successfully' });
});

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', async (req, res) => {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token is not valid' });
  }

  try {
    if (dbUnavailable()) {
      return res.status(503).json({ message: 'Database is unavailable. Please try again shortly.' });
    }
    const user = await User.findById(decoded.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
