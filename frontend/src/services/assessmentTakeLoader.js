import axios from 'axios';

// Question types the student UI knows how to render.
const TYPE_ALIASES = {
  'multiple-choice': 'multiple-choice',
  'multiple-choice-question': 'multiple-choice',
  'single-choice': 'multiple-choice',
  mcq: 'multiple-choice',
  'true-false': 'true-false',
  'true-or-false': 'true-false',
  boolean: 'true-false',
  tf: 'true-false',
  'multiple-select': 'multiple-select',
  'multi-select': 'multiple-select',
  'multiple-answer': 'multiple-select',
  'multiple-response': 'multiple-select',
  'select-all': 'multiple-select',
  checkbox: 'multiple-select',
  'short-answer': 'short-answer',
  'long-answer': 'short-answer',
  essay: 'short-answer',
  programming: 'short-answer',
  coding: 'short-answer',
  'problem-solving': 'short-answer',
  'fill-in-the-blank': 'short-answer',
  text: 'short-answer'
};

/**
 * Map the many spellings used by the backend / instructor tools
 * ("Multiple Choice", "True/False", "short_answer", "Essay", ...) onto the
 * four types the student UI renders.
 */
export const normalizeQuestionType = (rawType, options) => {
  const key = String(rawType || 'multiple-choice').trim().toLowerCase().replace(/[\s_/]+/g, '-');
  const hasOptions = Array.isArray(options) && options.length > 0;
  const type = TYPE_ALIASES[key] || (hasOptions ? 'multiple-choice' : 'short-answer');
  // A choice question without options can't be answered with radios/checkboxes.
  if ((type === 'multiple-choice' || type === 'multiple-select') && !hasOptions) {
    return 'short-answer';
  }
  return type;
};

export const normalizeQuestions = (questions) =>
  (Array.isArray(questions) ? questions : []).filter(Boolean).map((q, index) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const type = normalizeQuestionType(q.type || q.questionType, options);
    const normalized = {
      id: q.id ?? q._id ?? `q${index + 1}`,
      text: q.text || q.question || '',
      type,
      options: type === 'true-false' && options.length === 0 ? ['True', 'False'] : options,
      points: Number(q.points || q.pointsPerQuestion) || 1
    };
    if (q.correctAnswer !== undefined) {
      normalized.correctAnswer = q.correctAnswer;
    }
    return normalized;
  });

// True when a stored answer actually contains a response.
export const isAnswered = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const AssessmentTakeLoader = async (assessmentId, setAssessment, setTimeRemaining, setError, setLoading) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in.');
      setLoading(false);
      return false;
    }
    
    const response = await axios.get(`/api/student/assessment/${assessmentId}`, {
      headers: {
        'x-auth-token': token
      }
    });
    
    if (response.data?.success && response.data.assessment) {
      const assessmentData = response.data.assessment;
      const formattedAssessment = {
        ...assessmentData,
        questions: normalizeQuestions(assessmentData.questions)
      };
      
      setAssessment(formattedAssessment);
      const minutes = Number(formattedAssessment.timeLimit);
      setTimeRemaining(minutes > 0 ? Math.round(minutes * 60) : null);
      setLoading(false);
      return true;
    }
  } catch (apiError) {
    console.error('API fetch error:', apiError.response ? apiError.response.data : apiError.message);
    
    if (apiError.response && apiError.response.status === 404) {
      setError(`Assessment not found: ${apiError.response.data?.message || 'The assessment ID may be incorrect.'}`);
    } else if (apiError.response && apiError.response.status === 401) {
      setError('Authentication required. Please log in again.');
    } else {
      setError(`Error loading assessment: ${apiError.response?.data?.message || apiError.message}`);
    }
    setLoading(false);
    return false;
  }
  
  setError('Could not load the assessment. Please check that the assessment exists and has been published.');
  setLoading(false);
  return false;
};

export default AssessmentTakeLoader;
