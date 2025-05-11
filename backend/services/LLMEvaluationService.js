/**
 * LLM Evaluation Service
 * 
 * This service uses LLMs to evaluate student submissions based on three approaches:
 * 1. Exact matching - Keyword and phrase matching against model answers
 * 2. Semantic similarity - Using embeddings to measure similarity to model answers
 * 3. Reasoning checks - Evaluating the logical structure and reasoning of answers
 */

const axios = require('axios');

class LLMEvaluationService {
  constructor(config = {}) {
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.useModel = config.model || 'gpt-4';
    this.embeddingModel = config.embeddingModel || 'text-embedding-ada-002';
  }

  /**
   * Evaluate a student submission using exact matching (keywords and phrases)
   * @param {string} studentAnswer - The student's answer
   * @param {string} modelAnswer - The model answer to compare against
   * @param {object} options - Additional evaluation options
   * @returns {Promise<object>} - Evaluation results with score and explanation
   */
  async evaluateExactMatching(studentAnswer, modelAnswer, options = {}) {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is not configured');
      }

      // Extract key phrases and concepts from the model answer
      const keyPhrases = await this.extractKeyPhrases(modelAnswer);
      
      // Count how many key phrases appear in the student's answer
      let matchCount = 0;
      let matchDetails = [];
      
      for (const phrase of keyPhrases) {
        // Case-insensitive search for exact phrase
        const regex = new RegExp(`\\b${phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(studentAnswer)) {
          matchCount++;
          matchDetails.push(phrase);
        }
      }
      
      // Calculate score based on percentage of key phrases included
      const score = (keyPhrases.length > 0) ? (matchCount / keyPhrases.length) * 100 : 0;
      
      return {
        score: Math.min(100, score), // Cap at 100
        matchCount,
        totalKeyPhrases: keyPhrases.length,
        matchedPhrases: matchDetails,
        explanation: this.generateExactMatchExplanation(matchCount, keyPhrases.length, matchDetails)
      };
    } catch (error) {
      console.error('Exact matching evaluation error:', error);
      throw new Error(`Exact matching evaluation failed: ${error.message}`);
    }
  }

  /**
   * Extract key phrases from a model answer
   * @param {string} modelAnswer - The model answer text
   * @returns {Promise<string[]>} - Array of key phrases
   */
  async extractKeyPhrases(modelAnswer) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert educational assessment system. Extract the 5-10 most important key phrases or concepts from the following model answer. Return only the list of phrases, separated by newlines, without numbering or any other text.'
            },
            {
              role: 'user',
              content: modelAnswer
            }
          ],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Parse the response to get the list of key phrases
      const phraseText = response.data.choices[0].message.content.trim();
      return phraseText.split('\n').map(phrase => phrase.trim()).filter(phrase => phrase.length > 0);
    } catch (error) {
      console.error('Error extracting key phrases:', error);
      throw new Error(`Key phrase extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate explanation for exact matching results
   * @param {number} matchCount - Number of matched phrases
   * @param {number} totalPhrases - Total number of key phrases
   * @param {string[]} matchedPhrases - List of matched phrases
   * @returns {string} - Explanation text
   */
  generateExactMatchExplanation(matchCount, totalPhrases, matchedPhrases) {
    const percentage = (totalPhrases > 0) ? (matchCount / totalPhrases) * 100 : 0;
    
    let explanation = `Your answer includes ${matchCount} out of ${totalPhrases} key concepts (${percentage.toFixed(1)}%).`;
    
    if (matchCount > 0) {
      explanation += `\n\nYou correctly addressed the following key points:\n- ${matchedPhrases.join('\n- ')}`;
      
      if (matchCount < totalPhrases) {
        explanation += '\n\nConsider including more key concepts in your answer for a higher score.';
      }
    } else {
      explanation += '\n\nYour answer doesn\'t contain any of the expected key concepts. Review the material and try to incorporate the important points in your response.';
    }
    
    return explanation;
  }

  /**
   * Evaluate a student submission using semantic similarity with embeddings
   * @param {string} studentAnswer - The student's answer
   * @param {string} modelAnswer - The model answer to compare against
   * @param {object} options - Additional evaluation options
   * @returns {Promise<object>} - Evaluation results with similarity score
   */
  async evaluateSemanticSimilarity(studentAnswer, modelAnswer, options = {}) {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is not configured');
      }

      // Generate embeddings for both answers
      const [studentEmbedding, modelEmbedding] = await Promise.all([
        this.getEmbedding(studentAnswer),
        this.getEmbedding(modelAnswer)
      ]);
      
      // Calculate cosine similarity between the embeddings
      const similarity = this.calculateCosineSimilarity(studentEmbedding, modelEmbedding);
      
      // Convert similarity (-1 to 1 range) to a 0-100 score
      const score = ((similarity + 1) / 2) * 100;
      
      return {
        score: score,
        similarityIndex: similarity,
        explanation: this.generateSimilarityExplanation(similarity)
      };
    } catch (error) {
      console.error('Semantic similarity evaluation error:', error);
      throw new Error(`Semantic similarity evaluation failed: ${error.message}`);
    }
  }

  /**
   * Get embedding vector for a text
   * @param {string} text - The text to get embedding for
   * @returns {Promise<number[]>} - Embedding vector
   */
  async getEmbedding(text) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.embeddingModel,
          input: text
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error getting embedding:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vectorA - First embedding vector
   * @param {number[]} vectorB - Second embedding vector
   * @returns {number} - Cosine similarity (-1 to 1)
   */
  calculateCosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vector dimensions do not match');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0; // Handle zero vectors
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate explanation for semantic similarity results
   * @param {number} similarity - Cosine similarity value
   * @returns {string} - Explanation text
   */
  generateSimilarityExplanation(similarity) {
    // Convert similarity (-1 to 1) to percentage (0-100)
    const percentage = ((similarity + 1) / 2) * 100;
    
    if (percentage >= 90) {
      return `Your answer shows excellent semantic similarity (${percentage.toFixed(1)}%) to the expected concepts. You've demonstrated strong understanding of the subject matter.`;
    } else if (percentage >= 70) {
      return `Your answer shows good semantic similarity (${percentage.toFixed(1)}%) to the expected concepts. You've captured many of the important ideas, though there's room for more precision.`;
    } else if (percentage >= 50) {
      return `Your answer shows moderate semantic similarity (${percentage.toFixed(1)}%) to the expected concepts. While you've touched on some relevant ideas, there are important concepts that could be better addressed.`;
    } else {
      return `Your answer shows low semantic similarity (${percentage.toFixed(1)}%) to the expected concepts. Consider reviewing the material and focusing on understanding the core concepts.`;
    }
  }

  /**
   * Evaluate reasoning and logical structure of a student submission
   * @param {string} studentAnswer - The student's answer
   * @param {string} modelAnswer - The model answer to compare against
   * @param {string} questionText - The original question text
   * @param {object} options - Additional evaluation options
   * @returns {Promise<object>} - Evaluation results with reasoning score
   */
  async evaluateReasoning(studentAnswer, modelAnswer, questionText, options = {}) {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is not configured');
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.useModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert educational assessment system. Evaluate the logical reasoning, structure, and argumentation in a student's answer. Focus on:
              1. Logical coherence and flow of ideas
              2. Supporting evidence and examples
              3. Critical thinking and depth of analysis
              4. Addressing all aspects of the question
              
              Score the reasoning on a scale of 0-100 and provide detailed feedback.`
            },
            {
              role: 'user',
              content: `Question: ${questionText}
              
              Model Answer: ${modelAnswer}
              
              Student Answer: ${studentAnswer}
              
              Evaluate the reasoning quality of the student's answer compared to the model answer.`
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Parse the JSON response
      const evaluationResult = JSON.parse(response.data.choices[0].message.content);
      
      return {
        score: evaluationResult.score || 0,
        strengths: evaluationResult.strengths || [],
        weaknesses: evaluationResult.weaknesses || [],
        improvement: evaluationResult.improvement_suggestions || [],
        explanation: evaluationResult.detailed_feedback || 'No detailed feedback provided.'
      };
    } catch (error) {
      console.error('Reasoning evaluation error:', error);
      throw new Error(`Reasoning evaluation failed: ${error.message}`);
    }
  }

  /**
   * Perform the complete LLM-based evaluation using all three approaches
   * @param {string} studentAnswer - The student's answer
   * @param {string} modelAnswer - The model answer to compare against
   * @param {string} questionText - The original question text
   * @param {object} weights - Weights for different evaluation components
   * @returns {Promise<object>} - Combined evaluation results
   */
  async evaluateSubmission(studentAnswer, modelAnswer, questionText, weights = { exactMatch: 0.3, semanticSimilarity: 0.4, reasoning: 0.3 }) {
    try {
      // Perform all three evaluations
      const [exactMatchResults, semanticResults, reasoningResults] = await Promise.all([
        this.evaluateExactMatching(studentAnswer, modelAnswer),
        this.evaluateSemanticSimilarity(studentAnswer, modelAnswer),
        this.evaluateReasoning(studentAnswer, modelAnswer, questionText)
      ]);
      
      // Calculate weighted overall score
      const overallScore = 
        (exactMatchResults.score * weights.exactMatch) +
        (semanticResults.score * weights.semanticSimilarity) +
        (reasoningResults.score * weights.reasoning);
      
      return {
        exactMatchScore: exactMatchResults.score,
        semanticSimilarityScore: semanticResults.score,
        reasoningCheckScore: reasoningResults.score,
        overallScore: overallScore,
        details: {
          exactMatch: exactMatchResults,
          semanticSimilarity: semanticResults,
          reasoning: reasoningResults
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('LLM evaluation error:', error);
      throw new Error(`LLM evaluation failed: ${error.message}`);
    }
  }
}

module.exports = LLMEvaluationService;
