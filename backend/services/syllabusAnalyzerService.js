/**
 * Service layer for syllabus analysis functionality
 * This file bridges the backend API with the AI service implementation
 */

const fs = require('fs');
const path = require('path');

// Import the core syllabusAnalyzer implementation from the AI services
const syllabusAnalyzer = require('../../ai_services/assessment/syllabusAnalyzer');

// Lazily loaded parsers (they live in backend/node_modules). pdf-parse is
// required via its lib entry: its index.js runs a debug routine that reads a
// test PDF from disk when it thinks it is the main module.
let pdfParse = null;
let mammoth = null;
const getPdfParse = () => (pdfParse = pdfParse || require('pdf-parse/lib/pdf-parse.js'));
const getMammoth = () => (mammoth = mammoth || require('mammoth'));

const MAX_SYLLABUS_CACHE_ENTRIES = 200;

/**
 * Pull runs of printable text out of a legacy binary .doc file. mammoth only
 * understands .docx, so this best-effort scrape is the fallback for .doc.
 */
function scrapePrintableText(buffer) {
  const latin = buffer.toString('latin1').match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
  const utf16 = buffer.toString('utf16le').match(/[\x20-\x7E\r\n\t]{4,}/g) || [];
  const pick = utf16.join(' ').length > latin.join(' ').length ? utf16 : latin;
  return pick.join('\n').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Extract text from an uploaded file
 * @param {Object} file - Uploaded file object from multer (disk storage)
 * @returns {Promise<string>} - Extracted text content
 */
exports.extractTextFromFile = async (file) => {
  if (!file || !file.path) {
    throw new Error('No file provided');
  }
  try {
    console.log(`Extracting text from file: ${file.originalname} (${file.mimetype})`);
    const ext = path.extname(file.originalname || file.path).toLowerCase();
    const buffer = await fs.promises.readFile(file.path);
    let text = '';

    if (ext === '.pdf') {
      const result = await getPdfParse()(buffer);
      text = result.text || '';
    } else if (ext === '.docx') {
      const result = await getMammoth().extractRawText({ buffer });
      text = result.value || '';
    } else if (ext === '.doc') {
      try {
        const result = await getMammoth().extractRawText({ buffer });
        text = result.value || '';
      } catch (docError) {
        text = scrapePrintableText(buffer);
      }
    } else {
      text = buffer.toString('utf8').replace(/^﻿/, '');
    }

    text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) {
      throw new Error('No readable text found in the file (scanned/image-only documents are not supported)');
    }
    return text;
  } catch (error) {
    console.error('Error in extractTextFromFile service:', error.message);
    throw new Error(`Failed to extract text from file: ${error.message}`);
  } finally {
    // The upload is only needed for extraction; don't let uploads/ grow forever.
    fs.promises.unlink(file.path).catch(() => {});
  }
};

/**
 * Analyze syllabus content
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} - Structured syllabus analysis
 */
exports.analyzeSyllabus = async (syllabusContent, options = {}) => {
  try {
    return await syllabusAnalyzer.analyzeSyllabus(syllabusContent, options);
  } catch (error) {
    console.error('Error in analyzeSyllabus service:', error);
    throw new Error(`Failed to analyze syllabus: ${error.message}`);
  }
};

/**
 * Extract topics from syllabus content
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @returns {Promise<Object>} - Object containing the extracted topics
 */
exports.extractTopicsFromSyllabus = async (syllabusContent) => {
  try {
    // Use the syllabusAnalyzer to extract topics
    const topics = await syllabusAnalyzer.extractTopicsFromSyllabus(syllabusContent);
    return topics;
  } catch (error) {
    console.error('Error in extractTopicsFromSyllabus service:', error);
    throw new Error(`Failed to extract topics from syllabus: ${error.message}`);
  }
};

/**
 * Get list of analyzed syllabi
 * @returns {Promise<Array>} - List of syllabi
 */
exports.getSyllabiList = async () => {
  try {
    // List the analyses that were actually stored, so every id returned here
    // can be fetched from GET /syllabus/:id (the AI-service list was mock data
    // whose ids always 404ed).
    const cache = global.syllabusCache || {};
    return Object.entries(cache)
      .map(([id, entry]) => ({
        id,
        courseTitle: entry.analysis?.basicInfo?.courseTitle || 'Untitled Course',
        courseCode: entry.analysis?.basicInfo?.courseCode || '',
        analyzedAt: (entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp)).toISOString()
      }))
      .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
  } catch (error) {
    console.error('Error in getSyllabiList service:', error);
    throw new Error(`Failed to get syllabi list: ${error.message}`);
  }
};

/**
 * Generate a quick quiz based on syllabus analysis
 * @param {Object} syllabusAnalysis - The analyzed syllabus data
 * @param {Object} quizParameters - Parameters for quiz generation
 * @returns {Promise<Object>} - The generated quiz
 */
exports.generateQuickQuiz = async (syllabusAnalysis, quizParameters = {}) => {
  try {
    return await syllabusAnalyzer.generateQuickQuiz(syllabusAnalysis, quizParameters);
  } catch (error) {
    console.error('Error in generateQuickQuiz service:', error);
    throw new Error(`Failed to generate quiz: ${error.message}`);
  }
};

/**
 * Generate assessment based on syllabus analysis
 * @param {Object} syllabusAnalysis - The analyzed syllabus data
 * @param {Object} preferences - Assessment generation preferences
 * @returns {Promise<Object>} - The generated assessment
 */
exports.generateAssessment = async (syllabusAnalysis, preferences = {}) => {
  try {
    return await syllabusAnalyzer.generateAssessment(syllabusAnalysis, preferences);
  } catch (error) {
    console.error('Error in generateAssessment service:', error);
    throw new Error(`Failed to generate assessment: ${error.message}`);
  }
};

/**
 * Store syllabus analysis in cache or database
 * @param {string} id - Identifier for the syllabus analysis
 * @param {Object} analysis - The syllabus analysis object
 * @returns {Promise<boolean>} - Success indicator
 */
exports.storeSyllabusAnalysis = async (id, analysis) => {
  try {
    // This would normally save to a database
    // For now, we'll use a simple in-memory storage
    global.syllabusCache = global.syllabusCache || {};
    global.syllabusCache[id] = {
      analysis,
      timestamp: new Date()
    };
    // Bound memory: drop the oldest analyses beyond the limit
    const ids = Object.keys(global.syllabusCache)
      .sort((a, b) => global.syllabusCache[a].timestamp - global.syllabusCache[b].timestamp);
    for (let i = 0; i < ids.length - MAX_SYLLABUS_CACHE_ENTRIES; i++) {
      delete global.syllabusCache[ids[i]];
    }
    return true;
  } catch (error) {
    console.error('Error in storeSyllabusAnalysis service:', error);
    return false;
  }
};

/**
 * Retrieve syllabus analysis from cache or database
 * @param {string} id - Identifier for the syllabus analysis
 * @returns {Promise<Object|null>} - The syllabus analysis or null if not found
 */
exports.getSyllabusAnalysis = async (id) => {
  try {
    // This would normally retrieve from a database
    // For now, we'll use a simple in-memory storage
    global.syllabusCache = global.syllabusCache || {};
    return global.syllabusCache[id]?.analysis || null;
  } catch (error) {
    console.error('Error in getSyllabusAnalysis service:', error);
    return null;
  }
};

module.exports = exports;