// Shared, localStorage-backed data helpers for the instructor pages.
//
// The backend has no courses API and no "get one instructor assessment" API, so
// the instructor flow works from the built-in demo courses plus whatever the
// instructor created locally (courses, saved assessments, curriculum maps).
// Keeping this in one place makes every instructor page agree on course ids/titles.

export const MOCK_COURSES = [
  {
    id: '1',
    title: 'Data Structures and Algorithms',
    code: 'CS301',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 45,
    assessmentCount: 3,
    description: 'Introduction to fundamental data structures and algorithms used in computer science.',
    students: [
      { id: '1', name: 'Alex Johnson', email: 'alex.j@example.com', avgScore: 88 },
      { id: '2', name: 'Jamie Smith', email: 'jamie.s@example.com', avgScore: 92 },
      { id: '3', name: 'Taylor Williams', email: 'taylor.w@example.com', avgScore: 76 },
    ],
    assessments: [
      { id: '1', title: 'Java Data Structures Assessment', syllabusTitle: 'Chapter 1-5', type: 'Exam', dueDate: '2025-10-15', avgScore: 82, submissions: 40, assignToAllStudents: true },
      { id: '2', title: 'Binary Trees Implementation', syllabusTitle: 'Chapter 6', type: 'Programming Assignment', dueDate: '2025-11-01', avgScore: 89, submissions: 42, assignToAllStudents: false },
      { id: '3', title: 'Final Exam', syllabusTitle: 'Chapter 1-10', type: 'Exam', dueDate: '2025-12-10', avgScore: 0, submissions: 0, assignToAllStudents: true }
    ],
    materials: [
      { id: '1', title: 'Introduction to Data Structures', type: 'Lecture Notes', week: 1, url: '#' },
      { id: '2', title: 'Array Implementation', type: 'Programming Example', week: 2, url: '#' },
      { id: '3', title: 'Linked Lists vs Arrays', type: 'Research Article', week: 3, url: '#' }
    ]
  },
  {
    id: '2',
    title: 'Introduction to Programming',
    code: 'CS101',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 120,
    assessmentCount: 5,
    description: 'Fundamentals of programming using Python. No prior experience required.',
    students: [],
    assessments: [],
    materials: []
  },
  {
    id: '3',
    title: 'Web Development Fundamentals',
    code: 'CS240',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 60,
    assessmentCount: 4,
    description: 'Introduction to web development including HTML, CSS, JavaScript, and responsive design.',
    students: [],
    assessments: [],
    materials: []
  }
];

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
};

const readArray = (key) => {
  const value = readJSON(key, []);
  return Array.isArray(value) ? value : [];
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Could not persist ${key}:`, e);
  }
};

export const readSavedAssessments = () => readArray('savedAssessments');

// Row shape used by the course "Assessments" table.
const toAssessmentRow = (a) => ({
  id: a.id,
  title: a.title,
  syllabusTitle: a.syllabusTitle || 'Generated Assessment',
  type: a.type || 'Quiz',
  dueDate: a.dueDate || null,
  avgScore: a.avgScore || 0,
  submissions: a.submissions || 0,
  assignToAllStudents: !!a.assignToAllStudents,
  totalPoints: a.totalPoints,
  pattern: a.pattern || null,
  visibility: a.visibility || null
});

/**
 * All courses visible to the instructor: demo courses + locally created ones,
 * minus deleted ones, with locally saved assessments merged in.
 */
export const loadInstructorCourses = () => {
  const deletedCourses = new Set(readArray('deletedCourseIds'));
  const deletedAssessments = new Set(readArray('deletedAssessmentIds'));
  const savedAssessments = readSavedAssessments();

  const courses = [...MOCK_COURSES];
  readArray('savedCourses').forEach(saved => {
    if (saved && saved.id && !courses.some(c => c.id === saved.id)) {
      courses.push(saved);
    }
  });

  return courses
    .filter(course => !deletedCourses.has(course.id))
    .map(course => {
      const baseRows = (course.assessments || []).filter(a => !deletedAssessments.has(a.id));
      const removedBase = (course.assessments || []).length - baseRows.length;
      const savedForCourse = savedAssessments.filter(a => a && a.courseId === course.id);
      const savedIds = new Set(savedForCourse.map(a => a.id));
      // A locally saved copy (e.g. after editing) replaces the demo row with the same id.
      const keptBase = baseRows.filter(a => !savedIds.has(a.id));
      const added = savedForCourse.length - (baseRows.length - keptBase.length);

      return {
        ...course,
        students: course.students || [],
        materials: course.materials || [],
        assessments: [...keptBase, ...savedForCourse.map(toAssessmentRow)],
        assessmentCount: Math.max(0, (course.assessmentCount || 0) + added - removedBase)
      };
    });
};

export const getInstructorCourse = (courseId) =>
  loadInstructorCourses().find(course => course.id === courseId) || null;

export const saveCourse = (course) => {
  const saved = readArray('savedCourses').filter(c => c && c.id !== course.id);
  saved.push(course);
  writeJSON('savedCourses', saved);
};

export const deleteCourse = (courseId) => {
  writeJSON('savedCourses', readArray('savedCourses').filter(c => c && c.id !== courseId));
  writeJSON('savedAssessments', readSavedAssessments().filter(a => a && a.courseId !== courseId));
  const deleted = new Set(readArray('deletedCourseIds'));
  deleted.add(courseId);
  writeJSON('deletedCourseIds', [...deleted]);
};

export const deleteAssessment = (assessmentId) => {
  writeJSON('savedAssessments', readSavedAssessments().filter(a => a && a.id !== assessmentId));
  const deleted = new Set(readArray('deletedAssessmentIds'));
  deleted.add(assessmentId);
  writeJSON('deletedAssessmentIds', [...deleted]);
};

/**
 * Find an assessment for editing: a full locally saved copy first, otherwise the
 * demo row (title/course only) so edit mode can still show sensible values.
 */
export const findInstructorAssessment = (assessmentId) => {
  const saved = readSavedAssessments().find(a => a && a.id === assessmentId);
  if (saved) return { assessment: saved, isFullRecord: true };

  for (const course of MOCK_COURSES) {
    const row = (course.assessments || []).find(a => a.id === assessmentId);
    if (row) return { assessment: { ...row, courseId: course.id }, isFullRecord: false };
  }
  return { assessment: null, isFullRecord: false };
};

// ---- Curriculum maps (per course) ----

export const loadCurriculumMap = (courseId) => {
  const maps = readJSON('savedCurriculumMaps', {});
  return maps && typeof maps === 'object' ? maps[courseId] || null : null;
};

export const saveCurriculumMap = (courseId, curriculumMap) => {
  const maps = readJSON('savedCurriculumMaps', {});
  const next = maps && typeof maps === 'object' && !Array.isArray(maps) ? maps : {};
  next[courseId] = curriculumMap;
  writeJSON('savedCurriculumMaps', next);
};

// ---- Question types ----
// Students' AssessmentTake and the backend grader expect kebab-case types
// ('multiple-choice', 'true-false', 'short-answer'); AI output and the instructor
// UI use mixed spellings ('Multiple Choice', 'true/false', ...).

const QUESTION_TYPE_LABELS = {
  'multiple-choice': 'Multiple Choice',
  'multiple-select': 'Multiple Select',
  'true-false': 'True/False',
  'short-answer': 'Short Answer',
  essay: 'Essay',
  programming: 'Programming',
  'problem-solving': 'Problem Solving',
  matching: 'Matching'
};

export const normalizeQuestionType = (type) => {
  const t = String(type || '').trim().toLowerCase().replace(/[\s_/]+/g, '-');
  if (!t) return 'multiple-choice';
  if (t.includes('select')) return 'multiple-select';
  if (t.includes('multiple') || t.includes('choice') || t === 'mcq') return 'multiple-choice';
  if (t.includes('true') || t.includes('false')) return 'true-false';
  if (t.includes('short')) return 'short-answer';
  if (t.includes('essay') || t.includes('long')) return 'essay';
  if (t.includes('program') || t.includes('code') || t.includes('coding')) return 'programming';
  if (t.includes('problem')) return 'problem-solving';
  if (t.includes('match')) return 'matching';
  return t;
};

export const questionTypeLabel = (type) => {
  const key = normalizeQuestionType(type);
  return QUESTION_TYPE_LABELS[key] || String(type || '');
};
