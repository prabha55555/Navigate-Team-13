/**
 * Plagiarism Detection Service
 * 
 * This service integrates with various plagiarism detection APIs:
 * - Turnitin API
 * - GPTZero API
 * - AWS Comprehend
 */

const axios = require('axios');
const AWS = require('aws-sdk');

class PlagiarismDetectionService {
  constructor(config = {}) {
    this.turnitinApiKey = config.turnitinApiKey || process.env.TURNITIN_API_KEY;
    this.gptzeroApiKey = config.gptzeroApiKey || process.env.GPTZERO_API_KEY;
    
    // AWS Configuration
    this.awsConfig = {
      accessKeyId: config.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      region: config.awsRegion || process.env.AWS_REGION || 'us-east-1'
    };
    
    // Initialize AWS Comprehend if AWS keys are available
    if (this.awsConfig.accessKeyId && this.awsConfig.secretAccessKey) {
      AWS.config.update(this.awsConfig);
      this.comprehend = new AWS.Comprehend();
    }
  }

  /**
   * Detect plagiarism using Turnitin API
   * @param {string} text - The text to check for plagiarism
   * @param {object} metadata - Additional metadata about the submission
   * @returns {Promise<object>} - Plagiarism detection results
   */
  async detectWithTurnitin(text, metadata = {}) {
    try {
      if (!this.turnitinApiKey) {
        throw new Error('Turnitin API key is not configured');
      }

      // This is a simplified example, actual Turnitin API integration would be more complex
      const response = await axios.post(
        'https://api.turnitin.com/v1/submissions',
        {
          content: text,
          title: metadata.title || 'Assessment Submission',
          metadata: {
            owner: metadata.studentId || 'unknown',
            course: metadata.courseId || 'unknown',
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.turnitinApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Process and return the results
      return {
        score: response.data.score || 0,
        source: 'turnitin',
        details: response.data.matches || {},
        isPlagiarized: (response.data.score || 0) > 30, // Threshold for flagging as plagiarized
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Turnitin plagiarism detection error:', error);
      throw new Error(`Plagiarism detection with Turnitin failed: ${error.message}`);
    }
  }

  /**
   * Detect AI-generated content using GPTZero API
   * @param {string} text - The text to check
   * @param {object} metadata - Additional metadata about the submission
   * @returns {Promise<object>} - AI detection results
   */
  async detectWithGPTZero(text, metadata = {}) {
    try {
      if (!this.gptzeroApiKey) {
        throw new Error('GPTZero API key is not configured');
      }

      const response = await axios.post(
        'https://api.gptzero.me/v1/predict',
        {
          document: text,
          documentType: 'essay'
        },
        {
          headers: {
            'X-Api-Key': this.gptzeroApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      // Process GPTZero response
      const aiProbability = response.data.documents?.[0]?.ai_probability || 0;
      
      return {
        score: aiProbability * 100, // Convert to 0-100 scale
        source: 'gptzero',
        details: {
          aiProbability: aiProbability,
          humanPerplexity: response.data.documents?.[0]?.human_perplexity || 0,
          burstiness: response.data.documents?.[0]?.burstiness || 0
        },
        isPlagiarized: aiProbability > 0.7, // Threshold for flagging as AI-generated
        timestamp: new Date()
      };
    } catch (error) {
      console.error('GPTZero detection error:', error);
      throw new Error(`AI detection with GPTZero failed: ${error.message}`);
    }
  }

  /**
   * Detect plagiarism using AWS Comprehend
   * @param {string} text - The text to check for plagiarism
   * @param {object} metadata - Additional metadata about the submission
   * @returns {Promise<object>} - Plagiarism detection results
   */
  async detectWithAWSComprehend(text, metadata = {}) {
    try {
      if (!this.comprehend) {
        throw new Error('AWS Comprehend is not configured properly');
      }

      // First, detect dominant language
      const languageParams = {
        Text: text.substring(0, 5000) // AWS Comprehend has limits on text size
      };
      
      const languageResult = await this.comprehend.detectDominantLanguage(languageParams).promise();
      const dominantLanguage = languageResult.Languages[0]?.LanguageCode || 'en';
      
      // Then, analyze entities and key phrases to check for unusual patterns
      const entityParams = {
        Text: text.substring(0, 5000),
        LanguageCode: dominantLanguage
      };
      
      const [entitiesResult, keyPhrasesResult, syntaxResult] = await Promise.all([
        this.comprehend.detectEntities(entityParams).promise(),
        this.comprehend.detectKeyPhrases(entityParams).promise(),
        this.comprehend.detectSyntax(entityParams).promise()
      ]);

      // Analyze the patterns in the text using AWS Comprehend results
      // This is a simplified approach; a real implementation would be more sophisticated
      const entityDensity = entitiesResult.Entities.length / text.length;
      const syntaxComplexity = syntaxResult.SyntaxTokens.filter(t => t.PartOfSpeech.Tag === 'VERB').length / 
                              syntaxResult.SyntaxTokens.length;
      
      // Create a score based on these metrics
      // Higher entity density and syntax complexity can sometimes indicate plagiarism
      const plagiarismScore = (entityDensity * 5000 + syntaxComplexity * 50) * 100;
      const normalizedScore = Math.min(100, Math.max(0, plagiarismScore));
      
      return {
        score: normalizedScore,
        source: 'aws-comprehend',
        details: {
          entityCount: entitiesResult.Entities.length,
          keyPhraseCount: keyPhrasesResult.KeyPhrases.length,
          syntaxComplexity: syntaxComplexity,
          entityDensity: entityDensity,
          dominantLanguage: dominantLanguage
        },
        isPlagiarized: normalizedScore > 70, // Threshold for flagging as potentially plagiarized
        timestamp: new Date()
      };
    } catch (error) {
      console.error('AWS Comprehend detection error:', error);
      throw new Error(`Plagiarism detection with AWS Comprehend failed: ${error.message}`);
    }
  }

  /**
   * Detect plagiarism using the specified service
   * @param {string} text - The text to check for plagiarism
   * @param {string} service - The service to use (turnitin, gptzero, aws-comprehend)
   * @param {object} metadata - Additional metadata about the submission
   * @returns {Promise<object>} - Plagiarism detection results
   */
  async detectPlagiarism(text, service = 'turnitin', metadata = {}) {
    switch (service.toLowerCase()) {
      case 'turnitin':
        return this.detectWithTurnitin(text, metadata);
      case 'gptzero':
        return this.detectWithGPTZero(text, metadata);
      case 'aws-comprehend':
        return this.detectWithAWSComprehend(text, metadata);
      default:
        throw new Error(`Unsupported plagiarism detection service: ${service}`);
    }
  }
}

module.exports = PlagiarismDetectionService;
