const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import services
const syllabusAnalyzerService = require('../services/syllabusAnalyzerService');
const plagiarismService = require('../services/plagiarismService');
const assessmentStore = require('../services/assessmentStore');
const gradingService = require('../services/gradingService');
const { resolveUserName } = require('../services/userDirectory');
const authMiddleware = require('../middlewares/auth');

const requireInstructor = authMiddleware.requireRole('instructor');

// Upper bound on how long a submission waits for the AI plagiarism check
const PLAGIARISM_WAIT_MS = 8000;

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
router.post('/upload-syllabus', [authMiddleware, requireInstructor, uploadSyllabusFile], async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded'
      });
    }

    console.log(`Processing uploaded file: ${req.file.originalname}`);
    
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
    console.error('Error uploading syllabus:', error.message);
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
router.post('/analyze-syllabus', authMiddleware, requireInstructor, async (req, res) => {
  try {
    const { syllabusContent, courseId } = req.body;

    if (typeof syllabusContent !== 'string' || syllabusContent.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Syllabus content is too short for analysis'
      });
    }

    console.log(`Analyzing syllabus content (${syllabusContent.length} chars)...`);

    // Topic extraction and the full analysis are independent AI calls: run them
    // concurrently instead of back to back (halves the wait for the instructor).
    const topicsPromise = syllabusAnalyzerService.extractTopicsFromSyllabus(syllabusContent)
      .then(topicsExtraction => topicsExtraction.topics || [])
      .catch(topicError => {
        console.warn('Using fallback topic extraction:', topicError.message);
        // Simple fallback pattern extraction
        const topicsList = syllabusContent.match(/topics:[\s\S]*?((?:-|\d+\.)[^\n]+)/gi) || [];
        return topicsList
          .map(t => t.replace(/^(?:topics:|-|\d+\.)[\s]*/i, '').trim())
          .filter(t => t.length > 3)
          .slice(0, 10);
      });

    // Analyze the syllabus
    const [topicsResult, syllabusAnalysis] = await Promise.all([
      topicsPromise,
      syllabusAnalyzerService.analyzeSyllabus(syllabusContent)
    ]);
    let extractedTopics = topicsResult;
    
    // If no topics were extracted earlier, use the ones from syllabusAnalysis
    if (extractedTopics.length === 0 && 
        syllabusAnalysis.learningOutcomes && 
        Array.isArray(syllabusAnalysis.learningOutcomes.keyTopics)) {
      extractedTopics = syllabusAnalysis.learningOutcomes.keyTopics;
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
    console.error('Error analyzing syllabus:', error);
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
router.get('/syllabus/list', authMiddleware, async (req, res) => {
  try {
    // Get list of syllabi
    const syllabi = await syllabusAnalyzerService.getSyllabiList();

    res.status(200).json({
      success: true,
      syllabi
    });
  } catch (error) {
    console.error('Error retrieving syllabi list:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving syllabi list: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/syllabus/:id
// @desc    Get syllabus analysis by ID
// @access  Private
router.get('/syllabus/:id', authMiddleware, async (req, res) => {
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
    console.error('Error retrieving syllabus analysis:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving syllabus analysis: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/generate-questions
// @desc    Generate assessment questions based on syllabus analysis and pattern
// @access  Private
router.post('/generate-questions', authMiddleware, requireInstructor, async (req, res) => {
  try {
    const { syllabusAnalysis, pattern } = req.body;

    if (!syllabusAnalysis || typeof syllabusAnalysis !== 'object' || !pattern || typeof pattern !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Syllabus analysis and pattern are required'
      });
    }

    console.log(`Generating assessment with pattern: ${pattern.name}`);

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
    
    // Return the assessment
    res.status(200).json({
      success: true,
      message: 'Assessment generated successfully',
      assessment
    });
  } catch (error) {
    console.error('Error generating assessment:', error);
    res.status(500).json({
      success: false,
      message: `Error generating assessment: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/iterate-quiz
// @desc    Refine a generated quiz based on feedback
// @access  Private
router.post('/iterate-quiz', authMiddleware, requireInstructor, async (req, res) => {
  try {
    const { currentQuiz, feedback } = req.body;

    if (!currentQuiz || typeof currentQuiz !== 'object' || !Array.isArray(currentQuiz.questions) ||
        typeof feedback !== 'string' || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Current quiz and feedback are required'
      });
    }

    console.log(`Iterating quiz based on feedback: ${feedback.substring(0, 100)}...`);

    // For this demo, we'll just return the current quiz with a note
    // In a real implementation, you would send the feedback to the model and generate a new quiz
    const iteratedQuiz = {
      ...currentQuiz,
      title: `${currentQuiz.title} (Refined)`,
      description: `${currentQuiz.description}\n\nRefined based on feedback: ${feedback.substring(0, 50)}...`,
      generatedAt: new Date().toISOString(),
      questions: currentQuiz.questions.map(q => ({
        ...q,
        explanation: q.explanation || "This explanation was enhanced based on your feedback."
      }))
    };
    
    res.status(200).json({
      success: true,
      message: 'Quiz iterated successfully',
      iteratedQuiz
    });
  } catch (error) {
    console.error('Error iterating quiz:', error);
    res.status(500).json({
      success: false,
      message: `Error iterating quiz: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/templates/:courseId
// @desc    Get assessment templates (predefined or course-specific)
// @access  Private
router.get('/templates/:courseId', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // If courseId is provided and not 'default', we could load course-specific templates
    // For now, return a set of predefined templates for all courses
    
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
    console.error('Error fetching assessment templates:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching templates: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/save
// @desc    Save assessment to database and optionally assign to students
// @access  Private (Instructor only)
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      courseId, 
      questions, 
      timeLimit, 
      totalPoints,
      assignToAllStudents,
      syllabusTitle,
      visibility
    } = req.body;
    
    // Check if user is an instructor
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can save assessments'
      });
    }

    if (!title || !courseId || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required assessment information'
      });
    }

    // Every question needs a unique id (answers are keyed by it) and a canonical type.
    const seenIds = new Set();
    const normalizedQuestions = questions
      .filter(q => q && typeof q === 'object')
      .map((q, i) => {
        let qid = q.id !== undefined && q.id !== null && q.id !== '' ? String(q.id) : (q._id ? String(q._id) : '');
        if (!qid || seenIds.has(qid)) {
          qid = `q${i + 1}`;
          while (seenIds.has(qid)) qid = `${qid}-${i + 1}`;
        }
        seenIds.add(qid);
        return { ...q, id: qid, questionType: gradingService.normalizeQuestionType(q.questionType || q.type) };
      });

    // The frontend re-saves an assessment with the same client id to publish it or
    // change its visibility. Update in place instead of piling up duplicates
    // (the old copy stayed visible after "hiding" it).
    const requestedId = typeof req.body.id === 'string' && /^[\w.-]{1,100}$/.test(req.body.id) ? req.body.id : null;
    const existing = requestedId ? assessmentStore.findAssessment(requestedId) : null;
    const canUpdateExisting = existing && (String(existing.createdBy) === String(req.user.id) || req.user.role === 'admin');
    const assessmentId = canUpdateExisting || (requestedId && !existing)
      ? requestedId
      : `assessment-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const assign = assignToAllStudents === true;
    const dueDate = req.body.dueDate && !isNaN(new Date(req.body.dueDate).getTime())
      ? new Date(req.body.dueDate).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

    // Create assessment document
    const assessment = {
      id: assessmentId,
      title,
      description,
      courseId,
      courseName: req.body.courseName || 'Data Structures and Algorithms in Java', // In real app, fetch from course table
      questions: normalizedQuestions,
      timeLimit: timeLimit || 60,
      totalPoints: totalPoints || normalizedQuestions.reduce((sum, q) => sum + (Number(q.points) || 0), 0),
      createdBy: canUpdateExisting ? existing.createdBy : req.user.id,
      createdAt: canUpdateExisting ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate,
      assignToAllStudents: assign,
      syllabusTitle: syllabusTitle || '',
      pattern: req.body.pattern || null,
      // Explicit flags from the client win (used by publish / hide-from-students);
      // otherwise they follow assignToAllStudents as before.
      status: ['published', 'draft'].includes(req.body.status) ? req.body.status : (assign ? 'published' : 'draft'),
      isPublished: typeof req.body.isPublished === 'boolean' ? req.body.isPublished : assign,
      visibleToStudents: typeof req.body.visibleToStudents === 'boolean' ? req.body.visibleToStudents : assign,
      visibility: visibility || {
        instructorCanSeeAnswers: true,
        studentsCanSeeAnswers: false,
        studentsCanSeeSyllabusTitle: false
      }
    };

    if (canUpdateExisting) {
      // Replace the stored object's contents so existing references see the update
      Object.keys(existing).forEach(key => delete existing[key]);
      Object.assign(existing, assessment);
    } else {
      assessmentStore.addAssessment(assessment);
    }

    console.log(`Assessment ${canUpdateExisting ? 'updated' : 'saved'} with ID: ${assessmentId}`);
    console.log(`Assigned to all students: ${assign}`);
    console.log(`Total saved assessments: ${assessmentStore.getAssessments().length}`);
    
    // If assignToAllStudents is true, we would also create assignments for all students in the course
    const assignmentStatus = assessment.assignToAllStudents 
      ? 'Assessment assigned to all students in the course' 
      : 'Assessment saved as draft';
    
    res.status(200).json({
      success: true,
      message: `Assessment saved successfully. ${assignmentStatus}`,
      assessmentId: assessmentId,
      assessment
    });
  } catch (error) {
    console.error('Error saving assessment:', error);
    res.status(500).json({
      success: false,
      message: `Error saving assessment: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/student/upcoming
// @desc    Get upcoming assessments for a student
// @access  Private (Student only)
// NOTE: must be registered before /student/:assessmentId, which otherwise
// captured "upcoming" as an assessment id.
router.get('/student/upcoming', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching upcoming assessments for student...');

    const savedAssessments = assessmentStore.getAssessments();
    console.log(`Found ${savedAssessments.length} total saved assessments`);

    const studentAssessments = savedAssessments
      .filter(assessment => assessmentStore.isVisibleToStudents(assessment, req.user.id))
      .map(assessment => ({
        id: assessment.id,
        _id: assessment.id, // For compatibility
        title: assessment.title,
        description: assessment.description,
        courseId: assessment.courseId,
        courseName: assessment.courseName || 'Course',
        dueDate: assessment.dueDate,
        timeLimit: assessment.timeLimit,
        totalPoints: assessment.totalPoints,
        questionCount: assessment.questions?.length || 0,
        createdAt: assessment.createdAt,
        status: 'available',
        course: {
          _id: assessment.courseId,
          title: assessment.courseName || 'Course'
        }
      }));

    console.log(`Returning ${studentAssessments.length} assessments for student`);

    res.status(200).json({
      success: true,
      assessments: studentAssessments,
      count: studentAssessments.length
    });
  } catch (error) {
    console.error('Error fetching student assessments:', error);
    res.status(500).json({
      success: false,
      message: `Error fetching assessments: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/student/:assessmentId
// @desc    Get assessment for student (filtered to hide instructor-only content)
// @access  Private (Student only)
router.get('/student/:assessmentId', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    
    console.log(`Student requesting assessment: ${assessmentId}`);

    // Find the assessment
    const assessment = assessmentStore.findAssessment(assessmentId);

    if (!assessment) {
      // Used to answer 200 with a made-up mock assessment for ANY id, which then
      // failed on submit with "Assessment not found".
      console.log(`Assessment ${assessmentId} not found in saved assessments`);
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Check if assessment is available to students (same rule as /api/student/assessment)
    const isStaff = req.user.role === 'instructor' || req.user.role === 'admin';
    if (!isStaff && !assessmentStore.isVisibleToStudents(assessment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Assessment not available to students'
      });
    }
    
    // Create a filtered version that only shows what students should see
    const studentAssessment = {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      courseId: assessment.courseId,
      courseName: assessment.courseName,
      timeLimit: assessment.timeLimit,
      totalPoints: assessment.totalPoints,
      dueDate: assessment.dueDate,
      questions: (assessment.questions || []).map(q => ({
        id: q.id,
        question: q.question || q.text,
        questionType: gradingService.normalizeQuestionType(q.questionType || q.type),
        type: gradingService.normalizeQuestionType(q.questionType || q.type),
        text: q.question || q.text,
        options: q.options || [],
        points: q.points || 1
        // Note: correctAnswer is intentionally omitted for students
      }))
    };
    
    console.log(`Returning assessment "${studentAssessment.title}" with ${studentAssessment.questions.length} questions`);
    
    res.status(200).json({
      success: true,
      assessment: studentAssessment
    });
  } catch (error) {
    console.error('Error retrieving assessment for student:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving assessment: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/submit
// @desc    Submit a completed assessment
// @access  Private (Student only)
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { 
      assessmentId, 
      answers, 
      timeSpent 
    } = req.body;
    
    console.log('=== ASSESSMENT SUBMISSION (main route) ===');
    console.log('Student ID:', req.user.id);
    console.log('Assessment ID:', assessmentId);
    console.log('Answers:', answers);
    
    if (!assessmentId || !answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing required submission information'
      });
    }
    
    const assessment = assessmentStore.findAssessment(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const isStaff = req.user.role === 'instructor' || req.user.role === 'admin';
    if (!isStaff && !assessmentStore.isVisibleToStudents(assessment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'This assessment is not available for submission'
      });
    }

    // Score with the shared grader (same rules as /api/student/assessment/submit)
    const grade = gradingService.gradeSubmission(assessment, answers);
    const { score, maxScore, percentage, isPassed, questionResults, detailedAnswers } = grade;

    grade.questionResults.forEach(result => {
      console.log(`Question ${result.questionId}: ${result.score}/${result.maxScore} points`);
    });

    // Create submission record
    const submission = {
      id: `submission-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      courseId: assessment.courseId,
      courseName: assessment.courseName,
      studentId: req.user.id,
      studentName: await resolveUserName(req.user),
      answers,
      timeSpent: timeSpent || 0,
      score,
      maxScore,
      percentage,
      isPassed,
      status: 'completed',
      gradingStatus: 'completed',
      submittedAt: new Date().toISOString(),
      questionResults,
      detailedAnswers
    };

    console.log(`Creating submission: score ${score}/${maxScore}, ${questionResults.length} questions processed`);

    // Generate AI feedback and recommendations
    const { aiFeedback, personalizedRecommendations } = gradingService.buildFeedback(grade, assessment.questions);
    submission.aiFeedback = aiFeedback;
    submission.personalizedRecommendations = personalizedRecommendations;
    submission.feedback = aiFeedback; // For backward compatibility

    // Run plagiarism detection for text-based answers, without letting slow AI
    // calls hold the request open; a late result is written onto the submission.
    try {
      submission.plagiarismResults = await plagiarismService.checkSubmissionBounded({
        submissionId: submission.id,
        studentId: req.user.id,
        assessmentId: assessment.id,
        answers: detailedAnswers,
        assessmentDetails: assessment
      }, {
        timeoutMs: PLAGIARISM_WAIT_MS,
        onLateResult: (lateResult) => { submission.plagiarismResults = lateResult; }
      });
      if (submission.plagiarismResults) {
        console.log('Plagiarism check:', submission.plagiarismResults.status === 'pending'
          ? 'PENDING' : (submission.plagiarismResults.isPlagiarismDetected ? 'FLAGGED' : 'CLEAN'));
      }
    } catch (plagiarismError) {
      console.warn('Plagiarism check failed:', plagiarismError.message);
      submission.plagiarismResults = {
        isPlagiarismDetected: false,
        overallSimilarityScore: 0,
        error: plagiarismError.message
      };
    }

    // Store submission (in production, save to database)
    assessmentStore.addSubmission(submission);

    console.log(`Assessment submitted successfully. Score: ${score}/${maxScore}`);

    res.status(200).json({
      success: true,
      message: 'Assessment submitted successfully',
      submissionId: submission.id,
      score: submission.score,
      maxScore: submission.maxScore,
      percentage,
      isPassed
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: `Error submitting assessment: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/results/:submissionId
// @desc    Get assessment submission results
// @access  Private (Owner student or instructor)
router.get('/results/:submissionId', authMiddleware, async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    console.log(`Fetching results for submission ID: ${submissionId}`);
    
    // Find the requested submission
    const submission = assessmentStore.findSubmission(submissionId);

    if (!submission) {
      console.log(`Submission ${submissionId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check if user is authorized to view this submission
    // (either the student who submitted it or an instructor of the course)
    const isOwner = String(req.user.id) === String(submission.studentId);
    const isInstructor = req.user.role === 'instructor' || req.user.role === 'admin';

    if (!isOwner && !isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this submission'
      });
    }

    console.log(`Found submission for student ${submission.studentId}: score ${submission.score}/${submission.maxScore}`);

    // Get the assessment details to include in the response
    const assessmentDetails = assessmentStore.findAssessment(submission.assessmentId) || null;

    // Students may only see the answer key when the instructor allowed it.
    // (The old check `studentsCanSeeAnswers || showResultsImmediately !== false`
    // was true for every assessment, so the setting never took effect.)
    const visibility = assessmentDetails && assessmentDetails.visibility;
    const hideAnswers = !isInstructor && !!visibility && visibility.studentsCanSeeAnswers === false;
    const stripAnswerText = (text) =>
      typeof text === 'string' ? text.replace(/\s*The correct answer (is|was):[\s\S]*$/, '') : text;

    // The results page reads question.text / question.type; stored questions may
    // only have question / questionType, so provide both spellings.
    const questions = (assessmentDetails && Array.isArray(assessmentDetails.questions) ? assessmentDetails.questions : [])
      .map(q => {
        const type = gradingService.normalizeQuestionType(q.questionType || q.type);
        const view = {
          ...q,
          text: q.text || q.question,
          question: q.question || q.text,
          type,
          questionType: type,
          options: q.options || []
        };
        if (hideAnswers) {
          delete view.correctAnswer;
          delete view.sampleAnswer;
          delete view.rubric;
        }
        return view;
      });

    const maxScore = submission.maxScore || 0;
    const percentage = submission.percentage !== undefined
      ? submission.percentage
      : (maxScore > 0 ? Math.round((submission.score / maxScore) * 100) : 0);

    // Enhance submission with assessment details
    const visibleSubmission = {
      ...submission,
      percentage,
      isPassed: submission.isPassed !== undefined
        ? submission.isPassed
        : (maxScore > 0 && (submission.score / maxScore) * 100 >= gradingService.PASS_THRESHOLD),
      assessment: assessmentDetails ? {
        id: assessmentDetails.id || assessmentDetails._id,
        title: assessmentDetails.title,
        courseId: assessmentDetails.courseId,
        courseName: assessmentDetails.courseName,
        description: assessmentDetails.description,
        timeLimit: assessmentDetails.timeLimit,
        questions
      } : {
        title: submission.assessmentTitle || 'Assessment',
        courseId: submission.courseId || 'unknown',
        courseName: submission.courseName || 'Unknown Course',
        questions: [] // the results page reads assessment.questions.length
      }
    };

    if (hideAnswers) {
      if (Array.isArray(visibleSubmission.questionResults)) {
        visibleSubmission.questionResults = visibleSubmission.questionResults.map(r => ({ ...r, feedback: stripAnswerText(r.feedback) }));
      }
      ['aiFeedback', 'feedback'].forEach(key => {
        const fb = visibleSubmission[key];
        if (fb && typeof fb === 'object' && fb.questionFeedback && typeof fb.questionFeedback === 'object') {
          const questionFeedback = {};
          Object.entries(fb.questionFeedback).forEach(([qid, text]) => { questionFeedback[qid] = stripAnswerText(text); });
          visibleSubmission[key] = { ...fb, questionFeedback };
        }
      });
    }

    console.log(`Returning submission results for ${submissionId}`);
    
    res.status(200).json({
      success: true,
      submission: visibleSubmission
    });
  } catch (error) {
    console.error('Error retrieving submission results:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving results: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/course/:courseId/submissions
// @desc    Get all submissions for a course
// @access  Private (Instructor only)
// Also mounted by server.js at GET /api/instructor/course/:courseId/submissions,
// the URL the instructor results page calls.
async function getCourseSubmissions(req, res) {
  try {
    const { courseId } = req.params;

    // Check if user is an instructor
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view all course submissions'
      });
    }

    // Real submissions from the store (this used to return two hard-coded mock rows)
    const submissions = assessmentStore.listCourseSubmissions(courseId);

    res.status(200).json({
      success: true,
      submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('Error retrieving course submissions:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving submissions: ${error.message}`
    });
  }
}
router.get('/course/:courseId/submissions', authMiddleware, getCourseSubmissions);

// (GET /student/upcoming is registered above /student/:assessmentId.)
// Feedback helpers now live in services/gradingService.js, shared with the
// student submission route.

router.getCourseSubmissions = getCourseSubmissions;

module.exports = router;