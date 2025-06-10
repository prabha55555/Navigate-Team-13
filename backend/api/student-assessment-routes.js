// Student assessment routes for students to view and take assessments
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');

// @route   GET /api/student/assessment/assessments
// @desc    Get assessments available for students
// @access  Private (Student access)
router.get('/assessments', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching assessments for student...');
    
    // Get assessments from environment variable or database
    const savedAssessmentsString = process.env.SAVED_ASSESSMENTS || '[]';
    let allAssessments = [];
    
    try {
      allAssessments = JSON.parse(savedAssessmentsString);
    } catch (parseErr) {
      console.error('Error parsing saved assessments:', parseErr);
      allAssessments = [];
    }
    
    // Filter for assessments that should be visible to students
    // Only show assessments that are published/visible or specifically assigned
    const studentAssessments = allAssessments
      .filter(assessment => 
        assessment && (
          (assessment.status === 'published' && assessment.visibleToStudents !== false) || 
          (assessment.isPublished === true && assessment.visibleToStudents !== false) ||
          (assessment.visibleToStudents === true) ||
          (assessment.assignToAllStudents === true && assessment.visibleToStudents !== false) ||
          (assessment.assignedStudents && assessment.assignedStudents.includes(req.user.id) && assessment.visibleToStudents !== false)
        )
      )
      .map(assessment => {
        // Transform each assessment to match frontend expectations and ensure all required fields exist
        return {
          ...assessment,
          id: assessment.id || assessment._id || `assessment-${Date.now()}`,
          _id: assessment.id || assessment._id || `assessment-${Date.now()}`,
          title: assessment.title || 'Untitled Assessment',
          description: assessment.description || '',
          status: assessment.status || 'published',
          course: {
            _id: assessment.courseId || 'unknown',
            title: assessment.courseName || 'Unknown Course'
          }
        };
      });
    
    console.log(`Found ${studentAssessments.length} assessments for student`);
    
    return res.status(200).json({
      success: true,
      assessments: studentAssessments
    });
    
  } catch (error) {
    console.error('Error fetching student assessments:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching assessments: ${error.message}`
    });
  }
});

// @route   GET /api/student/assessment/upcoming
// @desc    Get upcoming assessments for a student
// @access  Private (Student access)
router.get('/upcoming', authMiddleware, async (req, res) => {
  try {
    console.log('=== FETCHING UPCOMING ASSESSMENTS FOR STUDENT ===');
    console.log('Student ID:', req.user.id);
    console.log('Student Role:', req.user.role);
    
    // Get assessments from environment variable or database
    const savedAssessmentsString = process.env.SAVED_ASSESSMENTS || '[]';
    let allAssessments = [];
    
    try {
      allAssessments = JSON.parse(savedAssessmentsString);
      console.log(`Found ${allAssessments.length} total assessments in storage`);
    } catch (parseErr) {
      console.error('Error parsing saved assessments:', parseErr);
      allAssessments = [];
    }
    
    // Filter for assessments that should be visible to students
    const studentAssessments = allAssessments
      .filter(assessment => {
        if (!assessment) return false;
        
        const isAssigned = assessment.assignToAllStudents === true;
        const isPublished = assessment.status === 'published' || assessment.isPublished === true;
        const isVisible = assessment.visibleToStudents === true;
        
        console.log(`Assessment "${assessment.title}" (${assessment.id}): assigned=${isAssigned}, published=${isPublished}, visible=${isVisible}`);
        
        // Include assessment if it's assigned to all students AND is visible/published
        return isAssigned && (isVisible || isPublished);
      })
      .map(assessment => {
        // Check if student has already completed this assessment
        let assessmentStatus = 'available';
        let studentSubmission = null;
        
        try {
          if (process.env.STUDENT_SUBMISSIONS) {
            const submissions = JSON.parse(process.env.STUDENT_SUBMISSIONS);
            studentSubmission = submissions.find(sub => 
              sub.studentId === req.user.id && 
              sub.assessmentId === assessment.id
            );
            
            if (studentSubmission) {
              assessmentStatus = 'completed';
            }
          }
        } catch (e) {
          console.warn('Error checking student submissions:', e);
        }
        
        // Transform each assessment to match frontend expectations
        return {
          ...assessment,
          id: assessment.id || assessment._id || `assessment-${Date.now()}`,
          _id: assessment.id || assessment._id || `assessment-${Date.now()}`,
          title: assessment.title || 'Untitled Assessment',
          description: assessment.description || '',
          status: assessmentStatus, // 'available' or 'completed'
          originalStatus: assessment.status, // Keep original status for reference
          studentSubmission: studentSubmission ? {
            score: studentSubmission.score,
            maxScore: studentSubmission.maxScore,
            percentage: studentSubmission.percentage,
            isPassed: studentSubmission.isPassed,
            submittedAt: studentSubmission.submittedAt
          } : null,
          course: {
            _id: assessment.courseId || 'unknown',
            title: assessment.courseName || 'Unknown Course'
          }
        };
      });
    
    // Sort by due date (closest first)
    studentAssessments.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt);
      const dateB = new Date(b.dueDate || b.createdAt);
      return dateA - dateB;
    });
    
    console.log(`Returning ${studentAssessments.length} upcoming assessments for student`);
    
    return res.status(200).json({
      success: true,
      assessments: studentAssessments
    });
    
  } catch (error) {
    console.error('Error fetching upcoming assessments:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching upcoming assessments: ${error.message}`
    });
  }
});

// Add a route for getting a specific assessment
// @route   GET /api/student/assessment/:id
// @desc    Get details of a specific assessment for a student
// @access  Private (Student)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assessments from environment variable
    const savedAssessmentsString = process.env.SAVED_ASSESSMENTS || '[]';
    let assessments = [];
    
    try {
      assessments = JSON.parse(savedAssessmentsString);
    } catch (parseErr) {
      console.error('Error parsing saved assessments:', parseErr);
    }
    
    // Find the assessment and ensure it's published and visible
    const assessment = assessments.find(a => 
      (a.id === id || a._id === id) && 
      (
        (a.status === 'published' && a.visibleToStudents !== false) || 
        (a.isPublished === true && a.visibleToStudents !== false) ||
        (a.visibleToStudents === true) ||
        (a.assignToAllStudents === true && a.visibleToStudents !== false)
      )
    );
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found or not available for students'
      });
    }
    
    // Create a student-safe version of the assessment without answers
    const safeAssessment = {
      ...assessment,
      id: assessment.id || assessment._id,
      _id: assessment.id || assessment._id,
      title: assessment.title || 'Untitled Assessment',
      description: assessment.description || '',
      courseId: assessment.courseId || assessment.course?.id,
      courseName: assessment.courseName || assessment.course?.title || 'Course',
      dueDate: assessment.dueDate || null,
      timeLimit: assessment.timeLimit || null,
      totalPoints: assessment.totalPoints || assessment.questions.reduce((sum, q) => sum + (q.points || 1), 0),
      status: assessment.status || 'published',
      questions: assessment.questions.map(q => ({
        id: q.id || q._id,
        text: q.question || q.text,
        type: q.questionType || q.type,
        options: q.options || [],
        points: q.points || q.pointsPerQuestion || 1
        // Note: we intentionally omit the correctAnswer field
      }))
    };
    
    console.log(`Returning assessment "${safeAssessment.title}" with ${safeAssessment.questions.length} questions`);
    
    return res.status(200).json({
      success: true,
      assessment: safeAssessment
    });
    
  } catch (error) {
    console.error('Error fetching assessment:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching assessment: ${error.message}`
    });
}
});
// @route   POST /api/student/assessment/submit
// @desc    Submit answers for an assessment
// @access  Private (Student)
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { assessmentId, answers, timeSpent } = req.body;
    
    console.log('=== ASSESSMENT SUBMISSION ===');
    console.log('Student ID:', req.user.id);
    console.log('Assessment ID:', assessmentId);
    console.log('Answers received:', answers);
    console.log('Time spent:', timeSpent);
    
    // Validate input
    if (!assessmentId || !answers) {
      return res.status(400).json({
        success: false,
        message: 'Assessment ID and answers are required'
      });
    }
    
    // Get assessments from environment variable
    const savedAssessmentsString = process.env.SAVED_ASSESSMENTS || '[]';
    let assessments = [];
    
    try {
      assessments = JSON.parse(savedAssessmentsString);
    } catch (parseErr) {
      console.error('Error parsing saved assessments:', parseErr);
    }
    
    // Find the assessment
    const assessment = assessments.find(a => 
      (a.id === assessmentId || a._id === assessmentId)
    );
    
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }
    
    console.log(`Found assessment: "${assessment.title}" with ${assessment.questions.length} questions`);
    
    // Check if the assessment is available for submission
    if (assessment.status !== 'published' || assessment.visibleToStudents === false) {
      return res.status(403).json({
        success: false,
        message: 'This assessment is not available for submission'
      });
    }
    
    // Calculate score
    const scoreResult = calculateScore(assessment, answers);
    
    // Calculate percentage and pass/fail status
    const percentage = Math.round((scoreResult.totalScore / scoreResult.maxScore) * 100);
    const passThreshold = 50; // 50% pass threshold
    const isPassed = percentage >= passThreshold;
    
    // Create submission record
    const submissionId = `submission-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const submission = {
      id: submissionId,
      studentId: req.user.id,
      studentName: req.user.name || 'Student',
      assessmentId: assessmentId,
      assessmentTitle: assessment.title,
      courseId: assessment.courseId,
      courseName: assessment.courseName,
      answers: answers,
      score: scoreResult.totalScore,
      maxScore: scoreResult.maxScore,
      percentage: percentage,
      isPassed: isPassed,
      status: 'completed',
      gradingStatus: 'completed',
      submittedAt: new Date().toISOString(),
      timeSpent: timeSpent || 0,
      feedback: scoreResult.feedback
    };
    
    // Store submission in environment variable (in production, save to database)
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
    
    console.log(`Submission successful: ${scoreResult.totalScore}/${scoreResult.maxScore} points (${percentage}% - ${isPassed ? 'PASSED' : 'FAILED'})`);
    
    return res.status(200).json({
      success: true,
      submissionId: submissionId,
      score: scoreResult.totalScore,
      maxScore: scoreResult.maxScore,
      percentage: percentage,
      isPassed: isPassed,
      status: 'completed',
      message: `Assessment submitted successfully. ${isPassed ? 'Congratulations! You passed.' : 'You did not meet the passing threshold of 50%.'}`
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({
      success: false,
      message: `Error submitting assessment: ${error.message}`
    });
  }
});

// Helper function to calculate scores based on assessment type
function calculateScore(assessment, answers) {
  let totalScore = 0;
  let maxScore = 0;
  let feedback = [];
  
  console.log('=== CALCULATING SCORE ===');
  console.log('Assessment questions:', assessment.questions.length);
  console.log('Student answers:', Object.keys(answers).length);
  
  // For each question in the assessment
  assessment.questions.forEach(question => {
    const questionId = question.id;
    const studentAnswer = answers[questionId]; // Answers come as object with questionId as key
    const points = question.points || 1;
    maxScore += points;
    
    console.log(`Question ${questionId}: student answer = "${studentAnswer}", correct = "${question.correctAnswer}"`);
    
    // Check if answer is provided (handle different data types)
    if (!studentAnswer || 
        (typeof studentAnswer === 'string' && studentAnswer.trim() === '') ||
        (Array.isArray(studentAnswer) && studentAnswer.length === 0)) {
      feedback.push({
        questionId: questionId,
        correct: false,
        points: 0,
        feedback: 'No answer provided'
      });
      console.log(`Question ${questionId}: No answer provided`);
      return;
    }
    
    // Different scoring based on question type
    const questionType = question.questionType || question.type || 'multiple-choice';
    let isCorrect = false;
    
    if (questionType === 'multiple-choice') {
      const correctAnswer = question.correctAnswer;
      isCorrect = studentAnswer === correctAnswer;
      
      if (isCorrect) {
        totalScore += points;
      }
      
      feedback.push({
        questionId: questionId,
        correct: isCorrect,
        points: isCorrect ? points : 0,
        feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${correctAnswer}`
      });
      
      console.log(`Question ${questionId} (MC): ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      
    } else if (questionType === 'true-false') {
      const correctAnswer = question.correctAnswer;
      isCorrect = studentAnswer === correctAnswer;
      
      if (isCorrect) {
        totalScore += points;
      }
      
      feedback.push({
        questionId: questionId,
        correct: isCorrect,
        points: isCorrect ? points : 0,
        feedback: isCorrect ? 'Correct!' : `Incorrect. The correct answer was: ${correctAnswer}`
      });
      
      console.log(`Question ${questionId} (T/F): ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      
    } else if (questionType === 'short-answer') {
      // For short answers, give partial credit for reasonable attempts
      const answerText = typeof studentAnswer === 'string' ? studentAnswer.trim() : String(studentAnswer);
      const answerLength = answerText.length;
      
      if (answerLength >= 10) {
        // Give full points for reasonable length answers
        totalScore += points;
        isCorrect = true;
        feedback.push({
          questionId: questionId,
          correct: true,
          points: points,
          feedback: 'Good answer! This question requires manual review for full evaluation.'
        });
      } else if (answerLength >= 5) {
        // Give partial credit for short but present answers
        const partialPoints = Math.ceil(points * 0.5);
        totalScore += partialPoints;
        feedback.push({
          questionId: questionId,
          correct: 'partial',
          points: partialPoints,
          feedback: 'Partial credit given. Consider providing more detail.'
        });
      } else {
        feedback.push({
          questionId: questionId,
          correct: false,
          points: 0,
          feedback: 'Answer too short. Please provide more detail.'
        });
      }
      
      console.log(`Question ${questionId} (Short): Answer length = ${answerLength}`);
      
    } else {
      // For other question types, give benefit of doubt if answered
      totalScore += points;
      feedback.push({
        questionId: questionId,
        correct: true,
        points: points,
        feedback: 'Answer recorded. Manual review may be required.'
      });
      
      console.log(`Question ${questionId} (Other): Full points given`);
    }
  });
  
  console.log(`Final score: ${totalScore}/${maxScore} (${Math.round((totalScore/maxScore)*100)}%)`);
  
  return {
    totalScore,
    maxScore,
    feedback
  };
}

// @route   GET /api/student/assessment/submissions/:courseId
// @desc    Get all student submissions for a course (Instructor only)
// @access  Private (Instructor)
router.get('/submissions/:courseId', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log('=== FETCHING STUDENT SUBMISSIONS FOR INSTRUCTOR ===');
    console.log('Instructor ID:', req.user.id);
    console.log('Course ID:', courseId);
    
    // Check if user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view student submissions'
      });
    }
    
    // Get all submissions from environment variable
    let allSubmissions = [];
    try {
      if (process.env.STUDENT_SUBMISSIONS) {
        allSubmissions = JSON.parse(process.env.STUDENT_SUBMISSIONS);
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
    
    // Transform submissions for instructor view
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
      status: submission.status || 'completed',
      gradingStatus: submission.gradingStatus || 'completed',
      submittedAt: submission.submittedAt,
      submissionDate: submission.submittedAt,
      timeSpent: submission.timeSpent,
      timeTaken: submission.timeSpent,
      feedbackProvided: true,
      attempts: 1
    }));
    
    return res.status(200).json({
      success: true,
      submissions: instructorSubmissions,
      count: instructorSubmissions.length
    });
    
  } catch (error) {
    console.error('Error fetching course submissions:', error);
    return res.status(500).json({
      success: false,
      message: `Error fetching submissions: ${error.message}`
    });
  }
});

// Export the router
module.exports = router;