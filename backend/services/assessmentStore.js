/**
 * In-memory store for instructor-created assessments and student submissions.
 *
 * Replaces the old approach of JSON-encoding everything into
 * process.env.SAVED_ASSESSMENTS / process.env.STUDENT_SUBMISSIONS: process.env
 * only holds strings, every access re-parsed the whole collection, and on
 * Windows environment values are capped at 32,767 characters, so submissions
 * were silently lost once the data grew. Data here lives for the lifetime of
 * the process (same persistence as before), but is shared by reference.
 */

const assessments = [];
const submissions = [];

const getId = (item) => (item ? item.id || item._id : undefined);

const mockInstructorAssessment = () => ({
  id: 'instructor-assessment-1',
  title: 'Java Data Structures Assessment',
  description: 'Comprehensive evaluation of Java data structures and collections framework',
  courseId: '1',
  courseName: 'Data Structures and Algorithms in Java',
  timeLimit: 45,
  totalPoints: 40,
  dueDate: '2025-05-20T23:59:00',
  status: 'published',
  createdAt: new Date().toISOString(),
  randomizeQuestions: true,
  questions: [
    {
      id: 'q1',
      question: 'Which Java collection interface is implemented by ArrayList and LinkedList?',
      questionType: 'multiple-choice',
      options: ['Set', 'List', 'Queue', 'Map'],
      correctAnswer: 'List',
      points: 5,
      difficulty: 'Easy'
    },
    {
      id: 'q2',
      question: 'In Java, which data structure would be most appropriate for implementing a FIFO (First In First Out) queue?',
      questionType: 'multiple-choice',
      options: ['java.util.Stack', 'java.util.LinkedList', 'java.util.TreeSet', 'java.util.HashMap'],
      correctAnswer: 'java.util.LinkedList',
      points: 5,
      difficulty: 'Easy'
    },
    {
      id: 'q3',
      question: 'Briefly explain the difference between formative and summative assessments.',
      questionType: 'short-answer',
      correctAnswer: 'Formative assessments are ongoing evaluations that monitor student learning during the instructional process, providing feedback to improve teaching and learning. Summative assessments evaluate student learning at the end of an instructional period by comparing against standards or benchmarks.',
      points: 10,
      difficulty: 'Medium'
    },
    {
      id: 'q4',
      question: 'Select all features that are available in this assessment platform:',
      questionType: 'multiple-select',
      options: [
        'Multiple choice questions',
        'Short answer questions',
        'Automatic grading',
        'Question randomization',
        'Time limits'
      ],
      correctAnswer: ['Multiple choice questions', 'Short answer questions', 'Question randomization', 'Time limits'],
      points: 10,
      difficulty: 'Medium'
    },
    {
      id: 'q5',
      question: 'True or False: This platform allows instructors to create custom assessments.',
      questionType: 'true-false',
      options: ['True', 'False'],
      correctAnswer: 'True',
      points: 5,
      difficulty: 'Easy'
    },
    {
      id: 'q6',
      question: 'What is the main benefit of using automated assessment tools?',
      questionType: 'multiple-choice',
      options: [
        'They eliminate the need for instructors',
        'They reduce grading time and provide quick feedback',
        'They only work for technical subjects',
        'They are always more accurate than manual grading'
      ],
      correctAnswer: 'They reduce grading time and provide quick feedback',
      points: 5,
      difficulty: 'Easy'
    }
  ]
});

/**
 * Seed the demo assessment (idempotent). Controlled by ENABLE_MOCK_DATA.
 * @returns {Array} the seeded assessments
 */
function seedMockAssessments() {
  if (process.env.ENABLE_MOCK_DATA === 'false') return [];
  const mock = mockInstructorAssessment();
  if (!findAssessment(mock.id)) {
    assessments.push(mock);
  }
  return [mock];
}

function getAssessments() {
  return assessments;
}

function findAssessment(id) {
  if (id === undefined || id === null) return undefined;
  const key = String(id);
  return assessments.find(a => String(getId(a)) === key);
}

function addAssessment(assessment) {
  assessments.push(assessment);
  return assessment;
}

function getSubmissions() {
  return submissions;
}

function findSubmission(id) {
  if (id === undefined || id === null) return undefined;
  const key = String(id);
  return submissions.find(s => String(getId(s)) === key);
}

function addSubmission(submission) {
  submissions.push(submission);
  return submission;
}

/**
 * Whether an assessment may be seen/taken by students. Single source of truth
 * so the listing, detail and submit routes agree with each other.
 */
function isVisibleToStudents(assessment, studentId) {
  if (!assessment) return false;
  if (assessment.visibleToStudents === false) return false;
  return (
    assessment.status === 'published' ||
    assessment.isPublished === true ||
    assessment.visibleToStudents === true ||
    assessment.assignToAllStudents === true ||
    (Array.isArray(assessment.assignedStudents) && studentId !== undefined &&
      assessment.assignedStudents.map(String).includes(String(studentId)))
  );
}

/**
 * Submissions for a course, shaped for the instructor results views.
 * courseId values 'all' / 'undefined' / 'null' / '' list every submission
 * (the instructor results page calls with an optional course id).
 */
function listCourseSubmissions(courseId) {
  const key = courseId === undefined || courseId === null ? '' : String(courseId);
  const listAll = ['', 'all', 'undefined', 'null'].includes(key);
  const selected = submissions.filter(s => listAll || String(s.courseId) === key);
  const attemptCounts = new Map();
  selected.forEach(s => {
    const k = `${s.studentId}|${s.assessmentId}`;
    attemptCounts.set(k, (attemptCounts.get(k) || 0) + 1);
  });
  return selected
    .map(submission => {
      const maxScore = submission.maxScore || 0;
      const percentage = submission.percentage !== undefined
        ? submission.percentage
        : (maxScore > 0 ? Math.round((submission.score / maxScore) * 100) : 0);
      return {
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
        percentage,
        isPassed: submission.isPassed !== undefined ? submission.isPassed : percentage >= 50,
        status: submission.status || 'completed',
        gradingStatus: submission.gradingStatus || 'completed',
        submittedAt: submission.submittedAt,
        submissionDate: submission.submittedAt,
        timeSpent: submission.timeSpent,
        timeTaken: submission.timeSpent,
        feedbackProvided: true,
        attempts: attemptCounts.get(`${submission.studentId}|${submission.assessmentId}`) || 1
      };
    });
}

module.exports = {
  listCourseSubmissions,
  seedMockAssessments,
  getAssessments,
  findAssessment,
  addAssessment,
  getSubmissions,
  findSubmission,
  addSubmission,
  isVisibleToStudents
};
