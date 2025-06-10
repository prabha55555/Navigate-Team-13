// Instructor assessment routes for creating, updating, and managing assessments
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import services
const syllabusAnalyzerService = require('../services/syllabusAnalyzerService');
const plagiarismService = require('../services/plagiarismService');
const authMiddleware = require('../middlewares/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const fileExt = path.extname(file.originalname);
    cb(null, uniqueId + fileExt);
  }
});

const upload = multer({ storage: storage });

// @route   GET /templates/:courseId
// @desc    Get assessment templates (predefined or course-specific)
// @access  Private (Instructor only)
router.get('/templates/:courseId', authMiddleware, async (req, res) => {
  try {
    // In a real app, this would fetch from a database
    const templates = [
      {
        id: 'java-basics-quiz',
        name: 'Java Basics Quiz',
        description: 'A quick assessment covering Java fundamentals and syntax',
        questionTypes: ['multiple-choice', 'true-false'],
        defaultTimeLimit: 30,
        sampleQuestions: [
          {
            type: 'multiple-choice',
            stem: 'Which of the following is not a primitive data type in Java?',
            options: ['int', 'boolean', 'String', 'char'],
            correctAnswer: 'String'
          }
        ]
      },
      {
        id: 'java-data-structures-exam',
        name: 'Java Data Structures Exam',
        description: 'A comprehensive exam covering Java collections framework and data structures implementation',
        questionTypes: ['multiple-choice', 'short-answer', 'essay', 'programming'],
        defaultTimeLimit: 120,
        sampleQuestions: [
          {
            type: 'essay',
            stem: 'Compare and contrast ArrayList and LinkedList in Java. When would you choose one over the other?',
            wordLimit: 500
          }
        ]
      }
    ];
    
    res.json(templates);
  } catch (err) {
    console.error('Error fetching assessment templates:', err);
    res.status(500).json({ message: 'Server error fetching templates' });
  }
});

// @route   POST /create
// @desc    Create a new assessment
// @access  Private (Instructor only)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { title, description, courseId, courseName, timeLimit, questions, dueDate, randomizeQuestions } = req.body;
    
    // In a real app, this would save to a database
    // For demo purposes, we'll save to an environment variable
    const newAssessment = {
      id: 'instructor-assessment-' + Date.now(),
      title,
      description,
      courseId,
      courseName,
      timeLimit: timeLimit || 60,
      totalPoints: questions.reduce((sum, q) => sum + (q.points || 0), 0),
      dueDate,
      status: 'published',
      createdAt: new Date().toISOString(),
      randomizeQuestions: randomizeQuestions || false,
      questions
    };
    
    // Save assessment to environment variable for demo
    const savedAssessmentsString = process.env.SAVED_ASSESSMENTS || '[]';
    let savedAssessments = [];
    
    try {
      savedAssessments = JSON.parse(savedAssessmentsString);
    } catch (parseErr) {
      console.error('Error parsing saved assessments:', parseErr);
      savedAssessments = [];
    }
    
    // Add new assessment
    savedAssessments.push(newAssessment);
    
    // Save back to environment variable
    process.env.SAVED_ASSESSMENTS = JSON.stringify(savedAssessments);
    
    console.log(`New assessment created: "${title}" (ID: ${newAssessment.id}) with ${questions.length} questions`);
    
    res.status(201).json(newAssessment);
  } catch (err) {
    console.error('Error creating assessment:', err);
    res.status(500).json({ message: 'Server error creating assessment' });
  }
});

// @route   GET /course/:courseId/submissions
// @desc    Get all student submissions for a specific course's assessments
// @access  Private (Instructor only)
router.get('/course/:courseId/submissions', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log('=== INSTRUCTOR FETCHING COURSE SUBMISSIONS ===');
    console.log('Course ID:', courseId);
    console.log('Instructor ID:', req.user.id);
    
    // Check if user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view course submissions'
      });
    }
    
    // Get all submissions from environment variable
    let allSubmissions = [];
    try {
      if (process.env.STUDENT_SUBMISSIONS) {
        allSubmissions = JSON.parse(process.env.STUDENT_SUBMISSIONS);
        console.log(`Found ${allSubmissions.length} total submissions in system`);
      }
    } catch (e) {
      console.error('Error parsing submissions:', e);
      allSubmissions = [];
    }
    
    // Filter submissions for the specific course
    const courseSubmissions = allSubmissions.filter(submission => 
      submission.courseId === courseId || submission.courseId === courseId.toString()
    );
    
    console.log(`Found ${courseSubmissions.length} submissions for course ${courseId}`);
    
    // Transform submissions for instructor view with pass/fail status
    const instructorSubmissions = courseSubmissions.map(submission => ({
      id: submission.id,
      submissionId: submission.id,
      studentId: submission.studentId,
      studentName: submission.studentName || 'Unknown Student',
      assessmentId: submission.assessmentId,
      assessmentTitle: submission.assessmentTitle || 'Assessment',
      courseId: submission.courseId,
      courseName: submission.courseName || 'Course',
      score: submission.score,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      isPassed: submission.isPassed,
      status: submission.isPassed ? 'Passed' : 'Failed',
      gradingStatus: 'completed',
      submittedAt: submission.submittedAt,
      submissionDate: submission.submittedAt,
      timeSpent: submission.timeSpent,
      timeTaken: submission.timeSpent,
      feedbackProvided: true,
      attempts: 1,
      improvement: 0 // Could be calculated based on previous attempts
    }));
    
    res.json({
      success: true,
      submissions: instructorSubmissions,
      count: instructorSubmissions.length
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching submissions' 
    });
  }
});

// @route   POST /analyze-syllabus
// @desc    Analyze a syllabus to extract assessment opportunities
// @access  Private (Instructor only)
router.post('/analyze-syllabus', authMiddleware, upload.single('syllabus'), async (req, res) => {
  try {
    const syllabusFile = req.file;
    
    if (!syllabusFile) {
      return res.status(400).json({ message: 'No syllabus file uploaded' });
    }
    
    // Get file path
    const filePath = syllabusFile.path;
    
    // Invoke the syllabus analyzer service
    const analysisResults = await syllabusAnalyzerService.analyzeSyllabus(filePath);
    
    // Delete file after analysis
    fs.unlinkSync(filePath);
    
    res.json({
      message: 'Syllabus analysis complete',
      results: analysisResults
    });
  } catch (err) {
    console.error('Error analyzing syllabus:', err);
    res.status(500).json({ message: 'Server error analyzing syllabus' });
  }
});

// @route   POST /check-plagiarism
// @desc    Check student submissions for plagiarism
// @access  Private (Instructor only)
router.post('/check-plagiarism', authMiddleware, async (req, res) => {
  try {
    const { assessmentId, submissionIds } = req.body;
    
    if (!assessmentId || !submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ message: 'Invalid request parameters' });
    }
    
    // Invoke the plagiarism service
    const plagiarismResults = await plagiarismService.checkPlagiarism(assessmentId, submissionIds);
    
    res.json({
      message: 'Plagiarism check complete',
      results: plagiarismResults
    });
  } catch (err) {
    console.error('Error checking plagiarism:', err);
    res.status(500).json({ message: 'Server error checking plagiarism' });
  }
});

module.exports = router;
