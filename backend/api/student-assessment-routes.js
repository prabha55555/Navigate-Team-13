// Student assessment routes for students to view and take assessments
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const assessmentStore = require('../services/assessmentStore');
const gradingService = require('../services/gradingService');
const plagiarismService = require('../services/plagiarismService');
const { resolveUserName } = require('../services/userDirectory');

// Upper bound on how long a submission waits for the AI plagiarism check
const PLAGIARISM_WAIT_MS = 8000;

/**
 * Question list that is safe to send to a student (no answer key).
 * Earlier the listing routes spread the whole stored assessment into the
 * response, which sent every correctAnswer to the browser.
 */
const toStudentQuestions = (questions) =>
  (Array.isArray(questions) ? questions : []).map((q, i) => {
    const type = gradingService.normalizeQuestionType(q.questionType || q.type);
    return {
      id: q.id !== undefined ? q.id : (q._id !== undefined ? q._id : `q${i + 1}`),
      text: q.question || q.text,
      type,
      options: q.options || [],
      points: q.points || q.pointsPerQuestion || 1
      // Note: we intentionally omit the correctAnswer field
    };
  });

const toStudentAssessment = (assessment) => {
  const questions = toStudentQuestions(assessment.questions);
  const { syllabusTitle, ...rest } = assessment;
  const showSyllabusTitle = !assessment.visibility || assessment.visibility.studentsCanSeeSyllabusTitle !== false;
  return {
    ...rest,
    ...(showSyllabusTitle && syllabusTitle !== undefined ? { syllabusTitle } : {}),
    id: assessment.id || assessment._id,
    _id: assessment.id || assessment._id,
    title: assessment.title || 'Untitled Assessment',
    description: assessment.description || '',
    status: assessment.status || 'published',
    questions,
    questionCount: questions.length,
    course: {
      _id: assessment.courseId || 'unknown',
      title: assessment.courseName || 'Unknown Course'
    }
  };
};

// @route   GET /api/student/assessment/assessments
// @desc    Get assessments available for students
// @access  Private (Student access)
router.get('/assessments', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching assessments for student...');

    // Only show assessments that are published/visible or specifically assigned
    const studentAssessments = assessmentStore.getAssessments()
      .filter(assessment => assessmentStore.isVisibleToStudents(assessment, req.user.id))
      .map(toStudentAssessment);

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

    const allAssessments = assessmentStore.getAssessments();
    console.log(`Found ${allAssessments.length} total assessments in storage`);

    // Index this student's latest submission per assessment once, instead of
    // re-parsing and scanning all submissions for every assessment.
    const latestSubmissionByAssessment = new Map();
    assessmentStore.getSubmissions().forEach(sub => {
      if (String(sub.studentId) === String(req.user.id)) {
        latestSubmissionByAssessment.set(String(sub.assessmentId), sub);
      }
    });

    // Same visibility rule as GET /:id and POST /submit, so everything listed
    // here can actually be opened and submitted (the seeded demo assessment
    // used to be hidden because it has no assignToAllStudents flag).
    const studentAssessments = allAssessments
      .filter(assessment => assessmentStore.isVisibleToStudents(assessment, req.user.id))
      .map(assessment => {
        const studentSubmission = latestSubmissionByAssessment.get(String(assessment.id || assessment._id)) || null;

        // Transform each assessment to match frontend expectations
        return {
          ...toStudentAssessment(assessment),
          status: studentSubmission ? 'completed' : 'available',
          originalStatus: assessment.status, // Keep original status for reference
          studentSubmission: studentSubmission ? {
            submissionId: studentSubmission.id,
            score: studentSubmission.score,
            maxScore: studentSubmission.maxScore,
            percentage: studentSubmission.percentage,
            isPassed: studentSubmission.isPassed,
            submittedAt: studentSubmission.submittedAt
          } : null
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
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only instructors can view student submissions'
      });
    }

    const instructorSubmissions = assessmentStore.listCourseSubmissions(courseId);
    console.log(`Found ${instructorSubmissions.length} submissions for course ${courseId}`);

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

// Add a route for getting a specific assessment
// @route   GET /api/student/assessment/:id
// @desc    Get details of a specific assessment for a student
// @access  Private (Student)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the assessment and ensure it's published and visible
    const assessment = assessmentStore.findAssessment(id);

    if (!assessment || !assessmentStore.isVisibleToStudents(assessment, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found or not available for students'
      });
    }

    // Create a student-safe version of the assessment without answers
    const base = toStudentAssessment(assessment);
    const questions = base.questions;
    const safeAssessment = {
      ...base,
      courseId: assessment.courseId || assessment.course?.id,
      courseName: assessment.courseName || assessment.course?.title || 'Course',
      dueDate: assessment.dueDate || null,
      timeLimit: assessment.timeLimit || null,
      totalPoints: assessment.totalPoints || questions.reduce((sum, q) => sum + (q.points || 1), 0),
      status: assessment.status || 'published',
      questions
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
    if (!assessmentId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Assessment ID and answers are required'
      });
    }

    // Find the assessment
    const assessment = assessmentStore.findAssessment(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    console.log(`Found assessment: "${assessment.title}" with ${(assessment.questions || []).length} questions`);

    // Check if the assessment is available for submission (same rule as GET /:id;
    // it used to require status === 'published', so assessments the student could
    // open via isPublished/visibleToStudents could not be submitted)
    if (!assessmentStore.isVisibleToStudents(assessment, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'This assessment is not available for submission'
      });
    }

    // Calculate score with the shared grader. Fixes: true/false answers arrive as
    // booleans and were always marked wrong (false was even treated as "no
    // answer"), any 10-character reply got full short-answer marks, and
    // multiple-select / unknown types got full marks for any answer.
    const grade = gradingService.gradeSubmission(assessment, answers);
    const { aiFeedback, personalizedRecommendations } = gradingService.buildFeedback(grade, assessment.questions);
    const { score, maxScore, percentage, isPassed } = grade;

    // Create submission record
    const submissionId = `submission-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const submission = {
      id: submissionId,
      studentId: req.user.id,
      studentName: await resolveUserName(req.user),
      assessmentId: assessment.id || assessmentId,
      assessmentTitle: assessment.title,
      courseId: assessment.courseId,
      courseName: assessment.courseName,
      answers: answers,
      score,
      maxScore,
      percentage,
      isPassed,
      status: 'completed',
      gradingStatus: 'completed',
      submittedAt: new Date().toISOString(),
      timeSpent: timeSpent || 0,
      // What the results page renders (it previously got nothing per question)
      questionResults: grade.questionResults,
      detailedAnswers: grade.detailedAnswers,
      aiFeedback,
      personalizedRecommendations,
      feedback: aiFeedback
    };

    // Integrity check for written answers, bounded so it cannot stall the submit
    try {
      submission.plagiarismResults = await plagiarismService.checkSubmissionBounded({
        submissionId,
        studentId: req.user.id,
        assessmentId: submission.assessmentId,
        answers: grade.detailedAnswers,
        assessmentDetails: assessment
      }, {
        timeoutMs: PLAGIARISM_WAIT_MS,
        onLateResult: (lateResult) => { submission.plagiarismResults = lateResult; }
      });
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

    console.log(`Submission successful: ${score}/${maxScore} points (${percentage}% - ${isPassed ? 'PASSED' : 'FAILED'})`);

    return res.status(200).json({
      success: true,
      submissionId: submissionId,
      score,
      maxScore,
      percentage: percentage,
      isPassed: isPassed,
      status: 'completed',
      message: `Assessment submitted successfully. ${isPassed ? 'Congratulations! You passed.' : `You did not meet the passing threshold of ${gradingService.PASS_THRESHOLD}%.`}`
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({
      success: false,
      message: `Error submitting assessment: ${error.message}`
    });
  }
});

// Export the router
module.exports = router;
