/**
 * Shared grading + feedback logic used by both submission routes
 * (POST /api/student/assessment/submit and POST /api/assessment/submit),
 * so the same answers always get the same score and pass/fail result.
 */

const PASS_THRESHOLD = 50; // percent

/**
 * Map the many spellings of question types we receive (from instructors,
 * Gemini output and older data) onto the canonical set used by the UI.
 */
function normalizeQuestionType(type) {
  const t = String(type || '').trim().toLowerCase().replace(/[\s_/]+/g, '-');
  if (!t) return 'multiple-choice';
  if (t === 'mcq' || t === 'multiple-choice' || t === 'multiplechoice' || t === 'single-choice' ||
      (t.includes('multiple') && t.includes('choice'))) return 'multiple-choice';
  if (t.includes('select') || t === 'checkbox' || t === 'multiple-answer' || t === 'multiple-response') return 'multiple-select';
  if (t.includes('true') || t.includes('false') || t === 'boolean' || t === 'tf') return 'true-false';
  if (t.includes('essay') || t.includes('long')) return 'essay';
  if (t.includes('short') || t.includes('answer') || t.includes('text') || t.includes('open')) return 'short-answer';
  return t;
}

const isBlank = (value) =>
  value === undefined || value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

const norm = (value) => String(value).trim().toLowerCase();

/**
 * Resolve an answer key that may be stored as option text, an option letter
 * ("B") or an option index (1) into option text.
 */
function resolveOption(value, options) {
  if (!Array.isArray(options) || options.length === 0 || value === undefined || value === null) return value;
  const asText = String(value).trim();
  if (options.some(o => norm(o) === norm(asText))) return asText;
  if (/^[A-Za-z]$/.test(asText)) {
    const idx = asText.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  if (/^\d+$/.test(asText)) {
    const idx = parseInt(asText, 10);
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  return value;
}

/**
 * Grade a free-text answer. Credit is based on length (as before) but the
 * thresholds are the stricter ones from the original /api/assessment/submit
 * route, so a 10-character reply is no longer worth full marks.
 */
function gradeTextAnswer(answerText, points) {
  const length = answerText.length;
  if (length >= 50) {
    return { isCorrect: true, partialCredit: 0, feedback: 'Good detailed answer!' };
  }
  if (length >= 20) {
    return { isCorrect: false, partialCredit: Math.ceil(points * 0.7), feedback: 'Good answer, but could be more detailed.' };
  }
  if (length >= 10) {
    return { isCorrect: false, partialCredit: Math.ceil(points * 0.5), feedback: 'Brief answer provided, needs more detail.' };
  }
  return { isCorrect: false, partialCredit: 0, feedback: 'Answer too brief. Please provide more details.' };
}

/**
 * Score a set of answers against an assessment.
 * @param {Object} assessment - assessment with questions[]
 * @param {Object} answers - map of questionId -> answer
 */
function gradeSubmission(assessment, answers) {
  const questions = Array.isArray(assessment && assessment.questions) ? assessment.questions : [];
  const answerMap = answers && typeof answers === 'object' ? answers : {};

  let score = 0;
  let maxScore = 0;
  const questionResults = [];
  const detailedAnswers = [];

  questions.forEach((question, index) => {
    const questionId = question.id !== undefined ? question.id : (question._id !== undefined ? question._id : `q${index + 1}`);
    const studentAnswer = answerMap[questionId];
    const points = Number(question.points) > 0 ? Number(question.points) : 1;
    const questionType = normalizeQuestionType(question.questionType || question.type);
    const correctAnswer = question.correctAnswer;
    const options = question.options || [];

    maxScore += points;

    let isCorrect = false;
    let partialCredit = 0;
    let feedback = '';

    if (isBlank(studentAnswer)) {
      feedback = 'No answer provided.';
    } else if (questionType === 'multiple-choice') {
      const expected = resolveOption(correctAnswer, options);
      const given = resolveOption(studentAnswer, options);
      isCorrect = expected !== undefined && expected !== null && norm(given) === norm(expected);
      feedback = isCorrect ? 'Correct answer!' : `Incorrect. The correct answer is: ${expected}`;
    } else if (questionType === 'true-false') {
      // The take-assessment UI sends booleans; stored keys are "True"/"False".
      isCorrect = correctAnswer !== undefined && correctAnswer !== null && norm(studentAnswer) === norm(correctAnswer);
      feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer}`;
    } else if (questionType === 'multiple-select') {
      const given = (Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]).map(a => norm(resolveOption(a, options)));
      const expected = (Array.isArray(correctAnswer) ? correctAnswer : (isBlank(correctAnswer) ? [] : [correctAnswer]))
        .map(a => norm(resolveOption(a, options)));
      const givenSet = new Set(given);
      const expectedSet = new Set(expected);
      isCorrect = expectedSet.size > 0 && givenSet.size === expectedSet.size && [...givenSet].every(x => expectedSet.has(x));
      feedback = isCorrect ? 'All correct selections!' : 'Some selections were incorrect.';
    } else if (questionType === 'short-answer' || questionType === 'essay') {
      const answerText = typeof studentAnswer === 'string' ? studentAnswer.trim() : String(studentAnswer);
      ({ isCorrect, partialCredit, feedback } = gradeTextAnswer(answerText, points));
    } else if (!isBlank(correctAnswer) && !Array.isArray(correctAnswer)) {
      // Unknown type with an answer key: compare directly instead of giving free points.
      isCorrect = norm(studentAnswer) === norm(correctAnswer);
      feedback = isCorrect ? 'Correct!' : `Incorrect. The correct answer is: ${correctAnswer}`;
    } else {
      const answerText = typeof studentAnswer === 'string' ? studentAnswer.trim() : JSON.stringify(studentAnswer);
      ({ isCorrect, partialCredit, feedback } = gradeTextAnswer(answerText, points));
    }

    const earnedPoints = isCorrect ? points : Math.min(partialCredit, points);
    score += earnedPoints;

    questionResults.push({
      questionId,
      correct: isCorrect,
      score: earnedPoints,
      maxScore: points,
      studentAnswer: studentAnswer === undefined ? null : studentAnswer,
      feedback,
      partialCredit: earnedPoints > 0 && !isCorrect
    });

    detailedAnswers.push({
      questionId,
      answer: studentAnswer,
      questionText: question.question || question.text,
      questionType
    });
  });

  const ratio = maxScore > 0 ? score / maxScore : 0;
  const percentage = Math.round(ratio * 100);
  // Decide pass/fail on the exact ratio so 49.6% does not round up to a pass.
  const isPassed = ratio * 100 >= PASS_THRESHOLD;

  return { score, maxScore, percentage, isPassed, questionResults, detailedAnswers };
}

// ---------------------------------------------------------------------------
// Feedback helpers (moved from api/assessment.js so both routes share them)
// ---------------------------------------------------------------------------

function findQuestion(questions, questionId) {
  return questions.find((q, i) => String(q.id !== undefined ? q.id : `q${i + 1}`) === String(questionId));
}

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
  }
  return `You scored ${percentage}% (${correctCount}/${totalCount} questions correct). This indicates significant gaps in understanding. I recommend reviewing the course materials thoroughly and seeking additional help from your instructor or study groups.`;
}

function identifyStrengths(questionResults, questions) {
  const strengths = [];
  const correctResults = questionResults.filter(r => r.correct);

  if (correctResults.length > 0) {
    const questionTypes = {};
    correctResults.forEach(result => {
      const question = findQuestion(questions, result.questionId);
      if (question) {
        const type = normalizeQuestionType(question.questionType || question.type);
        questionTypes[type] = (questionTypes[type] || 0) + 1;
      }
    });

    Object.entries(questionTypes).forEach(([type, count]) => {
      if (count >= 2) {
        strengths.push(`Strong performance in ${type.replace(/-/g, ' ')} questions`);
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
      const question = findQuestion(questions, result.questionId);
      if (question) {
        const type = normalizeQuestionType(question.questionType || question.type);
        questionTypes[type] = (questionTypes[type] || 0) + 1;
      }
    });

    Object.entries(questionTypes).forEach(([type, count]) => {
      if (count >= 2) {
        weaknesses.push(`Need improvement in ${type.replace(/-/g, ' ')} questions`);
      }
    });

    const unanswered = questionResults.filter(r => isBlank(r.studentAnswer));
    if (unanswered.length > 0) {
      weaknesses.push(`${unanswered.length} questions were left unanswered`);
    }

    const briefAnswers = questionResults.filter(r => {
      const question = findQuestion(questions, r.questionId);
      return question &&
        normalizeQuestionType(question.questionType || question.type) === 'short-answer' &&
        typeof r.studentAnswer === 'string' &&
        r.studentAnswer.trim().length > 0 &&
        r.studentAnswer.trim().length < 20;
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

    const types = questions.map(q => normalizeQuestionType(q.questionType || q.type));
    if (types.includes('short-answer')) {
      recommendations.push('Practice writing detailed explanations for conceptual questions');
    }
    if (types.includes('multiple-choice')) {
      recommendations.push('Study key definitions and factual knowledge');
    }
  }

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

  const missedTopics = new Set();
  questionResults.filter(r => !r.correct).forEach(result => {
    const question = findQuestion(questions, result.questionId);
    if (question && question.topic) {
      missedTopics.add(question.topic);
    }
  });
  recommendations.practiceAreas = Array.from(missedTopics);

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
}

/**
 * Build the feedback objects the results page renders
 * (submission.feedback / aiFeedback / personalizedRecommendations).
 */
function buildFeedback(grade, questions) {
  const qs = Array.isArray(questions) ? questions : [];
  try {
    const aiFeedback = {
      overallFeedback: generateOverallFeedback(grade.percentage, grade.questionResults),
      questionFeedback: grade.questionResults.reduce((acc, result) => {
        if (result.feedback) acc[result.questionId] = result.feedback;
        return acc;
      }, {}),
      strengths: identifyStrengths(grade.questionResults, qs),
      weaknesses: identifyWeaknesses(grade.questionResults, qs),
      studyRecommendations: generateStudyRecommendations(grade.questionResults, qs)
    };
    const personalizedRecommendations = generatePersonalizedRecommendations(grade.questionResults, qs, grade.percentage);
    return { aiFeedback, personalizedRecommendations };
  } catch (error) {
    console.warn('Feedback generation failed:', error.message);
    return {
      aiFeedback: {
        overallFeedback: `You scored ${grade.score}/${grade.maxScore} points (${grade.percentage}%). Keep practicing to improve your understanding.`,
        questionFeedback: {},
        error: error.message
      },
      personalizedRecommendations: null
    };
  }
}

module.exports = {
  PASS_THRESHOLD,
  normalizeQuestionType,
  gradeSubmission,
  buildFeedback,
  generateOverallFeedback,
  identifyStrengths,
  identifyWeaknesses,
  generateStudyRecommendations,
  generatePersonalizedRecommendations
};
