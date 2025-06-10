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

// @route   POST /api/assessment/upload-syllabus
// @desc    Upload and process syllabus
// @access  Private
router.post('/upload-syllabus', [authMiddleware, upload.single('file')], async (req, res) => {
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
    console.error('Error uploading syllabus:', error);
    res.status(500).json({
      success: false,
      message: `Error processing file: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/analyze-syllabus
// @desc    Analyze syllabus content
// @access  Private
router.post('/analyze-syllabus', authMiddleware, async (req, res) => {
  try {
    const { syllabusContent, courseId } = req.body;
    
    if (!syllabusContent || syllabusContent.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Syllabus content is too short for analysis'
      });
    }
    
    console.log(`Analyzing syllabus content (${syllabusContent.length} chars)...`);
    
    // Extract topics directly from syllabus content
    let extractedTopics = [];
    try {
      // Try to use the service if available
      const topicsExtraction = await syllabusAnalyzerService.extractTopicsFromSyllabus(syllabusContent);
      extractedTopics = topicsExtraction.topics || [];
    } catch (topicError) {
      console.warn('Using fallback topic extraction:', topicError.message);
      // Simple fallback pattern extraction
      const topicsList = syllabusContent.match(/topics:[\s\S]*?((?:-|\d+\.)[^\n]+)/gi) || [];
      extractedTopics = topicsList
        .map(t => t.replace(/^(?:topics:|-|\d+\.)[\s]*/i, '').trim())
        .filter(t => t.length > 3)
        .slice(0, 10);
    }
    
    // Analyze the syllabus
    const syllabusAnalysis = await syllabusAnalyzerService.analyzeSyllabus(syllabusContent);
    
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

// @route   GET /api/assessment/syllabus/list
// @desc    Get list of analyzed syllabi
// @access  Private
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

// @route   POST /api/assessment/generate-questions
// @desc    Generate assessment questions based on syllabus analysis and pattern
// @access  Private
router.post('/generate-questions', authMiddleware, async (req, res) => {
  try {
    const { syllabusAnalysis, pattern } = req.body;
    
    if (!syllabusAnalysis || !pattern) {
      return res.status(400).json({
        success: false,
        message: 'Syllabus analysis and pattern are required'
      });
    }
    
    console.log(`Generating assessment with pattern: ${pattern.name}`);
    
    // Check if this is a quick quiz or a full assessment
    let assessment;
    
    if (pattern.isQuickQuiz) {
      // Generate a quick quiz
      assessment = await syllabusAnalyzerService.generateQuickQuiz(syllabusAnalysis, {
        questionCount: pattern.structure.reduce((sum, item) => sum + item.count, 0),
        difficulty: pattern.difficulty,
        questionTypes: pattern.structure.map(item => item.questionType.toLowerCase().replace(/\s+/g, '-')),
        timeLimit: pattern.estimatedTime
      });
    } else {
      // Generate a full assessment
      assessment = await syllabusAnalyzerService.generateAssessment(syllabusAnalysis, {
        pattern: pattern,
        modelName: pattern.modelName || 'gpt2' // Use GPT-2 by default
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
router.post('/iterate-quiz', authMiddleware, async (req, res) => {
  try {
    const { syllabusId, currentQuiz, feedback, parameters } = req.body;
    
    if (!currentQuiz || !feedback) {
      return res.status(400).json({
        success: false,
        message: 'Current quiz and feedback are required'
      });
    }
    
    console.log(`Iterating quiz based on feedback: ${feedback.substring(0, 100)}...`);
    
    // Get the syllabus analysis if we have an ID
    let syllabusAnalysis = null;
    if (syllabusId) {
      syllabusAnalysis = await syllabusAnalyzerService.getSyllabusAnalysis(syllabusId);
    }
    
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
    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can save assessments'
      });
    }
    
    if (!title || !courseId || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required assessment information'
      });
    }
    
    // Generate a unique assessment ID
    const assessmentId = `assessment-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create assessment document
    const assessment = {
      id: assessmentId,
      title,
      description,
      courseId,
      courseName: 'Data Structures and Algorithms in Java', // In real app, fetch from course table
      questions,
      timeLimit: timeLimit || 60,
      totalPoints: totalPoints || questions.reduce((sum, q) => sum + (q.points || 0), 0),
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      assignToAllStudents: assignToAllStudents || false,
      syllabusTitle: syllabusTitle || '',
      status: assignToAllStudents ? 'published' : 'draft',
      isPublished: assignToAllStudents || false,
      visibleToStudents: assignToAllStudents || false,
      visibility: visibility || {
        instructorCanSeeAnswers: true,
        studentsCanSeeAnswers: false,
        studentsCanSeeSyllabusTitle: false
      }
    };
    
    // Store the assessment in environment variable for mock persistence
    let savedAssessments = [];
    try {
      if (process.env.SAVED_ASSESSMENTS) {
        savedAssessments = JSON.parse(process.env.SAVED_ASSESSMENTS);
      }
    } catch (e) {
      console.warn('Error parsing existing saved assessments:', e);
      savedAssessments = [];
    }
    
    // Add the new assessment
    savedAssessments.push(assessment);
    
    // Update the environment variable
    process.env.SAVED_ASSESSMENTS = JSON.stringify(savedAssessments);
    
    console.log(`Assessment saved with ID: ${assessmentId}`);
    console.log(`Assigned to all students: ${assignToAllStudents}`);
    console.log(`Total saved assessments: ${savedAssessments.length}`);
    
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

// @route   GET /api/assessment/student/:assessmentId
// @desc    Get assessment for student (filtered to hide instructor-only content)
// @access  Private (Student only)
router.get('/student/:assessmentId', authMiddleware, async (req, res) => {
  try {
    const { assessmentId } = req.params;
    
    console.log(`Student requesting assessment: ${assessmentId}`);
    
    // Get all saved assessments from environment variable
    let savedAssessments = [];
    try {
      if (process.env.SAVED_ASSESSMENTS) {
        savedAssessments = JSON.parse(process.env.SAVED_ASSESSMENTS);
      }
    } catch (e) {
      console.warn('Error parsing saved assessments:', e);
      savedAssessments = [];
    }
    
    // Find the assessment
    const assessment = savedAssessments.find(a => a.id === assessmentId);
    
    if (!assessment) {
      console.log(`Assessment ${assessmentId} not found in saved assessments`);
      // Fallback to mock assessment for testing
      const mockAssessment = {
        id: assessmentId,
        title: 'Java Data Structures Assessment',
        description: 'Test your knowledge on Java data structures implementation and concepts',
        courseId: '1',
        courseName: 'Data Structures and Algorithms in Java',
        timeLimit: 60,
        totalPoints: 100,
        dueDate: '2025-12-10',
        questions: [
          {
            id: '1',
            text: 'Which Java collection interface is implemented by ArrayList and LinkedList?',
            type: 'multiple-choice',
            options: ['Set', 'List', 'Queue', 'Map'],
            points: 5
          },
          {
            id: '2',
            text: 'In Java, which data structure would be most appropriate for implementing a FIFO (First In First Out) queue?',
            type: 'multiple-choice',
            options: ['java.util.Stack', 'java.util.LinkedList', 'java.util.TreeSet', 'java.util.HashMap'],
            points: 5
          },
          {
            id: '3',
            text: 'What is the time complexity of the add() operation in a Java ArrayList when the internal array does not need resizing?',
            type: 'multiple-choice',
            options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
            points: 5
          },
          {
            id: '8',
            text: 'Explain the concept of hashing in Java collections and how collision resolution is handled in HashMap.',
            type: 'short-answer',
            points: 15
          }
        ]
      };
      
      return res.status(200).json({
        success: true,
        assessment: mockAssessment
      });
    }
    
    // Check if assessment is available to students
    if (!assessment.assignToAllStudents || !assessment.visibleToStudents) {
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
      questions: assessment.questions.map(q => ({
        id: q.id,
        question: q.question || q.text,
        questionType: q.questionType || q.type,
        type: q.questionType || q.type,
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
    
    // Get all saved assessments
    let savedAssessments = [];
    try {
      if (process.env.SAVED_ASSESSMENTS) {
        savedAssessments = JSON.parse(process.env.SAVED_ASSESSMENTS);
      }
    } catch (e) {
      console.warn('Error parsing saved assessments:', e);
    }
    
    const assessment = savedAssessments.find(a => a.id === assessmentId);
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }
      // Calculate score with improved validation
    let score = 0;
    let maxScore = 0;
    const questionResults = [];
    const detailedAnswers = [];
    
    assessment.questions.forEach(question => {
      const questionId = question.id;
      const studentAnswer = answers[questionId];
      const correctAnswer = question.correctAnswer;
      const points = question.points || 1;
      
      maxScore += points;
      
      let isCorrect = false;
      let partialCredit = 0;
      let feedback = '';
      
      console.log(`Validating Question ${questionId}: student="${studentAnswer}", correct="${correctAnswer}"`);
      
      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        const questionType = question.questionType || question.type;
        
        if (questionType === 'multiple-choice') {
          isCorrect = studentAnswer === correctAnswer;
          feedback = isCorrect ? 'Correct answer!' : `Incorrect. The correct answer is: ${correctAnswer}`;
        } else if (questionType === 'true-false') {
          isCorrect = String(studentAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
          feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer}`;
        } else if (questionType === 'multiple-select') {
          if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
            const studentSet = new Set(studentAnswer);
            const correctSet = new Set(correctAnswer);
            isCorrect = studentSet.size === correctSet.size && 
                       [...studentSet].every(x => correctSet.has(x));
            feedback = isCorrect ? 'All correct selections!' : 'Some selections were incorrect.';
          }        } else if (questionType === 'short-answer') {
          const answerText = typeof studentAnswer === 'string' ? studentAnswer.trim() : String(studentAnswer);
          const answerLength = answerText.length;
          if (answerLength >= 50) {
            partialCredit = points; // Full credit for detailed answers
            isCorrect = true;
            feedback = 'Good detailed answer!';
          } else if (answerLength >= 20) {
            partialCredit = Math.ceil(points * 0.7); // 70% credit
            feedback = 'Good answer, but could be more detailed.';
          } else if (answerLength >= 10) {
            partialCredit = Math.ceil(points * 0.5); // 50% credit
            feedback = 'Brief answer provided, needs more detail.';
          } else {
            feedback = 'Answer too brief. Please provide more details.';
          }
        }
      } else {
        feedback = 'No answer provided.';
      }
      
      const earnedPoints = isCorrect ? points : partialCredit;
      score += earnedPoints;
      
      console.log(`Question ${questionId}: ${earnedPoints}/${points} points`);
      
      questionResults.push({
        questionId,
        correct: isCorrect,
        score: earnedPoints,
        maxScore: points,
        studentAnswer,
        feedback,
        partialCredit: partialCredit > 0 && !isCorrect
      });
      
      // Store detailed answer for plagiarism checking
      detailedAnswers.push({
        questionId,
        answer: studentAnswer,
        questionText: question.question || question.text,
        questionType: question.questionType || question.type
      });
    });
      // Create submission record
    const submission = {
      id: `submission-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      assessmentId,
      studentId: req.user.id,
      answers,
      timeSpent: timeSpent || 0,
      score,
      maxScore,
      submittedAt: new Date().toISOString(),
      questionResults,
      detailedAnswers
    };

    console.log(`Creating submission: score ${score}/${maxScore}, ${questionResults.length} questions processed`);

    // Run plagiarism detection for text-based answers
    let plagiarismResults = null;
    try {
      const textAnswers = detailedAnswers.filter(a => 
        a.answer && 
        typeof a.answer === 'string' && 
        a.answer.trim().length > 30 &&
        (a.questionType === 'short-answer' || a.questionType === 'essay')
      );

      if (textAnswers.length > 0) {
        console.log(`Running plagiarism check on ${textAnswers.length} text answers...`);
        
        plagiarismResults = await plagiarismService.checkSubmission({
          submissionId: submission.id,
          studentId: req.user.id,
          assessmentId,
          answers: textAnswers,
          assessmentDetails: assessment
        });
        
        console.log('Plagiarism check completed:', plagiarismResults?.isPlagiarismDetected ? 'FLAGGED' : 'CLEAN');
      }
    } catch (plagiarismError) {
      console.warn('Plagiarism check failed:', plagiarismError.message);
      plagiarismResults = {
        isPlagiarismDetected: false,
        overallSimilarityScore: 0,
        error: plagiarismError.message
      };
    }

    // Generate AI feedback and recommendations
    let aiFeedback = null;
    let personalizedRecommendations = null;
    
    try {
      console.log('Generating AI feedback and recommendations...');
      
      // Generate overall feedback based on performance
      const percentage = Math.round((score / maxScore) * 100);
      
      aiFeedback = {
        overallFeedback: generateOverallFeedback(percentage, questionResults),
        questionFeedback: questionResults.reduce((feedback, result) => {
          if (result.feedback) {
            feedback[result.questionId] = result.feedback;
          }
          return feedback;
        }, {}),
        strengths: identifyStrengths(questionResults, assessment.questions),
        weaknesses: identifyWeaknesses(questionResults, assessment.questions),
        studyRecommendations: generateStudyRecommendations(questionResults, assessment.questions)
      };

      // Generate personalized learning recommendations
      personalizedRecommendations = generatePersonalizedRecommendations(
        questionResults, 
        assessment.questions, 
        percentage
      );
      
      console.log('AI feedback and recommendations generated successfully');
      
    } catch (feedbackError) {
      console.warn('AI feedback generation failed:', feedbackError.message);
      aiFeedback = {
        overallFeedback: `You scored ${score}/${maxScore} points (${Math.round((score/maxScore)*100)}%). Keep practicing to improve your understanding.`,
        questionFeedback: {},
        error: feedbackError.message
      };
    }

    // Add results to submission
    submission.plagiarismResults = plagiarismResults;
    submission.aiFeedback = aiFeedback;
    submission.personalizedRecommendations = personalizedRecommendations;
    submission.feedback = aiFeedback; // For backward compatibility
    
    // Store submission (in production, save to database)
    let submissions = [];
    try {
      if (process.env.STUDENT_SUBMISSIONS) {
        submissions = JSON.parse(process.env.STUDENT_SUBMISSIONS);
      }
    } catch (e) {
      submissions = [];
    }
    
    submissions.push(submission);
    process.env.STUDENT_SUBMISSIONS = JSON.stringify(submissions);
    
    console.log(`Assessment submitted successfully. Score: ${score}/${maxScore}`);
    
    res.status(200).json({
      success: true,
      message: 'Assessment submitted successfully',
      submissionId: submission.id,
      score: submission.score,
      maxScore: submission.maxScore,
      percentage: Math.round((score / maxScore) * 100)
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({
      success: false,
      message: `Error submitting assessment: ${error.message}`
    });
  }
});

// @route   POST /api/assessment/submit-with-ai-eval
// @desc    Submit assessment and initiate AI evaluation
// @access  Private (Student only)
router.post('/submit-with-ai-eval', authMiddleware, async (req, res) => {
  try {
    const { 
      assessmentId, 
      answers, 
      timeSpent 
    } = req.body;
    
    if (!assessmentId || !answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing required submission information'
      });
    }
    
    // In a real implementation, you would:
    // 1. Validate the assessmentId exists and is available to the student
    // 2. Save the submission to the database
    
    // Get assessment settings
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }
    
    // Create submission document
    const submission = new Submission({
      assessmentId,
      studentId: req.user.id,
      answers,
      timeSpent,
      submittedAt: new Date(),
      aiEvaluation: {
        status: 'pending'
      }
    });
    
    // Save submission
    const savedSubmission = await submission.save();
    
    // Start AI evaluation process
    // This would be handled by a queue in a production environment
    if (assessment.aiEvaluationSettings && assessment.aiEvaluationSettings.enablePlagiarismDetection) {
      // Start plagiarism detection asynchronously
      startPlagiarismDetection(savedSubmission, assessment);
    }
    
    if (assessment.aiEvaluationSettings && assessment.aiEvaluationSettings.enableLLMEvaluation) {
      // Start LLM evaluation asynchronously
      startLLMEvaluation(savedSubmission, assessment);
    }
    
    if (assessment.aiEvaluationSettings && assessment.aiEvaluationSettings.enableExpertPanelFeedback) {
      // Start expert panel feedback asynchronously
      startExpertPanelFeedback(savedSubmission, assessment);
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Assessment submitted successfully. AI evaluation in progress.',
      submissionId: savedSubmission._id,
      evaluationStatus: 'started'
    });
  } catch (error) {
    console.error('Error submitting assessment with AI evaluation:', error);
    res.status(500).json({
      success: false,
      message: `Error submitting assessment: ${error.message}`
    });
  }
});

// @route   GET /api/assessment/evaluation-status/:submissionId
// @desc    Check status of AI evaluation
// @access  Private (Student/Instructor)
router.get('/evaluation-status/:submissionId', authMiddleware, async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    // Get submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    // Check authorization (student owns submission or instructor owns course)
    if (submission.studentId.toString() !== req.user.id && req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this submission'
      });
    }
    
    // Return evaluation status
    res.status(200).json({
      success: true,
      evaluationStatus: submission.aiEvaluation.status,
      submission: submission
    });
  } catch (error) {
    console.error('Error checking evaluation status:', error);
    res.status(500).json({
      success: false,
      message: `Error checking evaluation status: ${error.message}`
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
    
    // Get stored submissions from environment variable
    let submissions = [];
    try {
      if (process.env.STUDENT_SUBMISSIONS) {
        submissions = JSON.parse(process.env.STUDENT_SUBMISSIONS);
        console.log(`Found ${submissions.length} total submissions in storage`);
      }
    } catch (e) {
      console.error('Error parsing stored submissions:', e);
      submissions = [];
    }
    
    // Find the requested submission
    const submission = submissions.find(s => s.id === submissionId);
    
    if (!submission) {
      console.log(`Submission ${submissionId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    
    console.log(`Found submission for student ${submission.studentId}: score ${submission.score}/${submission.maxScore}`);
    
    // Get the assessment details to include in the response
    let assessmentDetails = null;
    try {
      if (process.env.SAVED_ASSESSMENTS) {
        const savedAssessments = JSON.parse(process.env.SAVED_ASSESSMENTS);
        assessmentDetails = savedAssessments.find(a => 
          a.id === submission.assessmentId || a._id === submission.assessmentId
        );
      }
    } catch (e) {
      console.warn('Error loading assessment details:', e);
    }
    
    // Enhance submission with assessment details
    const enhancedSubmission = {
      ...submission,
      assessment: assessmentDetails ? {
        id: assessmentDetails.id || assessmentDetails._id,
        title: assessmentDetails.title,
        courseId: assessmentDetails.courseId,
        courseName: assessmentDetails.courseName,
        description: assessmentDetails.description,
        timeLimit: assessmentDetails.timeLimit,
        questions: assessmentDetails.questions
      } : {
        title: 'Assessment',
        courseId: 'unknown',
        courseName: 'Unknown Course'
      }
    };    
    // Check if user is authorized to view this submission
    // (either the student who submitted it or an instructor of the course)
    const isOwner = req.user.id === submission.studentId;
    const isInstructor = req.user.role === 'instructor';
    
    if (!isOwner && !isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this submission'
      });
    }
    
    // Apply visibility rules based on user role
    let visibleSubmission = { ...enhancedSubmission };
    
    // If student, maybe hide certain information based on assessment settings
    if (!isInstructor && assessmentDetails) {
      // Check assessment visibility settings
      const showAnswers = assessmentDetails.visibility?.studentsCanSeeAnswers || 
                         assessmentDetails.visibility?.showResultsImmediately !== false;
      
      if (!showAnswers) {
        // Hide correct answers if not allowed
        if (visibleSubmission.assessment && visibleSubmission.assessment.questions) {
          visibleSubmission.assessment.questions = visibleSubmission.assessment.questions.map(q => ({
            ...q,
            correctAnswer: undefined
          }));
        }
      }
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
router.get('/course/:courseId/submissions', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Check if user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view all course submissions'
      });
    }
    
    // In a real implementation, you would fetch from database
    // For now, return mock data
    const submissions = [
      {
        id: '1',
        assessmentId: '1',
        assessmentTitle: 'Midterm Exam',
        studentId: '123',
        studentName: 'John Doe',
        score: 85,
        maxScore: 100,
        submittedAt: new Date().toISOString()
      },
      {
        id: '2',
        assessmentId: '1',
        assessmentTitle: 'Midterm Exam',
        studentId: '456',
        studentName: 'Jane Smith',
        score: 92,
        maxScore: 100,
        submittedAt: new Date().toISOString()
      }
    ];
    
    res.status(200).json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Error retrieving course submissions:', error);
    res.status(500).json({
      success: false,
      message: `Error retrieving submissions: ${error.message}`
    });
  }
});

<<<<<<< HEAD
// @route   GET /api/assessment/student/upcoming
// @desc    Get upcoming assessments for a student
// @access  Private (Student only)
router.get('/student/upcoming', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching upcoming assessments for student...');
    
    // Get all saved assessments from environment variable
    let savedAssessments = [];
    try {
      if (process.env.SAVED_ASSESSMENTS) {
        savedAssessments = JSON.parse(process.env.SAVED_ASSESSMENTS);
        console.log(`Found ${savedAssessments.length} total saved assessments`);
      }
    } catch (e) {
      console.warn('Error parsing saved assessments:', e);
      savedAssessments = [];
    }
    
    // Filter assessments that are:
    // 1. Published/assigned to all students
    // 2. Visible to students
    // 3. Not yet due (optional)
    const studentAssessments = savedAssessments
      .filter(assessment => {
        const isAssigned = assessment.assignToAllStudents === true;
        const isPublished = assessment.status === 'published' || assessment.isPublished === true;
        const isVisible = assessment.visibleToStudents === true;
        
        console.log(`Assessment ${assessment.id}: assigned=${isAssigned}, published=${isPublished}, visible=${isVisible}`);
        
        return isAssigned && (isPublished || isVisible);
      })
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

// Helper functions for feedback generation
function generateOverallFeedback(percentage, questionResults) {
  const correctCount = questionResults.filter(r => r.correct).length;
  const totalCount = questionResults.length;
  
  if (percentage >= 90) {
    return `Excellent work! You scored ${percentage}% (${correctCount}/${totalCount} questions correct). You demonstrate a strong understanding of the material. Keep up the great work and continue to challenge yourself with advanced topics.`;
  } else if (percentage >= 80) {
    return `Great job! You scored ${percentage}% (${correctCount}/${totalCount} questions correct). You have a good grasp of most concepts. Focus on the areas where you missed points to achieve even better results.`;
  } else if (percentage >= 70) {
    return `Good effort! You scored ${percentage}% (${correctCount}/${totalCount} questions correct). You understand many of the key concepts, but there's room for improvement. Review the areas where you lost points and practice more.`;
  } else if (percentage >= 60) {
    return `You scored ${percentage}% (${correctCount}/${totalCount} questions correct). You have a basic understanding, but need to strengthen your knowledge. Focus on studying the fundamental concepts and practice regularly.`;
  } else {
    return `You scored ${percentage}% (${correctCount}/${totalCount} questions correct). This indicates significant gaps in understanding. I recommend reviewing the course materials thoroughly and seeking additional help from your instructor or study groups.`;
  }
}

function identifyStrengths(questionResults, questions) {
  const strengths = [];
  const correctResults = questionResults.filter(r => r.correct);
  
  if (correctResults.length > 0) {
    const questionTypes = {};
    correctResults.forEach(result => {
      const question = questions.find(q => q.id === result.questionId);
      if (question) {
        const type = question.questionType || question.type;
        questionTypes[type] = (questionTypes[type] || 0) + 1;
      }
    });
    
    Object.entries(questionTypes).forEach(([type, count]) => {
      if (count >= 2) {
        strengths.push(`Strong performance in ${type.replace('-', ' ')} questions`);
      }
    });
    
    if (correctResults.length / questionResults.length > 0.8) {
      strengths.push('Consistent accuracy across different question types');
    }
  }
  
  return strengths.length > 0 ? strengths : ['Completion of the assessment shows engagement with the material'];
}

function identifyWeaknesses(questionResults, questions) {
  const weaknesses = [];
  const incorrectResults = questionResults.filter(r => !r.correct);
  
  if (incorrectResults.length > 0) {
    const questionTypes = {};
    incorrectResults.forEach(result => {
      const question = questions.find(q => q.id === result.questionId);
      if (question) {
        const type = question.questionType || question.type;
        questionTypes[type] = (questionTypes[type] || 0) + 1;
      }
    });
    
    Object.entries(questionTypes).forEach(([type, count]) => {
      if (count >= 2) {
        weaknesses.push(`Need improvement in ${type.replace('-', ' ')} questions`);
      }
    });
    
    // Check for unanswered questions
    const unanswered = questionResults.filter(r => !r.studentAnswer || r.studentAnswer === '');
    if (unanswered.length > 0) {
      weaknesses.push(`${unanswered.length} questions were left unanswered`);
    }
    
    // Check for very brief short answers
    const briefAnswers = questionResults.filter(r => {
      const question = questions.find(q => q.id === r.questionId);
      return question && 
             (question.questionType === 'short-answer' || question.type === 'short-answer') &&
             r.studentAnswer && 
             r.studentAnswer.length < 20;
    });
    
    if (briefAnswers.length > 0) {
      weaknesses.push('Short answers need more detail and explanation');
    }
  }
  
  return weaknesses;
}

function generateStudyRecommendations(questionResults, questions) {
  const recommendations = [];
  const incorrectResults = questionResults.filter(r => !r.correct);
  
  if (incorrectResults.length > 0) {
    recommendations.push('Review the course materials for topics you missed');
    recommendations.push('Practice with additional exercises in your weak areas');
    
    const hasShortAnswers = questions.some(q => 
      (q.questionType === 'short-answer' || q.type === 'short-answer')
    );
    
    if (hasShortAnswers) {
      recommendations.push('Practice writing detailed explanations for conceptual questions');
    }
    
    const hasMultipleChoice = questions.some(q => 
      (q.questionType === 'multiple-choice' || q.type === 'multiple-choice')
    );
    
    if (hasMultipleChoice) {
      recommendations.push('Study key definitions and factual knowledge');
    }
  }
  
  // Always add general recommendations
  recommendations.push('Form study groups to discuss difficult concepts');
  recommendations.push('Visit office hours if you need clarification on any topics');
  
  return recommendations;
}

function generatePersonalizedRecommendations(questionResults, questions, percentage) {
  const recommendations = {
    nextSteps: [],
    resources: [],
    practiceAreas: [],
    difficultyLevel: 'intermediate'
  };
  
  // Determine difficulty level for future content
  if (percentage >= 85) {
    recommendations.difficultyLevel = 'advanced';
    recommendations.nextSteps.push('You\'re ready for advanced topics and challenges');
    recommendations.nextSteps.push('Consider exploring additional optional materials');
  } else if (percentage >= 70) {
    recommendations.difficultyLevel = 'intermediate';
    recommendations.nextSteps.push('Continue with the regular course progression');
    recommendations.nextSteps.push('Focus on strengthening areas where you lost points');
  } else {
    recommendations.difficultyLevel = 'basic';
    recommendations.nextSteps.push('Review fundamental concepts before moving forward');
    recommendations.nextSteps.push('Consider additional tutoring or study sessions');
  }
  
  // Generate practice areas based on missed questions
  const missedTopics = new Set();
  questionResults.filter(r => !r.correct).forEach(result => {
    const question = questions.find(q => q.id === result.questionId);
    if (question && question.topic) {
      missedTopics.add(question.topic);
    }
  });
  
  recommendations.practiceAreas = Array.from(missedTopics);
  
  // Add general resources
  recommendations.resources = [
    'Course textbook and lecture notes',
    'Online practice problems',
    'Study groups and peer discussions',
    'Instructor office hours'
  ];
  
  if (percentage < 70) {
    recommendations.resources.push('Additional tutoring resources');
    recommendations.resources.push('Supplementary learning materials');
  }
  
  return recommendations;
=======
/**
 * Helper function to start plagiarism detection
 * @param {Object} submission - The submission document
 * @param {Object} assessment - The assessment document
 */
async function startPlagiarismDetection(submission, assessment) {
  try {
    // Get answers as a single text for analysis
    const answersText = Object.entries(submission.answers)
      .map(([questionId, answer]) => {
        const question = assessment.questions.find(q => q._id.toString() === questionId);
        if (!question) return '';
        
        if (typeof answer === 'string') {
          return answer;
        } else if (Array.isArray(answer)) {
          return answer.join('. ');
        } else if (typeof answer === 'boolean') {
          return answer ? 'True' : 'False';
        }
        return '';
      })
      .filter(text => text.length > 0)
      .join('\n\n');
    
    // Skip if no text to analyze
    if (answersText.length < 50) {
      submission.aiEvaluation.status = 'plagiarism-complete';
      submission.aiEvaluation.plagiarismResults = {
        score: 0,
        source: assessment.aiEvaluationSettings.plagiarismService,
        details: {
          message: 'Insufficient text for analysis'
        },
        isPlagiarized: false,
        timestamp: new Date()
      };
      await submission.save();
      return;
    }
    
    // Initialize plagiarism detection service
    const PlagiarismDetectionService = require('../services/PlagiarismDetectionService');
    const plagiarismService = new PlagiarismDetectionService();
    
    // Select service based on assessment settings
    let results;
    const service = assessment.aiEvaluationSettings.plagiarismService;
    
    switch (service) {
      case 'turnitin':
        results = await plagiarismService.detectWithTurnitin(answersText, {
          studentId: submission.studentId,
          courseId: assessment.courseId
        });
        break;
      case 'gptzero':
        results = await plagiarismService.detectWithGPTZero(answersText);
        break;
      case 'aws-comprehend':
        results = await plagiarismService.detectWithAWSComprehend(answersText);
        break;
      default:
        // Default to mock implementation for demo
        results = await plagiarismService.detectPlagiarismMock(answersText);
    }
    
    // Update submission with results
    submission.aiEvaluation.plagiarismResults = results;
    submission.aiEvaluation.status = 'plagiarism-complete';
    await submission.save();
    
    // If LLM evaluation is not enabled, mark as fully complete
    if (!assessment.aiEvaluationSettings.enableLLMEvaluation && 
        !assessment.aiEvaluationSettings.enableExpertPanelFeedback) {
      submission.aiEvaluation.status = 'fully-complete';
      await submission.save();
    }
  } catch (error) {
    console.error('Plagiarism detection error:', error);
    // Update submission with error status
    submission.aiEvaluation.plagiarismResults = {
      error: error.message,
      timestamp: new Date()
    };
    await submission.save();
  }
}

/**
 * Helper function to start LLM evaluation
 * @param {Object} submission - The submission document
 * @param {Object} assessment - The assessment document
 */
async function startLLMEvaluation(submission, assessment) {
  try {
    // Initialize LLM evaluation service
    const LLMEvaluationService = require('../services/LLMEvaluationService');
    const llmService = new LLMEvaluationService();
    
    // Process each answer separately
    const evaluationResults = {
      exactMatchScore: 0,
      semanticSimilarityScore: 0,
      reasoningCheckScore: 0,
      overallScore: 0,
      timestamp: new Date(),
      details: {
        exactMatch: { matchedPhrases: [] },
        semanticSimilarity: {},
        reasoning: { strengths: [], weaknesses: [], improvement: [] }
      }
    };
    
    // Get all questions and their model answers
    let totalPoints = 0;
    let scoredPoints = 0;
    
    for (const [questionId, answer] of Object.entries(submission.answers)) {
      const question = assessment.questions.find(q => q._id.toString() === questionId);
      if (!question) continue;
      
      // Skip multiple choice and true/false questions
      if (question.type === 'multiple-choice' || question.type === 'true-false') {
        // These are evaluated directly
        continue;
      }
      
      // Only evaluate text-based answers
      if (typeof answer === 'string' && answer.trim().length > 0) {
        const modelAnswer = question.correctAnswer;
        
        // Evaluate each component
        const exactMatchResults = await llmService.evaluateExactMatch(answer, modelAnswer);
        const semanticResults = await llmService.evaluateSemantic(answer, modelAnswer);
        const reasoningResults = await llmService.evaluateReasoning(answer, question);
        
        // Weight the scores according to assessment settings
        const exactWeight = assessment.aiEvaluationSettings.llmEvaluationWeights.exactMatch;
        const semanticWeight = assessment.aiEvaluationSettings.llmEvaluationWeights.semanticSimilarity;
        const reasoningWeight = assessment.aiEvaluationSettings.llmEvaluationWeights.reasoning;
        
        // Calculate weighted question score
        const questionScore = (
          exactMatchResults.score * exactWeight +
          semanticResults.score * semanticWeight +
          reasoningResults.score * reasoningWeight
        );
        
        // Accumulate scores
        scoredPoints += questionScore * question.points;
        totalPoints += question.points;
        
        // Collect feedback
        evaluationResults.details.exactMatch.matchedPhrases.push(...exactMatchResults.matchedPhrases);
        evaluationResults.details.reasoning.strengths.push(...reasoningResults.strengths);
        evaluationResults.details.reasoning.weaknesses.push(...reasoningResults.weaknesses);
      }
    }
    
    // Calculate overall scores
    if (totalPoints > 0) {
      evaluationResults.overallScore = Math.round((scoredPoints / totalPoints) * 100);
      
      // Simulate individual component scores for the prototype
      evaluationResults.exactMatchScore = Math.min(100, Math.round(evaluationResults.overallScore * (0.9 + Math.random() * 0.2)));
      evaluationResults.semanticSimilarityScore = Math.min(100, Math.round(evaluationResults.overallScore * (0.9 + Math.random() * 0.2)));
      evaluationResults.reasoningCheckScore = Math.min(100, Math.round(evaluationResults.overallScore * (0.9 + Math.random() * 0.2)));
    }
    
    // Add explanations
    evaluationResults.details.exactMatch.explanation = generateExactMatchExplanation(evaluationResults);
    evaluationResults.details.semanticSimilarity.explanation = generateSemanticExplanation(evaluationResults);
    evaluationResults.details.reasoning.improvement = generateImprovementSuggestions(evaluationResults);
    
    // Update submission with results
    submission.aiEvaluation.llmEvaluation = evaluationResults;
    submission.aiEvaluation.status = 'llm-complete';
    await submission.save();
    
    // If expert panel is not enabled, mark as fully complete
    if (!assessment.aiEvaluationSettings.enableExpertPanelFeedback) {
      submission.aiEvaluation.status = 'fully-complete';
      await submission.save();
    }
  } catch (error) {
    console.error('LLM evaluation error:', error);
    // Update submission with error status
    submission.aiEvaluation.llmEvaluation = {
      error: error.message,
      timestamp: new Date()
    };
    await submission.save();
  }
}

/**
 * Helper function to start expert panel feedback
 * @param {Object} submission - The submission document
 * @param {Object} assessment - The assessment document
 */
async function startExpertPanelFeedback(submission, assessment) {
  try {
    // Initialize expert panel service
    const ExpertPanelService = require('../services/ExpertPanelService');
    const expertService = new ExpertPanelService();
    
    // Get all answers and questions for comprehensive analysis
    const studentAnswers = [];
    const questionTexts = [];
    const modelAnswers = [];
    
    for (const [questionId, answer] of Object.entries(submission.answers)) {
      const question = assessment.questions.find(q => q._id.toString() === questionId);
      if (!question) continue;
      
      studentAnswers.push(typeof answer === 'string' ? answer : JSON.stringify(answer));
      questionTexts.push(question.text);
      modelAnswers.push(typeof question.correctAnswer === 'string' ? question.correctAnswer : JSON.stringify(question.correctAnswer));
    }
    
    // Configure expert panel feedback
    const assessmentConfig = {
      expertPanelFocus: {
        misconceptions: assessment.aiEvaluationSettings.expertPanelFocus.misconceptions,
        learningGaps: assessment.aiEvaluationSettings.expertPanelFocus.learningGaps,
        strengthAreas: assessment.aiEvaluationSettings.expertPanelFocus.strengthAreas,
        improvementSuggestions: assessment.aiEvaluationSettings.expertPanelFocus.improvementSuggestions
      }
    };
    
    // Use the enhanced aggregatedFeedback method for AI evaluation pipeline integration
    const aggregatedExpertFeedback = await expertService.aggregatedFeedback(
      studentAnswers,
      questionTexts,
      modelAnswers,
      assessmentConfig
    );
    
    // Update submission with comprehensive results
    submission.aiEvaluation.expertPanelFeedback = {
      ...aggregatedExpertFeedback,
      timestamp: new Date()
    };
    
    submission.aiEvaluation.status = 'fully-complete';
    await submission.save();
  } catch (error) {
    console.error('Expert panel feedback error:', error);
    // Update submission with error status
    submission.aiEvaluation.expertPanelFeedback = {
      error: error.message,
      timestamp: new Date()
    };
    submission.aiEvaluation.status = 'expert-complete'; // Mark as complete even with error
    await submission.save();
  }
}

/**
 * Generate explanation for exact match results
 * @param {Object} results - Evaluation results
 * @returns {string} - Explanation text
 */
function generateExactMatchExplanation(results) {
  const score = results.exactMatchScore;
  const phrases = results.details.exactMatch.matchedPhrases;
  
  if (score >= 90) {
    return `Your answers include most of the key concepts and terms expected. You correctly mentioned ${phrases.slice(0, 3).join(', ')}, and other important terminology.`;
  } else if (score >= 70) {
    return `Your answers include many key concepts and terms expected. You correctly mentioned ${phrases.slice(0, 2).join(', ')}, though some important terminology is missing.`;
  } else {
    return `Your answers are missing several key concepts and terms expected for this assessment. Try to incorporate more specific terminology related to the subject matter.`;
  }
}

/**
 * Generate explanation for semantic similarity results
 * @param {Object} results - Evaluation results
 * @returns {string} - Explanation text
 */
function generateSemanticExplanation(results) {
  const score = results.semanticSimilarityScore;
  
  if (score >= 90) {
    return `Your answers show excellent semantic similarity (${score.toFixed(1)}%) to the expected concepts. You've captured the key ideas and expressed them effectively.`;
  } else if (score >= 70) {
    return `Your answers show good semantic similarity (${score.toFixed(1)}%) to the expected concepts. You've captured many of the important ideas, though there's room for more precision.`;
  } else {
    return `Your answers show limited semantic similarity (${score.toFixed(1)}%) to the expected concepts. Try to focus more on aligning your explanations with core subject concepts.`;
  }
}

/**
 * Generate improvement suggestions based on evaluation results
 * @param {Object} results - Evaluation results
 * @returns {Array<string>} - Improvement suggestions
 */
function generateImprovementSuggestions(results) {
  const weaknesses = results.details.reasoning.weaknesses;
  
  if (weaknesses.length === 0) {
    return ["Continue exploring more advanced topics in this area", "Practice applying these concepts to more complex scenarios"];
  }
  
  const suggestions = weaknesses.map(weakness => {
    if (weakness.includes('understanding')) {
      return `Study the core principles of ${weakness.replace('understanding of ', '')}`;
    } else if (weakness.includes('explanation')) {
      return `Practice explaining ${weakness.replace('explanation of ', '')} concepts more clearly`;
    } else {
      return `Work on improving your knowledge of ${weakness}`;
    }
  });
  
  return suggestions;
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
}

module.exports = router;