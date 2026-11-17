const mongoose = require('mongoose');

/**
 * Resolve a display name for the authenticated user. JWTs only carry
 * { id, role }, so req.user.name was always undefined and every submission was
 * recorded as "Student". Looks the user up when the DB is connected and the id
 * is a real ObjectId (test/mock ids such as 'test-student-id' would otherwise
 * throw a CastError).
 * @param {Object} user - req.user
 * @param {string} fallback - name to use when the lookup is not possible
 * @returns {Promise<string>}
 */
async function resolveUserName(user, fallback = 'Student') {
  if (!user) return fallback;
  if (user.name) return user.name;
  try {
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(user.id)) {
      const User = mongoose.models.User || require('../models/User');
      const doc = await User.findById(user.id).select('name').lean().maxTimeMS(2000);
      if (doc && doc.name) return doc.name;
    }
  } catch (error) {
    console.warn('Could not resolve user name:', error.message);
  }
  return fallback;
}

module.exports = { resolveUserName };
