import axios from 'axios';

// Relative by default so requests go through the CRA dev proxy (and the same
// origin in production) instead of hard-coding http://localhost:5000.
const API_URL = process.env.REACT_APP_API_URL || '/api';

// AI generation (Gemini) can be slow, but never let a request hang forever.
const AI_TIMEOUT_MS = 120000;

// Use the shared axios instance so the token-refresh interceptor from
// AuthContext applies; send the token explicitly as well.
const authConfig = (extra = {}) => ({
  ...extra,
  headers: {
    'Content-Type': 'application/json',
    'x-auth-token': localStorage.getItem('token') || '',
    ...(extra.headers || {})
  }
});

const errorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

// Backend returns either an array of outcomes or an object wrapping one.
const toOutcomeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.learningOutcomes)) return value.learningOutcomes;
  if (value && Array.isArray(value.outcomes)) return value.outcomes;
  return null;
};

const mapOutcomes = (outcomes) =>
  outcomes
    .filter(outcome => outcome && outcome.text)
    .map(outcome => ({
      text: outcome.text,
      bloom: outcome.bloom,
      competency: outcome.competency
    }));

/**
 * Generate curriculum mapping using Gemini AI
 * @param {string} courseTitle - Course title
 * @param {string} courseDescription - Course description (optional)
 * @returns {Promise} - Promise with curriculum data
 */
export const generateCurriculumWithAI = async (courseTitle, courseDescription = '') => {
  const response = await axios.post(
    `${API_URL}/curriculum/generate`,
    { courseTitle, courseDescription },
    authConfig({ timeout: AI_TIMEOUT_MS })
  );
  return response.data;
};

/**
 * Get curriculum mapping for a course
 * @param {string} courseId - Course ID
 * @returns {Promise} - Promise with `{ success, curriculumMap }`
 */
export const getCurriculumMap = async (courseId) => {
  const response = await axios.get(
    `${API_URL}/curriculum/map/${encodeURIComponent(courseId)}`,
    authConfig({ timeout: 30000 })
  );
  return response.data;
};

/**
 * Generate curriculum map using AI based on course title and description
 * @param {string} courseTitle - Course title to generate curriculum for
 * @param {string} courseDescription - Course description to provide context (optional)
 * @returns {Promise} - Promise with success status and generated data
 */
export const generateCurriculumMap = async (courseTitle, courseDescription = '') => {
  try {
    // Call the AI generation endpoint with both title and description
    const result = await generateCurriculumWithAI(courseTitle, courseDescription);

    // Check if the response contains the data property
    if (!result || !result.data) {
      throw new Error('Invalid response format from server');
    }

    const curriculumData = result.data;

    return {
      success: true,
      data: {
        topics: Array.isArray(curriculumData.topics) ? curriculumData.topics : [],
        outcomes: mapOutcomes(toOutcomeArray(curriculumData.learningOutcomes) || [])
      }
    };
  } catch (error) {
    console.error('Error in curriculum generation:', error);
    return {
      success: false,
      error: errorMessage(error, 'Failed to generate curriculum')
    };
  }
};

/**
 * Generate learning outcomes based on course topics using Gemini AI
 * @param {string} courseTitle - Course title
 * @param {string} courseDescription - Course description
 * @param {Array} topics - Array of course topics
 * @returns {Promise} - Promise with generated learning outcomes
 */
export const generateLearningOutcomesFromTopics = async (courseTitle, courseDescription, topics) => {
  try {
    const response = await axios.post(
      `${API_URL}/curriculum/generate-outcomes`,
      { courseTitle, courseDescription, topics },
      authConfig({ timeout: AI_TIMEOUT_MS })
    );

    const outcomes = toOutcomeArray(response.data?.learningOutcomes);
    if (!outcomes) {
      throw new Error('Invalid response format from server');
    }

    return {
      success: true,
      data: { outcomes: mapOutcomes(outcomes) }
    };
  } catch (error) {
    console.error('Error generating learning outcomes:', error);
    return {
      success: false,
      error: errorMessage(error, 'Failed to generate learning outcomes')
    };
  }
};

/**
 * Generate learning outcomes directly from course description using Gemini AI
 * @param {string} courseTitle - Course title
 * @param {string} courseDescription - Course description (contains the topics)
 * @returns {Promise} - Promise with generated learning outcomes
 */
export const generateLearningOutcomesFromDescription = async (courseTitle, courseDescription) => {
  try {
    const response = await axios.post(
      `${API_URL}/curriculum/generate-outcomes-from-description`,
      { courseTitle, courseDescription },
      authConfig({ timeout: AI_TIMEOUT_MS })
    );

    const outcomes = toOutcomeArray(response.data?.learningOutcomes);
    if (!outcomes) {
      throw new Error('Invalid response format from server');
    }

    return {
      success: true,
      data: { outcomes: mapOutcomes(outcomes) }
    };
  } catch (error) {
    console.error('Error generating learning outcomes:', error);
    return {
      success: false,
      error: errorMessage(error, 'Failed to generate learning outcomes')
    };
  }
};

const curriculumService = {
  generateCurriculumWithAI,
  getCurriculumMap,
  generateCurriculumMap,
  generateLearningOutcomesFromTopics,
  generateLearningOutcomesFromDescription
};

export default curriculumService;
