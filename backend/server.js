require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./api/auth');
// Use assessment.js file for instructor assessment routes temporarily
const instructorAssessmentRoutes = require('./api/assessment');
const studentAssessmentRoutes = require('./api/student-assessment-routes');
const adaptiveLearningRoutes = require('./api/adaptiveLearning');
const curriculumRoutes = require('./api/curriculum');
const authMiddleware = require('./middlewares/auth');
const assessmentStore = require('./services/assessmentStore');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/instructor/assessment', instructorAssessmentRoutes); // Instructor assessment routes
app.use('/api/student/assessment', studentAssessmentRoutes);  // Student assessment routes
app.use('/api/assessment', instructorAssessmentRoutes); // Direct assessment route
app.use('/api/adaptive-learning', adaptiveLearningRoutes);
app.use('/api/curriculum', curriculumRoutes);

// URLs the frontend calls that previously had no route (404):
// /api/courses/enrolled and /api/courses/:id (served by the curriculum course handlers)
app.use('/api/courses', curriculumRoutes.coursesRouter);
// Instructor results page
app.get('/api/instructor/course/:courseId/submissions', authMiddleware, instructorAssessmentRoutes.getCourseSubmissions);
// Student dashboard "recent submissions"
app.get('/api/submissions/recent', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 50);
  const submissions = assessmentStore.getSubmissions()
    .filter(s => String(s.studentId) === String(req.user.id))
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
    .slice(0, limit)
    .map(s => ({
      _id: s.id,
      id: s.id,
      assessmentId: s.assessmentId,
      assessment: { _id: s.assessmentId, title: s.assessmentTitle || 'Assessment' },
      course: { _id: s.courseId, title: s.courseName || 'Course' },
      submittedAt: s.submittedAt,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.percentage,
      isPassed: s.isPassed
    }));
  res.json({ success: true, submissions });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Unknown API routes get a JSON 404 (instead of the SPA's index.html in production)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Connect to MongoDB
const MONGO_FALLBACK_URI = process.env.MONGO_URI_FALLBACK || 'mongodb://127.0.0.1:27017/navigate';
const MONGO_OPTIONS = { serverSelectionTimeoutMS: 5000 };

// Hide credentials when logging a connection string
const redactUri = (uri) => String(uri || '').replace(/\/\/[^@/]*@/, '//***@');

const connectDB = async () => {
  // useNewUrlParser / useUnifiedTopology are no-ops (and deprecated) in Mongoose 7
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
      console.log('MongoDB Connected...');
      return true;
    } catch (err) {
      console.warn(`WARNING: could not connect to MONGO_URI (${err.message}).`);
      console.warn(`Falling back to local MongoDB at ${redactUri(MONGO_FALLBACK_URI)} ...`);
      await mongoose.disconnect().catch(() => {});
    }
  } else {
    console.warn(`WARNING: MONGO_URI is not set; using local MongoDB at ${redactUri(MONGO_FALLBACK_URI)}`);
  }

  try {
    await mongoose.connect(MONGO_FALLBACK_URI, MONGO_OPTIONS);
    console.log(`MongoDB Connected (fallback: ${redactUri(MONGO_FALLBACK_URI)})...`);
    return true;
  } catch (err) {
    // Continue application execution instead of exiting
    // This allows the app to run even without a database connection
    console.error('MongoDB connection error:', err.message);
    console.log('Starting in demo mode with mock data (auth endpoints will return 503)...');
    await mongoose.disconnect().catch(() => {});
    return false;
  }
};

// Load the demo assessment into the in-memory store before serving requests.
// (It used to be written into process.env.SAVED_ASSESSMENTS only after the DB
// connection attempt finished, which could overwrite assessments saved meanwhile.)
const seededAssessments = assessmentStore.seedMockAssessments();
if (seededAssessments.length > 0) {
  console.log('Mock instructor assessment loaded for testing');
}

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
  });
}

// JSON error handler (malformed JSON bodies, oversized payloads, unexpected errors)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('Unhandled route error:', err);
  }
  res.status(status).json({
    success: false,
    message: err.type === 'entity.parse.failed'
      ? 'Malformed JSON in request body'
      : (status >= 500 ? 'Server error' : err.message)
  });
});

// Log instead of crashing the whole API on a stray rejected promise
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

// Connect to database
connectDB();

// Define PORT
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Log the mock assessments that are available
  const mockAssessments = assessmentStore.getAssessments();
  if (mockAssessments.length > 0) {
    console.log('=========================================');
    console.log('AVAILABLE INSTRUCTOR-CREATED ASSESSMENTS:');
    mockAssessments.forEach(assessment => {
      console.log(`- "${assessment.title}" (ID: ${assessment.id}) with ${assessment.questions.length} questions`);
    });
    console.log('=========================================');
  }
});
