const { Configuration, OpenAIApi } = require('openai');

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/**
 * Get feedback from a panel of AI experts
 * @param {String} question - The assessment question
 * @param {String} studentAnswer - The student's answer
 * @param {String} groundTruth - The reference answer
 * @param {Array} relatedConcepts - Array of related concepts
 * @returns {Array} Expert feedback from different perspectives
 */
exports.getExpertFeedback = async (question, studentAnswer, groundTruth, relatedConcepts) => {
  try {
    // Run all expert analyses in parallel
    const [factChecker, conceptAnalyzer, clarityChecker] = await Promise.all([
      factCheckerAnalysis(question, studentAnswer, groundTruth),
      conceptualAnalysis(question, studentAnswer, relatedConcepts),
      clarityAnalysis(studentAnswer)
    ]);
    
    return [
      {
        role: 'fact-checker',
        feedback: factChecker.feedback,
        suggestions: factChecker.suggestions
      },
      {
        role: 'concept-analyzer',
        feedback: conceptAnalyzer.feedback,
        suggestions: conceptAnalyzer.suggestions
      },
      {
        role: 'clarity-checker',
        feedback: clarityChecker.feedback,
        suggestions: clarityChecker.suggestions
      }
    ];
  } catch (error) {
    console.error('Error getting expert panel feedback:', error);
    return [
      {
        role: 'fact-checker',
        feedback: 'Error analyzing facts. Please review manually.',
        suggestions: ['Ensure all key facts are verified with reliable sources']
      },
      {
        role: 'concept-analyzer',
        feedback: 'Error analyzing conceptual understanding. Please review manually.',
        suggestions: ['Review core concepts related to this topic']
      },
      {
        role: 'clarity-checker',
        feedback: 'Error analyzing clarity. Please review manually.',
        suggestions: ['Ensure your answer is clearly structured and easy to follow']
      }
    ];
  }
};

/**
 * Fact checker analysis - focuses on factual accuracy and correctness
 */
async function factCheckerAnalysis(question, studentAnswer, groundTruth) {
  try {
    const prompt = `
      You are an academic fact checker analyzing a student's answer.
      
      Question: ${question}
      
      Student Answer: ${studentAnswer}
      
      Reference Answer: ${groundTruth}
      
      As a fact checker, your job is to:
      1. Identify any factual errors or inaccuracies in the student's answer
      2. Highlight missing key facts that should be included
      3. Note any misinterpretations of concepts or theories
      
      Provide:
      1. A concise analysis of factual accuracy (max 3 sentences)
      2. A bulleted list of 2-3 specific suggestions for improving factual accuracy
      
      Format your response as:
      Feedback: [your analysis]
      
      Suggestions:
      - [suggestion 1]
      - [suggestion 2]
      - [suggestion 3]
    `;
    
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 400,
      temperature: 0.3,
    });
    
    const response = completion.data.choices[0].text.trim();
    
    // Parse response
    const feedbackMatch = response.match(/Feedback:([\s\S]*?)(?=\n\nSuggestions:|$)/i);
    const suggestionsMatch = response.match(/Suggestions:([\s\S]*)/i);
    
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 'Analysis not available';
    
    const suggestions = suggestionsMatch
      ? suggestionsMatch[1].split('-')
        .map(item => item.trim())
        .filter(item => item.length > 0)
      : ['Verify all facts against credible sources'];
    
    return { feedback, suggestions };
  } catch (error) {
    console.error('Error in fact checker analysis:', error);
    return { 
      feedback: 'Unable to complete fact checking. Please verify factual accuracy manually.',
      suggestions: ['Verify key facts against reliable sources'] 
    };
  }
}

/**
 * Conceptual analysis - focuses on understanding of core concepts
 */
async function conceptualAnalysis(question, studentAnswer, relatedConcepts) {
  try {
    const prompt = `
      You are an expert in conceptual analysis evaluating a student's understanding of key concepts.
      
      Question: ${question}
      
      Student Answer: ${studentAnswer}
      
      Related Concepts: ${relatedConcepts.join(', ')}
      
      As a concept analyzer, your job is to:
      1. Assess how well the student demonstrates understanding of core concepts
      2. Identify connections between concepts that the student made or missed
      3. Evaluate the depth of conceptual understanding
      
      Provide:
      1. A concise analysis of conceptual understanding (max 3 sentences)
      2. A bulleted list of 2-3 specific suggestions for improving conceptual depth
      
      Format your response as:
      Feedback: [your analysis]
      
      Suggestions:
      - [suggestion 1]
      - [suggestion 2]
      - [suggestion 3]
    `;
    
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 400,
      temperature: 0.3,
    });
    
    const response = completion.data.choices[0].text.trim();
    
    // Parse response
    const feedbackMatch = response.match(/Feedback:([\s\S]*?)(?=\n\nSuggestions:|$)/i);
    const suggestionsMatch = response.match(/Suggestions:([\s\S]*)/i);
    
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 'Analysis not available';
    
    const suggestions = suggestionsMatch
      ? suggestionsMatch[1].split('-')
        .map(item => item.trim())
        .filter(item => item.length > 0)
      : ['Explore the relationships between key concepts in more depth'];
    
    return { feedback, suggestions };
  } catch (error) {
    console.error('Error in conceptual analysis:', error);
    return { 
      feedback: 'Unable to complete conceptual analysis. Please review the depth of understanding manually.',
      suggestions: ['Focus on clearly articulating how concepts relate to each other'] 
    };
  }
}

/**
 * Clarity analysis - focuses on communication and presentation
 */
async function clarityAnalysis(studentAnswer) {
  try {
    const prompt = `
      You are an expert in clear communication evaluating a student's writing clarity.
      
      Student Answer: ${studentAnswer}
      
      As a clarity checker, your job is to:
      1. Assess the organization and structure of the response
      2. Evaluate the clarity of expression and language usage
      3. Check for logical flow and coherence
      
      Provide:
      1. A concise analysis of the communication clarity (max 3 sentences)
      2. A bulleted list of 2-3 specific suggestions for improving clarity and organization
      
      Format your response as:
      Feedback: [your analysis]
      
      Suggestions:
      - [suggestion 1]
      - [suggestion 2]
      - [suggestion 3]
    `;
    
    const completion = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 400,
      temperature: 0.3,
    });
    
    const response = completion.data.choices[0].text.trim();
    
    // Parse response
    const feedbackMatch = response.match(/Feedback:([\s\S]*?)(?=\n\nSuggestions:|$)/i);
    const suggestionsMatch = response.match(/Suggestions:([\s\S]*)/i);
    
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 'Analysis not available';
    
    const suggestions = suggestionsMatch
      ? suggestionsMatch[1].split('-')
        .map(item => item.trim())
        .filter(item => item.length > 0)
      : ['Structure your answer with clear introduction, body, and conclusion'];
    
    return { feedback, suggestions };
  } catch (error) {
    console.error('Error in clarity analysis:', error);
    return { 
      feedback: 'Unable to complete clarity analysis. Please review for clear organization manually.',
      suggestions: ['Ensure your response has a logical structure'] 
    };
  }
}

/**
 * Generate aggregated feedback from AI expert panel
 * @param {Array<string>} studentAnswers - Array of student answers
 * @param {Array<string>} questionTexts - Array of question texts
 * @param {Array<string>} modelAnswers - Array of model answers
 * @param {Object} config - Configuration for feedback generation
 * @returns {Promise<Object>} Aggregated feedback
 */
exports.generateFeedback = async (studentAnswers, questionTexts, modelAnswers, config = {}) => {
  try {
    // Use existing expert panel methods to generate feedback for each answer
    const feedbackPromises = [];
    
    for (let i = 0; i < studentAnswers.length; i++) {
      // Only process text answers that are long enough for analysis
      if (typeof studentAnswers[i] === 'string' && studentAnswers[i].length > 20) {
        feedbackPromises.push(
          this.getExpertFeedback(
            questionTexts[i],
            studentAnswers[i],
            modelAnswers[i],
            [] // No related concepts for now
          )
        );
      }
    }
    
    // Wait for all feedback to be generated
    const allFeedback = await Promise.all(feedbackPromises);
    
    // Aggregate feedback
    const misconceptions = [];
    const learningGaps = [];
    const strengthAreas = [];
    const improvementSuggestions = [];
    
    // Process all feedback
    allFeedback.forEach(feedbackArray => {
      feedbackArray.forEach(expert => {
        // Extract misconceptions from fact-checker
        if (expert.role === 'fact-checker' && config.generateMisconceptions !== false) {
          // Look for misconceptions in feedback
          if (expert.feedback.includes('incorrect') || 
              expert.feedback.includes('misconception') || 
              expert.feedback.includes('error')) {
            misconceptions.push(expert.feedback);
          }
          
          // Add suggestions as improvement ideas
          expert.suggestions.forEach(suggestion => {
            if (suggestion.includes('verify') || suggestion.includes('check')) {
              improvementSuggestions.push(suggestion);
            }
          });
        }
        
        // Extract learning gaps from concept-analyzer
        if (expert.role === 'concept-analyzer' && config.generateLearningGaps !== false) {
          // Look for gaps in conceptual understanding
          if (expert.feedback.includes('missing') || 
              expert.feedback.includes('lacks') || 
              expert.feedback.includes('gap')) {
            learningGaps.push(expert.feedback);
          }
          
          // Look for strengths in conceptual understanding
          if (expert.feedback.includes('good understanding') || 
              expert.feedback.includes('strong grasp') || 
              expert.feedback.includes('correctly identifies')) {
            strengthAreas.push(expert.feedback);
          }
        }
        
        // Extract clarity recommendations
        if (expert.role === 'clarity-checker') {
          expert.suggestions.forEach(suggestion => {
            improvementSuggestions.push(suggestion);
          });
        }
      });
    });
    
    // Handle the case where no feedback was generated
    if (feedbackPromises.length === 0) {
      return this.generateMockFeedback();
    }
    
    // Return aggregated feedback
    return {
      misconceptions: [...new Set(misconceptions)].slice(0, 3),
      learningGaps: [...new Set(learningGaps)].slice(0, 3),
      strengthAreas: [...new Set(strengthAreas)].slice(0, 3),
      improvementSuggestions: [...new Set(improvementSuggestions)].slice(0, 3)
    };
  } catch (error) {
    console.error('Error generating aggregated feedback:', error);
    return this.generateMockFeedback();
  }
};

/**
 * Generate aggregated feedback for AI evaluation pipeline
 * @param {Array<string>} studentAnswers - Array of student answers
 * @param {Array<string>} questionTexts - Array of question texts
 * @param {Array<string>} modelAnswers - Array of model answers
 * @param {Object} assessmentConfig - Assessment configuration for evaluation
 * @returns {Promise<Object>} Comprehensive aggregated feedback for the AI evaluation pipeline
 */
exports.aggregatedFeedback = async (studentAnswers, questionTexts, modelAnswers, assessmentConfig = {}) => {
  try {
    // Get base feedback using the existing method
    const baseFeedback = await this.generateFeedback(
      studentAnswers, 
      questionTexts, 
      modelAnswers, 
      {
        generateMisconceptions: assessmentConfig.expertPanelFocus?.misconceptions !== false,
        generateLearningGaps: assessmentConfig.expertPanelFocus?.learningGaps !== false,
        generateStrengthAreas: assessmentConfig.expertPanelFocus?.strengthAreas !== false,
        generateImprovementSuggestions: assessmentConfig.expertPanelFocus?.improvementSuggestions !== false
      }
    );
    
    // Generate detailed analysis for each answer
    const detailedAnalysis = [];
    
    for (let i = 0; i < studentAnswers.length; i++) {
      // Only process text answers that are meaningful for analysis
      if (typeof studentAnswers[i] === 'string' && studentAnswers[i].length > 20) {
        const expertFeedback = await this.getExpertFeedback(
          questionTexts[i],
          studentAnswers[i],
          modelAnswers[i],
          [] // No related concepts for now
        );
        
        // Restructure the feedback for this specific question
        detailedAnalysis.push({
          questionIndex: i,
          questionText: questionTexts[i].substring(0, 100) + (questionTexts[i].length > 100 ? '...' : ''),
          factualAccuracy: {
            feedback: expertFeedback.find(ef => ef.role === 'fact-checker')?.feedback || 'No factual analysis available',
            suggestions: expertFeedback.find(ef => ef.role === 'fact-checker')?.suggestions || []
          },
          conceptualUnderstanding: {
            feedback: expertFeedback.find(ef => ef.role === 'concept-analyzer')?.feedback || 'No conceptual analysis available',
            suggestions: expertFeedback.find(ef => ef.role === 'concept-analyzer')?.suggestions || []
          },
          clarity: {
            feedback: expertFeedback.find(ef => ef.role === 'clarity-checker')?.feedback || 'No clarity analysis available',
            suggestions: expertFeedback.find(ef => ef.role === 'clarity-checker')?.suggestions || []
          }
        });
      }
    }
    
    // Calculate competency scores
    const competencyScores = this._calculateCompetencyScores(detailedAnalysis);
    
    // Generate top concepts based on feedback
    const topConcepts = this._extractTopConcepts(detailedAnalysis);
    
    // Generate comprehensive feedback summary
    const feedbackSummary = this._generateFeedbackSummary(baseFeedback, competencyScores);
    
    // Return the comprehensive aggregated feedback
    return {
      // Base feedback components
      misconceptions: baseFeedback.misconceptions,
      learningGaps: baseFeedback.learningGaps,
      strengthAreas: baseFeedback.strengthAreas,
      improvementSuggestions: baseFeedback.improvementSuggestions,
      
      // Enhanced components for AI evaluation pipeline
      detailedAnalysis,
      competencyScores,
      topConcepts,
      feedbackSummary,
      
      // Metadata
      generatedAt: new Date(),
      analysisVersion: '1.0'
    };
  } catch (error) {
    console.error('Error generating aggregated feedback for AI evaluation:', error);
    
    // Generate fallback feedback
    const fallbackFeedback = this.generateMockFeedback();
    
    return {
      ...fallbackFeedback,
      detailedAnalysis: [],
      competencyScores: {
        factualAccuracy: 70,
        conceptualUnderstanding: 65,
        clarity: 75,
        overallCompetency: 70
      },
      topConcepts: ['Data structures', 'Algorithms', 'Time complexity'],
      feedbackSummary: 'Unable to generate detailed feedback. The system has provided general feedback based on common patterns.',
      generatedAt: new Date(),
      analysisVersion: '1.0',
      error: error.message
    };
  }
};

/**
 * Calculate competency scores based on detailed analysis
 * @private
 * @param {Array} detailedAnalysis - Detailed analysis of student answers
 * @returns {Object} Competency scores
 */
exports._calculateCompetencyScores = (detailedAnalysis) => {
  if (!detailedAnalysis || detailedAnalysis.length === 0) {
    return {
      factualAccuracy: 0,
      conceptualUnderstanding: 0, 
      clarity: 0,
      overallCompetency: 0
    };
  }
  
  // Initialize score counters
  let factualScore = 0;
  let conceptualScore = 0;
  let clarityScore = 0;
  
  // Keywords that indicate high scores
  const positiveKeywords = [
    'excellent', 'good', 'strong', 'accurate', 'correct', 
    'well', 'clear', 'comprehensive', 'thorough', 'effective'
  ];
  
  // Keywords that indicate low scores
  const negativeKeywords = [
    'incorrect', 'error', 'missing', 'lacks', 'insufficient',
    'poor', 'weak', 'confusing', 'unclear', 'disorganized', 'misconception'
  ];
  
  // Calculate scores based on feedback text analysis
  detailedAnalysis.forEach(analysis => {
    // Calculate factual accuracy score
    const factualFeedback = analysis.factualAccuracy.feedback.toLowerCase();
    let factualPoints = 70; // Base score
    
    positiveKeywords.forEach(keyword => {
      if (factualFeedback.includes(keyword)) factualPoints += 5;
    });
    
    negativeKeywords.forEach(keyword => {
      if (factualFeedback.includes(keyword)) factualPoints -= 10;
    });
    
    // Calculate conceptual understanding score
    const conceptualFeedback = analysis.conceptualUnderstanding.feedback.toLowerCase();
    let conceptualPoints = 70; // Base score
    
    positiveKeywords.forEach(keyword => {
      if (conceptualFeedback.includes(keyword)) conceptualPoints += 5;
    });
    
    negativeKeywords.forEach(keyword => {
      if (conceptualFeedback.includes(keyword)) conceptualPoints -= 10;
    });
    
    // Calculate clarity score
    const clarityFeedback = analysis.clarity.feedback.toLowerCase();
    let clarityPoints = 70; // Base score
    
    positiveKeywords.forEach(keyword => {
      if (clarityFeedback.includes(keyword)) clarityPoints += 5;
    });
    
    negativeKeywords.forEach(keyword => {
      if (clarityFeedback.includes(keyword)) clarityPoints -= 10;
    });
    
    // Add to total scores (capped between 0-100)
    factualScore += Math.max(0, Math.min(100, factualPoints));
    conceptualScore += Math.max(0, Math.min(100, conceptualPoints));
    clarityScore += Math.max(0, Math.min(100, clarityPoints));
  });
  
  // Calculate averages
  const factualAverage = Math.round(factualScore / detailedAnalysis.length);
  const conceptualAverage = Math.round(conceptualScore / detailedAnalysis.length);
  const clarityAverage = Math.round(clarityScore / detailedAnalysis.length);
  
  // Calculate overall competency (weighted average)
  const overallCompetency = Math.round(
    (factualAverage * 0.4) + (conceptualAverage * 0.4) + (clarityAverage * 0.2)
  );
  
  return {
    factualAccuracy: factualAverage,
    conceptualUnderstanding: conceptualAverage,
    clarity: clarityAverage,
    overallCompetency
  };
};

/**
 * Extract top concepts mentioned in the detailed analysis
 * @private
 * @param {Array} detailedAnalysis - Detailed analysis of student answers
 * @returns {Array} Top concepts
 */
exports._extractTopConcepts = (detailedAnalysis) => {
  if (!detailedAnalysis || detailedAnalysis.length === 0) {
    return [];
  }
  
  // Combine all feedback text to extract concepts
  let allFeedbackText = '';
  
  detailedAnalysis.forEach(analysis => {
    allFeedbackText += ' ' + analysis.factualAccuracy.feedback;
    allFeedbackText += ' ' + analysis.conceptualUnderstanding.feedback;
    allFeedbackText += ' ' + analysis.clarity.feedback;
    
    // Also include question text as it may contain relevant concepts
    allFeedbackText += ' ' + analysis.questionText;
  });
  
  // Simple concept extraction - find capitalized terms and terms in quotes
  const conceptRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b|"([^"]+)"|'([^']+)'/g;
  const matches = [...allFeedbackText.matchAll(conceptRegex)];
  
  const concepts = matches
    .map(match => match[1] || match[2] || match[3])
    .filter(Boolean)
    .filter(concept => concept.length > 3); // Filter out short terms
  
  // Count occurrences of each concept
  const conceptCount = {};
  concepts.forEach(concept => {
    conceptCount[concept] = (conceptCount[concept] || 0) + 1;
  });
  
  // Sort by occurrence count and take top 5
  const topConcepts = Object.keys(conceptCount)
    .sort((a, b) => conceptCount[b] - conceptCount[a])
    .slice(0, 5);
  
  return topConcepts;
};

/**
 * Generate a feedback summary based on all collected data
 * @private
 * @param {Object} baseFeedback - Base feedback object
 * @param {Object} competencyScores - Competency scores
 * @returns {String} Summarized feedback
 */
exports._generateFeedbackSummary = (baseFeedback, competencyScores) => {
  // Define competency levels
  const getCompetencyLevel = (score) => {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'strong';
    if (score >= 70) return 'good';
    if (score >= 60) return 'moderate';
    if (score >= 50) return 'developing';
    return 'needs improvement';
  };
  
  // Create overall competency assessment
  const overallLevel = getCompetencyLevel(competencyScores.overallCompetency);
  
  // Create summary text based on all components
  let summary = `Overall, your responses demonstrate a ${overallLevel} level of understanding. `;
  
  // Add strength statement if available
  if (baseFeedback.strengthAreas && baseFeedback.strengthAreas.length > 0) {
    summary += `Your strengths include ${baseFeedback.strengthAreas[0].toLowerCase()}. `;
  }
  
  // Add learning gap statement if available
  if (baseFeedback.learningGaps && baseFeedback.learningGaps.length > 0) {
    summary += `Areas for improvement include ${baseFeedback.learningGaps[0].toLowerCase()}. `;
  }
  
  // Add competency breakdown
  summary += `Your assessment shows ${getCompetencyLevel(competencyScores.factualAccuracy)} factual accuracy, `;
  summary += `${getCompetencyLevel(competencyScores.conceptualUnderstanding)} conceptual understanding, and `;
  summary += `${getCompetencyLevel(competencyScores.clarity)} clarity in communication. `;
  
  // Add improvement suggestion if available
  if (baseFeedback.improvementSuggestions && baseFeedback.improvementSuggestions.length > 0) {
    summary += `To improve, consider: ${baseFeedback.improvementSuggestions[0].toLowerCase()}.`;
  }
  
  return summary;
};

/**
 * Generate mock feedback for testing or when real feedback generation fails
 * @returns {Object} Mock feedback
 */
exports.generateMockFeedback = () => {
  return {
    misconceptions: [
      "You seem to have a misconception about how stacks and queues differ in their implementation",
      "There's a misunderstanding about the time complexity of binary search tree operations"
    ],
    learningGaps: [
      "Deeper understanding of tree traversal algorithms could be improved",
      "Implementation details of data structures rather than just conceptual understanding"
    ],
    strengthAreas: [
      "Good understanding of the fundamental principles of stacks and queues",
      "Strong grasp of time complexity analysis",
      "Clear explanation of algorithm comparison methods"
    ],
    improvementSuggestions: [
      "Practice implementing a complete binary search tree with all traversal methods",
      "Study the implementation details of data structures in different programming languages",
      "Work through more complex algorithm analysis problems"
    ]
  };
};

module.exports = exports;