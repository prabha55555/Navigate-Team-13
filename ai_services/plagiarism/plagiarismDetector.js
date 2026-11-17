const axios = require('axios');
require('dotenv').config();
const geminiModels = require('../models/geminiModels');

// Every AI call is bounded so a slow/unreachable API cannot hang a submission.
const AI_REQUEST_TIMEOUT_MS = 15000;

// Log axios failures without dumping the request config (it contains the API key).
const describeError = (error) =>
  error && error.response ? `${error.message} (status ${error.response.status})` : (error && error.message) || String(error);

/**
 * Plagiarism Detection AI Service
 * 
 * This service detects potential plagiarism in student submissions by:
 * 1. Comparing text against previous submissions in the database
 * 2. Checking for common plagiarism patterns
 * 3. Detecting AI-generated content 
 * 4. Calculating similarity scores
 * 5. Providing evidence for flagged sections
 */
class PlagiarismDetector {
  constructor() {
    this.gemini = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/models',
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        key: process.env.GEMINI_API_KEY
      },
      timeout: AI_REQUEST_TIMEOUT_MS
    });

    // For embeddings and advanced analysis
    this.huggingFace = axios.create({
      baseURL: 'https://api-inference.huggingface.co/models',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: AI_REQUEST_TIMEOUT_MS
    });

    // Model names (the Gemini model is chosen per request by geminiModels, which
    // skips retired models such as the default 'gemini-pro')
    this.geminiEnabled = Boolean(process.env.GEMINI_API_KEY);
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

    // Similarity threshold for flagging content (0.0 to 1.0)
    this.similarityThreshold = 0.85;

    // Minimum content length to check for AI-generated text
    this.aiDetectionMinLength = 100;
  }

  /**
   * POST a generateContent request, moving to the next candidate model when
   * Gemini reports the model as retired/unknown.
   * @private
   */
  async _geminiGenerate(requestBody) {
    const body = {
      ...requestBody,
      generationConfig: {
        ...(requestBody.generationConfig || {}),
        // Thinking models spend part of the output budget on reasoning
        maxOutputTokens: Math.max(
          (requestBody.generationConfig && requestBody.generationConfig.maxOutputTokens) || 0,
          geminiModels.MIN_OUTPUT_TOKENS
        )
      }
    };
    let lastError;
    for (const model of geminiModels.candidateModels(process.env.GEMINI_MODEL)) {
      try {
        const response = await this.gemini.post(`/${model}:generateContent`, body);
        const parts = response.data && response.data.candidates && response.data.candidates[0] &&
          response.data.candidates[0].content && response.data.candidates[0].content.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
          throw new Error('Empty response from Gemini');
        }
        // Normalise so callers can keep reading parts[0].text
        const text = parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
        response.data.candidates[0].content.parts = [{ text }];
        return response;
      } catch (error) {
        lastError = error;
        const status = error.response && error.response.status;
        const apiMessage = error.response && error.response.data && error.response.data.error && error.response.data.error.message;
        if (geminiModels.isModelUnavailableError(status, apiMessage)) {
          geminiModels.markUnavailable(model);
          continue;
        }
        if (geminiModels.isTryNextModelError(status)) {
          continue; // rate limited / overloaded: try a model with its own quota
        }
        throw error;
      }
    }
    throw lastError || new Error('No Gemini model available');
  }

  /**
   * Main method to check a submission for plagiarism
   * 
   * @param {Object} submission - The student's submission to check
   * @param {Array} previousSubmissions - Previous submissions to compare against
   * @param {Object} assessment - The assessment details
   * @returns {Object} Plagiarism analysis results
   */
  async checkSubmission(submission, previousSubmissions = [], assessment) {
    console.log(`Checking submission ${submission.id} for plagiarism`);
    
    const results = {
      isPlagiarismDetected: false,
      overallSimilarityScore: 0,
      flaggedAnswers: [],
      aiGeneratedContentDetected: false,
      aiGeneratedContentScore: 0,
      aiGeneratedAnswers: [],
      potentialSources: [], // NEW: Potential sources of plagiarized content
      crossLanguageMatches: [] // NEW: Matches found across languages
    };
    
    const questions = (assessment && Array.isArray(assessment.questions)) ? assessment.questions : [];

    // Process each answer in the submission. The independent AI checks for an
    // answer (and the answers themselves) run concurrently instead of one
    // network round-trip after another.
    const analyzeAnswer = async (answer, i) => {
      const question = questions.find(q => String(q.id) === String(answer.questionId));
      const questionType = question ? String(question.questionType || question.type || '').toLowerCase() : '';

      // Skip non-text answers or very short answers
      if (!answer.answer ||
          typeof answer.answer !== 'string' ||
          answer.answer.length < 30 ||
          questionType === 'multiple-choice') {
        return;
      }

      const text = answer.answer;
      const [similarityResults, aiResults, sourceResults, crossLanguageResults] = await Promise.all([
        // Check for similarity with previous submissions
        this._checkForSimilarity(
          text,
          this._getPreviousAnswersForQuestion(previousSubmissions, answer.questionId)
        ),
        // For longer text, also check for AI-generated content
        text.length >= this.aiDetectionMinLength ? this._checkForAiGeneratedContent(text) : null,
        // Check for online sources
        text.length >= 100 ? this._checkForPotentialSources(text) : [],
        // Check for cross-language plagiarism
        text.length >= 200 ? this._checkForCrossLanguagePlagiarism(text) : null
      ]);

      // If similarity is above threshold, flag this answer
      if (similarityResults.similarityScore >= this.similarityThreshold) {
        results.isPlagiarismDetected = true;
        results.flaggedAnswers.push({
          questionId: answer.questionId,
          similarityScore: similarityResults.similarityScore,
          matchedSubmissionId: similarityResults.matchedSubmissionId,
          evidence: similarityResults.evidence,
          questionIndex: i
        });
      }

      if (aiResults) {
        const aiScore = Number(aiResults.score) || 0;
        if (aiScore >= 0.7) {  // 70% confidence threshold
          results.aiGeneratedContentDetected = true;
          results.aiGeneratedAnswers.push({
            questionId: answer.questionId,
            aiScore,
            evidence: aiResults.evidence,
            questionIndex: i
          });
        }

        // Update the overall AI score
        results.aiGeneratedContentScore = Math.max(results.aiGeneratedContentScore, aiScore);
      }

      if (Array.isArray(sourceResults) && sourceResults.length > 0) {
        results.potentialSources.push({
          questionId: answer.questionId,
          sources: sourceResults,
          questionIndex: i
        });
      }

      if (crossLanguageResults && crossLanguageResults.detected) {
        results.crossLanguageMatches.push({
          questionId: answer.questionId,
          originalLanguage: crossLanguageResults.originalLanguage,
          similarityScore: crossLanguageResults.similarityScore,
          evidence: crossLanguageResults.evidence,
          questionIndex: i
        });
      }
    };

    await Promise.all((submission.answers || []).map((answer, i) =>
      analyzeAnswer(answer, i).catch(error =>
        console.error(`Plagiarism analysis failed for question ${answer.questionId}:`, describeError(error))
      )
    ));
    
    // Calculate overall similarity if there are flagged answers
    if (results.flaggedAnswers.length > 0) {
      // Average of all flagged answers
      results.overallSimilarityScore = results.flaggedAnswers.reduce(
        (sum, item) => sum + item.similarityScore, 
        0
      ) / results.flaggedAnswers.length;
    }
    
    return results;
  }

  /**
   * Checks for similarity between current answer and previous submissions
   * @private
   */
  async _checkForSimilarity(currentAnswer, previousAnswers) {
    if (!previousAnswers || previousAnswers.length === 0) {
      return { 
        similarityScore: 0, 
        matchedSubmissionId: null,
        evidence: null 
      };
    }
    
    try {
      // For small sets of previous answers, we can check them individually
      if (previousAnswers.length <= 10) {
        return await this._directSimilarityCheck(currentAnswer, previousAnswers);
      } 
      // For larger sets, use embeddings for more efficient comparison
      else {
        return await this._embeddingBasedSimilarityCheck(currentAnswer, previousAnswers);
      }
    } catch (error) {
      console.error('Error in similarity check:', describeError(error));
      return { 
        similarityScore: 0, 
        matchedSubmissionId: null,
        evidence: null 
      };
    }
  }
  
  /**
   * Performs direct similarity comparison between texts
   * @private
   */
  async _directSimilarityCheck(currentAnswer, previousAnswers) {
    let highestSimilarity = 0;
    let matchedSubmissionId = null;
    let evidence = null;

    // Without a Gemini key, fall back to a local lexical comparison instead of
    // sending requests that are guaranteed to fail.
    if (!this.geminiEnabled) {
      for (const prev of previousAnswers) {
        const score = this._lexicalSimilarity(currentAnswer, prev.answer);
        if (score > highestSimilarity) {
          highestSimilarity = score;
          matchedSubmissionId = prev.submissionId;
          evidence = score >= 0.7 ? 'High word overlap with another submission' : null;
        }
      }
      return { similarityScore: highestSimilarity, matchedSubmissionId, evidence };
    }

    await Promise.all(previousAnswers.map(async (prev) => {
      try {
        const prompt = `
Compare these two student answers for similarity and potential plagiarism:

ANSWER 1: "${currentAnswer}"

ANSWER 2: "${prev.answer}"

Rate their similarity on a scale of 0.0 to 1.0, where:
- 0.0 means completely different
- 1.0 means identical or nearly identical content

If similarity is above 0.7, provide the specific sections that appear to be copied or highly similar.

Return your response as a JSON object with this structure:
{
  "similarityScore": [number between 0.0 and 1.0],
  "evidence": [if similarity > 0.7, provide the similar sections, otherwise null]
}`;

        // Request body for Gemini
        const requestBody = {
          contents: [
            {
              role: "user",
              parts: [{ text: `As a plagiarism detection expert, be objective and analytical: ${prompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            topP: 0.95,
            topK: 40
          }
        };

        const response = await this._geminiGenerate(requestBody);

        // Parse the response
        const content = response.data.candidates[0].content.parts[0].text;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        const resultJson = JSON.parse(content.substring(jsonStart, jsonEnd));
        
        const score = Number(resultJson.similarityScore) || 0;
        if (score > highestSimilarity) {
          highestSimilarity = score;
          matchedSubmissionId = prev.submissionId;
          evidence = resultJson.evidence;
        }
      } catch (error) {
        console.error('Error comparing answers:', describeError(error));
      }
    }));

    return {
      similarityScore: highestSimilarity,
      matchedSubmissionId,
      evidence
    };
  }

  /**
   * Dice coefficient over the sets of significant words in two texts (0..1).
   * @private
   */
  _lexicalSimilarity(textA, textB) {
    const words = (text) => new Set(String(text || '').toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const a = words(textA);
    const b = words(textB);
    if (a.size === 0 || b.size === 0) return 0;
    let common = 0;
    a.forEach(w => { if (b.has(w)) common++; });
    return (2 * common) / (a.size + b.size);
  }
  
  /**
   * Uses embeddings for more efficient similarity comparison
   * @private
   */
  async _embeddingBasedSimilarityCheck(currentAnswer, previousAnswers) {
    try {
      if (!process.env.HUGGINGFACE_API_KEY) {
        throw new Error('HUGGINGFACE_API_KEY not configured');
      }
      // Get embedding for current answer using Hugging Face
      const currentEmbeddingResponse = await this.huggingFace.post(
        `/${this.embeddingModel}`,
        { inputs: currentAnswer }
      );
      
      const currentEmbedding = currentEmbeddingResponse.data;
      
      // Process previous answers in batches to avoid hitting rate limits
      const batchSize = 20;
      let highestSimilarity = 0;
      let mostSimilarAnswer = null;
      
      for (let i = 0; i < previousAnswers.length; i += batchSize) {
        const batch = previousAnswers.slice(i, i + batchSize);
        
        // Get embeddings for batch
        const batchPromises = batch.map(a => 
          this.huggingFace.post(`/${this.embeddingModel}`, { inputs: a.answer })
            .then(response => response.data)
        );
        
        const embeddings = await Promise.all(batchPromises);
        
        // Calculate similarity scores for each answer in batch
        for (let j = 0; j < batch.length; j++) {
          const similarity = this._cosineSimilarity(currentEmbedding, embeddings[j]);
          
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            mostSimilarAnswer = batch[j];
          }
        }
      }
      
      // If we found a high similarity, get specific evidence
      if (highestSimilarity >= this.similarityThreshold && mostSimilarAnswer) {
        // Get detailed evidence using direct check
        const detailedCheck = await this._directSimilarityCheck(
          currentAnswer, 
          [mostSimilarAnswer]
        );
        
        return {
          similarityScore: highestSimilarity,
          matchedSubmissionId: mostSimilarAnswer.submissionId,
          evidence: detailedCheck.evidence
        };
      }
      
      return {
        similarityScore: highestSimilarity,
        matchedSubmissionId: mostSimilarAnswer ? mostSimilarAnswer.submissionId : null,
        evidence: null
      };
    } catch (error) {
      console.error('Error in embedding-based similarity check:', describeError(error));
      // Fall back to a local lexical comparison rather than reporting "no match".
      let best = { similarityScore: 0, matchedSubmissionId: null, evidence: null };
      for (const prev of previousAnswers) {
        const score = this._lexicalSimilarity(currentAnswer, prev.answer);
        if (score > best.similarityScore) {
          best = { similarityScore: score, matchedSubmissionId: prev.submissionId, evidence: null };
        }
      }
      return best;
    }
  }
  
  /**
   * Calculate cosine similarity between two embedding vectors
   * @private
   */
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * Detects if content was likely generated by an AI
   * @private
   */
  async _checkForAiGeneratedContent(text) {
    if (!this.geminiEnabled) {
      return { score: 0, evidence: null };
    }
    try {
      const prompt = `
Analyze this text and determine if it was likely generated by an AI (like ChatGPT, Bard, Claude, etc):

TEXT: "${text.substring(0, 2000)}" ${text.length > 2000 ? '...(text truncated)' : ''}

Consider these factors:
1. Writing style and pattern consistency
2. Formulaic structures common in AI outputs
3. Lack of personal perspective or experience
4. Generic phrasing and predictable transitions
5. Overall fluency that seems artificial

Return your analysis as a JSON object with:
{
  "score": [number between 0.0 and 1.0 indicating likelihood of AI-generation],
  "evidence": [specific examples from the text supporting your conclusion]
}`;

      // Request body for Gemini
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: `As an expert at detecting AI-generated content: ${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await this._geminiGenerate(requestBody);

      // Parse the response
      const content = response.data.candidates[0].content.parts[0].text;
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > 0) {
        const resultJson = JSON.parse(content.substring(jsonStart, jsonEnd));
        return resultJson;
      } else {
        console.error('Could not parse AI detection response:', content);
        return { score: 0, evidence: null };
      }
    } catch (error) {
      console.error('Error in AI generation check:', describeError(error));
      return { score: 0, evidence: null };
    }
  }

  /**
   * NEW: Checks for potential online sources of content
   * @private
   */
  async _checkForPotentialSources(text) {
    if (!this.geminiEnabled) {
      return [];
    }
    try {
      const prompt = `
Analyze this text and determine if it appears to be copied or closely paraphrased from common online sources:

TEXT: "${text.substring(0, 1500)}" ${text.length > 1500 ? '...(text truncated)' : ''}

If the content appears to be potentially plagiarized, identify:
1. What specific online sources it might be from (e.g., Wikipedia, academic journals, textbooks, etc.)
2. Why you believe it may be from these sources (distinctive phrasing, specialized knowledge, etc.)
3. Confidence level in your assessment (low, medium, high)

Return your analysis as a JSON array with potential sources:
[
  {
    "sourceType": "source type (e.g., 'Wikipedia', 'Academic Journal', etc.)",
    "confidence": [number between 0.0 and 1.0],
    "reasoning": "explanation of why this seems like a potential source",
    "distinctivePhrases": ["phrase 1", "phrase 2"]
  }
]

If you cannot identify any specific potential sources, return an empty array: []
`;

      // Request body for Gemini
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: `As an expert at identifying potential sources of plagiarized content: ${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await this._geminiGenerate(requestBody);

      // Parse the response
      const content = response.data.candidates[0].content.parts[0].text;
      
      try {
        const jsonStartIndex = content.indexOf('[');
        const jsonEndIndex = content.lastIndexOf(']') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > 0) {
          const resultJson = JSON.parse(content.substring(jsonStartIndex, jsonEndIndex));
          
          // Filter to only include sources with medium to high confidence
          return Array.isArray(resultJson)
            ? resultJson.filter(source => source && source.confidence >= 0.65)
            : [];
        } else {
          return [];
        }
      } catch (parseError) {
        console.error('Error parsing source detection response:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error in source detection:', describeError(error));
      return [];
    }
  }

  /**
   * NEW: Checks for cross-language plagiarism
   * @private
   */
  async _checkForCrossLanguagePlagiarism(text) {
    if (!this.geminiEnabled) {
      return { detected: false, similarityScore: 0, originalLanguage: "unknown", evidence: null };
    }
    try {
      // Analyze the text to determine if it appears to be a translation
      const prompt = `
Analyze this text and determine if it shows signs of being translated from another language:

TEXT: "${text.substring(0, 1500)}" ${text.length > 1500 ? '...(text truncated)' : ''}

Look for:
1. Unusual phrasing or word choices that suggest translation
2. Grammar patterns typical of specific languages
3. Direct translation artifacts
4. Cultural references that might indicate original language

Return your analysis as a JSON object:
{
  "detected": true/false,
  "originalLanguage": "language name or 'unknown'",
  "similarityScore": [number between 0.0 and 1.0 indicating confidence],
  "evidence": "specific examples from the text showing translation artifacts"
}
`;

      // Request body for Gemini
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: `As an expert linguist specializing in identifying cross-language translation artifacts: ${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await this._geminiGenerate(requestBody);

      // Parse the response
      const content = response.data.candidates[0].content.parts[0].text;
      
      try {
        const jsonStartIndex = content.indexOf('{');
        const jsonEndIndex = content.lastIndexOf('}') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > 0) {
          return JSON.parse(content.substring(jsonStartIndex, jsonEndIndex));
        } else {
          return { detected: false, similarityScore: 0, originalLanguage: "unknown", evidence: null };
        }
      } catch (parseError) {
        console.error('Error parsing cross-language plagiarism response:', parseError);
        return { detected: false, similarityScore: 0, originalLanguage: "unknown", evidence: null };
      }
    } catch (error) {
      console.error('Error in cross-language plagiarism detection:', describeError(error));
      return { detected: false, similarityScore: 0, originalLanguage: "unknown", evidence: null };
    }
  }

  /**
   * Generate an educational report about plagiarism findings
   * 
   * @param {Object} plagiarismResults - Results from the checkSubmission method
   * @returns {Object} Detailed educational report
   */
  async generateEducationalReport(plagiarismResults) {
    try {
      if (!plagiarismResults) {
        return {
          summary: "No plagiarism analysis results available.",
          educationalGuidance: [],
          resources: []
        };
      }
      if (!this.geminiEnabled) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const prompt = `
Create an educational report about potential academic integrity issues based on these plagiarism detection results:

${JSON.stringify(plagiarismResults, null, 2)}

The report should:
1. Provide a clear, educational summary of the findings (not accusatory, but informative)
2. Offer 3-5 specific pieces of guidance for improving academic writing and citation practices
3. Suggest 2-3 resources for learning proper citation and academic integrity principles

Format your response as a JSON object:
{
  "summary": "clear summary of the findings",
  "educationalGuidance": ["guidance point 1", "guidance point 2", ...],
  "resources": [
    { "title": "Resource 1", "description": "Brief description" },
    { "title": "Resource 2", "description": "Brief description" }
  ]
}
`;

      // Request body for Gemini
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: `As an academic integrity educator who helps students understand and improve their academic writing: ${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
          topP: 0.95,
          topK: 40
        }
      };

      const response = await this._geminiGenerate(requestBody);

      // Parse the response
      const content = response.data.candidates[0].content.parts[0].text;
      const jsonStartIndex = content.indexOf('{');
      const jsonEndIndex = content.lastIndexOf('}') + 1;
      
      if (jsonStartIndex >= 0 && jsonEndIndex > 0) {
        return JSON.parse(content.substring(jsonStartIndex, jsonEndIndex));
      } else {
        throw new Error('Could not parse report response');
      }
    } catch (error) {
      console.error('Error generating educational report:', describeError(error));
      return {
        summary: "An error occurred while generating the educational report.",
        educationalGuidance: [
          "Always cite your sources when using information from elsewhere",
          "Use quotation marks for direct quotes and provide citations",
          "Paraphrase in your own words and still cite the original source"
        ],
        resources: [
          { title: "Citation Guide", description: "Learn proper citation formats" },
          { title: "Academic Integrity Handbook", description: "Guide to academic integrity principles" }
        ]
      };
    }
  }

  /**
   * Helper method to get previous answers for a specific question
   * @private
   */
  _getPreviousAnswersForQuestion(previousSubmissions, questionId) {
    const answers = [];
    
    previousSubmissions.forEach(submission => {
      const matchingAnswer = submission.answers.find(a => a.questionId === questionId);
      if (matchingAnswer) {
        answers.push({
          submissionId: submission.id,
          answer: matchingAnswer.answer
        });
      }
    });
    
    return answers;
  }
}

module.exports = new PlagiarismDetector();