/**
 * AI authoring tools for staff: syllabus upload/analysis, question generation
 * and assessment templates. Assessments themselves live in /api/assessments.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const syllabusAnalyzerService = require('../services/syllabusAnalyzerService');
const gradingService = require('../services/gradingService');
const { extractTopicsFromText, cleanTopicList } = require('../../ai_services/assessment/topicExtractor');
const authMiddleware = require('../middlewares/auth');
const access = require('../services/access');
const { canonicalTopic } = require('../services/topics');
const { aiLimiter } = require('../middlewares/rateLimits');
const { meterAi } = require('../services/plans');
const logger = require('../utils/logger');

// AI tools: staff only, rate limited per user; calls that reach the AI model
// also consume one of the workspace's monthly AI generations (402 when used up).
const staffOnly = [authMiddleware.requireAuth, authMiddleware.requireRole(...authMiddleware.STAFF_ROLES)];
const aiTool = [...staffOnly, aiLimiter];
const meteredAiTool = [...aiTool, meterAi];

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
    // Generate a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter to accept only certain types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB size limit
});

// Run multer and turn its errors (bad file type, too large, wrong field name)
// into JSON 400s instead of Express's default HTML 500 page.
const uploadSyllabusFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError
      ? (err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Maximum size is 10MB.' : `Upload error: ${err.message}`)
      : err.message;
    return res.status(400).json({ success: false, message });
  });
};

// @route   POST /api/assessment/upload-syllabus
// @desc    Upload and process syllabus
// @access  Private
router.post('/upload-syllabus', [...aiTool, uploadSyllabusFile], async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Extract text content from file
    const syllabusContent = await syllabusAnalyzerService.extractTextFromFile(req.file);

    // Return the extracted content
    res.status(200).json({
      success: true,
      message: 'File uploaded and processed successfully',
      syllabusContent,
      fileName: req.file.originalname
    });
  } catch (error) {
    logger.warn('ai.upload_syllabus_failed', { err: error });
    // Unreadable/corrupt documents are a client problem, not a server fault
    res.status(422).json({
      success: false,
      message: `Error processing file: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/analyze-syllabus
// @desc    Analyze syllabus content
// @access  Private
router.post('/analyze-syllabus', meteredAiTool, async (req, res) => {
  try {
    const { syllabusContent } = req.body;

    if (typeof syllabusContent !== 'string' || syllabusContent.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Syllabus content is too short for analysis'
      });
    }

    // Topic extraction and the full analysis are independent AI calls: run them
    // concurrently instead of back to back (halves the wait for the instructor).
    const topicsPromise = syllabusAnalyzerService.extractTopicsFromSyllabus(syllabusContent)
      .then(topicsExtraction => cleanTopicList(topicsExtraction.topics))
      .catch(topicError => {
        logger.info('ai.topic_extraction_fallback', { reason: topicError.message });
        return [];
      });

    // Analyze the syllabus
    const [topicsResult, syllabusAnalysis] = await Promise.all([
      topicsPromise,
      syllabusAnalyzerService.analyzeSyllabus(syllabusContent)
    ]);
    // AI topics first, then the analysis' key topics, then the syllabus text itself;
    // every source is split into single topics, de-numbered and de-duplicated.
    let extractedTopics = topicsResult;
    if (extractedTopics.length === 0) {
      extractedTopics = cleanTopicList(syllabusAnalysis.learningOutcomes && syllabusAnalysis.learningOutcomes.keyTopics);
    }
    if (extractedTopics.length === 0) {
      extractedTopics = extractTopicsFromText(syllabusContent);
    }

    // Generate an ID for this analysis
    const analysisId = crypto.createHash('md5').update(syllabusContent).digest('hex').substring(0, 8);

    // Store the analysis
    await syllabusAnalyzerService.storeSyllabusAnalysis(analysisId, syllabusAnalysis);

    // Return the analysis with topics array for flexible topic selection
    res.status(200).json({
      success: true,
      message: 'Syllabus analyzed successfully',
      syllabusAnalysis,
      analysisId,
      syllabusTopics: extractedTopics // Only include actual extracted topics
    });
  } catch (error) {
    logger.error('ai.analyze_syllabus_failed', { err: error });
    res.status(500).json({
      success: false,
      message: `Error analyzing syllabus: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/syllabus/list
// @desc    Get list of analyzed syllabi
// @access  Private
// NOTE: must be registered before /syllabus/:id, otherwise "list" is captured as an id.
router.get('/syllabus/list', staffOnly, async (req, res) => {
  try {
    // Get list of syllabi
    const syllabi = await syllabusAnalyzerService.getSyllabiList();

    res.status(200).json({
      success: true,
      syllabi
    });
  } catch (error) {
    logger.error('ai.syllabus_list_failed', { err: error });
    res.status(500).json({
      success: false,
      message: `Error retrieving syllabi list: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/syllabus/:id
// @desc    Get syllabus analysis by ID
// @access  Private
router.get('/syllabus/:id', staffOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Retrieve the analysis
    const syllabusAnalysis = await syllabusAnalyzerService.getSyllabusAnalysis(id);

    if (!syllabusAnalysis) {
      return res.status(404).json({
        success: false,
        message: 'Syllabus analysis not found'
      });
    }

    res.status(200).json({
      success: true,
      syllabusAnalysis
    });
  } catch (error) {
    logger.error('ai.syllabus_get_failed', { err: error });
    res.status(500).json({
      success: false,
      message: `Error retrieving syllabus analysis: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/generate-questions
// @desc    Generate assessment questions based on syllabus analysis and pattern
// @access  Private
router.post('/generate-questions', meteredAiTool, async (req, res) => {
  try {
    const { syllabusAnalysis, pattern } = req.body;

    if (!syllabusAnalysis || typeof syllabusAnalysis !== 'object' || !pattern || typeof pattern !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Syllabus analysis and pattern are required'
      });
    }

    // Check if this is a quick quiz or a full assessment
    let assessment;

    if (pattern.isQuickQuiz) {
      const structure = Array.isArray(pattern.structure) ? pattern.structure : [];
      const questionCount = structure.reduce((sum, item) => sum + (parseInt(item && item.count, 10) || 0), 0);
      // Generate a quick quiz
      assessment = await syllabusAnalyzerService.generateQuickQuiz(syllabusAnalysis, {
        questionCount: questionCount > 0 ? questionCount : undefined,
        difficulty: pattern.difficulty,
        questionTypes: structure
          .map(item => gradingService.normalizeQuestionType(item && (item.questionType || item.type)))
          .filter(Boolean),
        topicFocus: Array.isArray(pattern.topicFocus) ? pattern.topicFocus : undefined,
        timeLimit: pattern.estimatedTime || pattern.timeLimit
      });
    } else {
      // Generate a full assessment. The model layer maps missing, retired or
      // non-Gemini model names to the configured Gemini model (this used to
      // default to 'gpt2', which always 404ed and fell through to the slow fallback).
      assessment = await syllabusAnalyzerService.generateAssessment(syllabusAnalysis, {
        pattern: pattern,
        modelName: pattern.modelName
      });
    }

    // Generators emit question/questionType; also expose the text/type names used by /api/assessments.
    // With a courseId, topics are mapped to that course's canonical topics.
    const course = req.body.courseId
      ? await access.loadCourseForStaff(req, req.body.courseId).catch(() => null)
      : null;
    if (assessment && Array.isArray(assessment.questions)) {
      assessment.questions = assessment.questions.map(q => {
        const type = gradingService.normalizeQuestionType(q.type || q.questionType);
        const text = q.text || q.question || '';
        const topic = course ? canonicalTopic(q.topic, course.topics) : q.topic;
        return { ...q, text, question: text, type, questionType: type, topic };
      });
    }

    res.status(200).json({
      success: true,
      message: 'Assessment generated successfully',
      assessment
    });
  } catch (error) {
    logger.error('ai.generate_questions_failed', { err: error });
    res.status(500).json({
      success: false,
      message: `Error generating assessment: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/templates/:courseId
// @desc    Get assessment templates (predefined or course-specific)
// @access  Private
router.get('/templates/:courseId', staffOnly, async (req, res) => {
  try {
    // The same predefined templates for every course (the :courseId segment is kept for API compatibility).

    const templates = [
      {
        name: "Standard Quiz",
        description: "A balanced assessment with multiple choice and short answer questions",
        difficulty: "Medium",
        timeLimit: 30,
        questionDistribution: [
          { type: "multiple-choice", count: 10, pointsEach: 1 },
          { type: "short-answer", count: 5, pointsEach: 2 }
        ],
        totalPoints: 20,
        isRecommended: true
      },
      {
        name: "Comprehensive Exam",
        description: "In-depth assessment covering all major topics with varied question types",
        difficulty: "Hard",
        timeLimit: 90,
        questionDistribution: [
          { type: "multiple-choice", count: 15, pointsEach: 1 },
          { type: "true-false", count: 10, pointsEach: 1 },
          { type: "short-answer", count: 5, pointsEach: 3 },
          { type: "essay", count: 2, pointsEach: 10 }
        ],
        totalPoints: 50,
        isRecommended: false
      },
      {
        name: "Quick Check",
        description: "Brief assessment to quickly gauge understanding of key concepts",
        difficulty: "Easy",
        timeLimit: 15,
        questionDistribution: [
          { type: "multiple-choice", count: 8, pointsEach: 1 },
          { type: "true-false", count: 7, pointsEach: 1 }
        ],
        totalPoints: 15,
        isRecommended: true
      },
      {
        name: "Conceptual Understanding",
        description: "Focus on deeper understanding with short answer and essay questions",
        difficulty: "Medium",
        timeLimit: 45,
        questionDistribution: [
          { type: "short-answer", count: 8, pointsEach: 2 },
          { type: "essay", count: 2, pointsEach: 7 }
        ],
        totalPoints: 30,
        isRecommended: false
      },
      {
        name: "Practical Application",
        description: "Assessment focused on applying concepts to real-world scenarios",
        difficulty: "Medium",
        timeLimit: 60,
        questionDistribution: [
          { type: "multiple-choice", count: 5, pointsEach: 1 },
          { type: "short-answer", count: 5, pointsEach: 2 },
          { type: "essay", count: 3, pointsEach: 5 }
        ],
        totalPoints: 25,
        isRecommended: true
      }
    ];

    // Return templates with success status
    res.status(200).json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('ai.templates_failed', { err: error });
    res.status(500).json({
      success: false,
      message: `Error fetching templates: ${error.message}`
    });
  }
});

module.exports = router;
