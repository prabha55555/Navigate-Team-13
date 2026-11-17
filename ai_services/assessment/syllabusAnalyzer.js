const axios = require('axios');
const transformersModel = require('../models/transformersModel');
require('dotenv').config();

const DEFAULT_TOPICS = ['Course Fundamentals', 'Key Concepts', 'Practical Applications'];

/**
 * Normalize question type spellings ("Multiple Choice", "True/False",
 * "short answer", ...) to the canonical ids the grader and UI use.
 */
function normalizeQuestionType(type) {
    const t = String(type || '').trim().toLowerCase().replace(/[\s_/]+/g, '-');
    if (!t) return 'multiple-choice';
    if (t.includes('select')) return 'multiple-select';
    if (t.includes('multiple') || t.includes('choice') || t === 'mcq') return 'multiple-choice';
    if (t.includes('true') || t.includes('false')) return 'true-false';
    if (t.includes('essay') || t.includes('long')) return 'essay';
    if (t.includes('short') || t.includes('answer')) return 'short-answer';
    return t;
}

/**
 * Read the answer key from a generated question block. Models write it many
 * ways ("Correct: B", "Correct Answer: **False**", "Correct answer - (T)"), and
 * a missed match used to silently default every true/false key to "True".
 * Returns 'True' / 'False' / a letter 'A'-'D', or null when no key is present.
 */
function extractCorrectKey(block) {
    const cleaned = String(block || '').replace(/[*_`]/g, '');
    const m = cleaned.match(/Correct(?:\s+Answer)?\s*[:\-–=]\s*["'(\[]?\s*(True|False|T|F|[A-D])(?![A-Za-z])/i);
    if (!m) return null;
    const token = m[1].toUpperCase();
    if (token === 'TRUE' || token === 'T') return 'True';
    if (token === 'FALSE' || token === 'F') return 'False';
    return token;
}

/** Map a parsed key onto a true/false answer ("A"/"B" mean the True/False options). */
function toTrueFalseKey(key) {
    if (key === 'True' || key === 'A') return 'True';
    if (key === 'False' || key === 'B') return 'False';
    return null;
}

/**
 * Generate a quick quiz based on syllabus analysis using Gemini
 * @param {Object} syllabusAnalysis - The analyzed syllabus data
 * @param {Object} quizParameters - Parameters for quiz generation
 * @returns {Object} - The generated quiz
 */
async function generateQuickQuiz(syllabusAnalysis, quizParameters = {}) {
    try {
        console.log('=== GENERATING QUICK QUIZ WITH GEMINI ===');
        
        // Extract key syllabus information with defensive coding
        const basicInfo = syllabusAnalysis.basicInfo || { 
            courseTitle: "Course", 
            courseCode: "101", 
            academicLevel: "Undergraduate"
        };
        
        const learningOutcomes = syllabusAnalysis.learningOutcomes || {};
        const courseTopics = (Array.isArray(learningOutcomes.keyTopics) && learningOutcomes.keyTopics.length > 0)
            ? learningOutcomes.keyTopics.slice(0, 5)
            : DEFAULT_TOPICS;

        // Apply default parameters with fallbacks
        const {
            questionCount = 5,
            difficulty = 'mixed',
            topicFocus = [],
            timeLimit = 15
        } = quizParameters;
        // "True/False" arrives as "true/false"; normalize so the prompt checks below match
        const questionTypes = (Array.isArray(quizParameters.questionTypes) && quizParameters.questionTypes.length > 0
            ? quizParameters.questionTypes
            : ['multiple-choice', 'true-false']).map(normalizeQuestionType);

        // Select topics to cover
        const topicsToUse = Array.isArray(topicFocus) && topicFocus.length > 0
            ? topicFocus.slice(0, 5)
            : courseTopics.slice(0, Math.min(5, courseTopics.length));
        
        // Build a structured prompt for Gemini
        const prompt = `
Generate a quiz with ${questionCount} questions about ${topicsToUse.join(', ')}.

Course: ${basicInfo.courseTitle}
Level: ${basicInfo.academicLevel}
Difficulty: ${difficulty}
Types: ${questionTypes.join(', ')}

Each question should have this format:
Q: [Question text]
Type: [question type]
${questionTypes.includes('multiple-choice') ? 'A: [Option A]\nB: [Option B]\nC: [Option C]\nD: [Option D]\nCorrect: [A/B/C/D]' : ''}
${questionTypes.includes('true-false') ? 'Options: True/False\nCorrect: [True/False]' : ''}
Points: [points]
Topic: [related topic]
END

Generate exactly ${questionCount} questions, one after another.`;
        
        // Use transformers model with Gemini
        const response = await transformersModel.createChatCompletion(
            'You are creating a quiz for students.',
            prompt,
            {
                temperature: 0.8,
                maxTokens: 2048,
                taskType: 'quiz',
                modelName: 'gemini-pro' // Use Gemini
            }
        );
        
        // Parse the Gemini response
        try {
            // Parse the response into structured quiz data
            const questions = [];
            // Split on END lines only (not on "END" inside words) and drop any preamble
            const questionBlocks = String(response || '')
                .split(/^\s*\**END\**\s*$/m)
                .filter(block => /Q:/.test(block));

            for (let i = 0; i < Math.min(questionCount, questionBlocks.length); i++) {
                const block = questionBlocks[i];

                // Extract question components (line based, so a missing line
                // does not make the neighbouring field fail to match)
                const questionMatch = block.match(/Q:\s*(.+?)(?=\n\s*Type:|$)/s);
                const typeMatch = block.match(/Type:\s*([^\n]+)/i);
                const topicMatch = block.match(/Topic:\s*([^\n]+)/i);
                const pointsMatch = block.match(/Points:\s*(\d+)/i);

                // Extract multiple choice options if present
                const optionsA = block.match(/^\s*A[:.)]\s*(.+)$/m);
                const optionsB = block.match(/^\s*B[:.)]\s*(.+)$/m);
                const optionsC = block.match(/^\s*C[:.)]\s*(.+)$/m);
                const optionsD = block.match(/^\s*D[:.)]\s*(.+)$/m);
                const correctKey = extractCorrectKey(block);

                if (questionMatch) {
                    const questionType = typeMatch ? typeMatch[1].trim().toLowerCase() : 'multiple-choice';
                    let options = [];
                    let correctAnswer = '';

                    if (questionType.includes('multiple') || questionType.includes('choice')) {
                        options = [
                            optionsA ? optionsA[1].trim() : 'Option A',
                            optionsB ? optionsB[1].trim() : 'Option B',
                            optionsC ? optionsC[1].trim() : 'Option C',
                            optionsD ? optionsD[1].trim() : 'Option D'
                        ];

                        const letterIndex = correctKey && /^[A-D]$/.test(correctKey) ? correctKey.charCodeAt(0) - 65 : -1;
                        if (letterIndex < 0) {
                            console.warn(`Quick quiz: no answer key found for question ${i + 1}; defaulting to option A`);
                        }
                        correctAnswer = options[letterIndex >= 0 ? letterIndex : 0];
                    } else if (questionType.includes('true') || questionType.includes('false')) {
                        options = ['True', 'False'];
                        correctAnswer = toTrueFalseKey(correctKey);
                        if (!correctAnswer) {
                            console.warn(`Quick quiz: no true/false key found for question ${i + 1}; defaulting to True`);
                            correctAnswer = 'True';
                        }
                    } else if (questionType.includes('short') || questionType.includes('answer')) {
                        // Short answer questions - provide a proper text answer
                        options = []; // Short answer questions don't have options
                        
                        // Look for a sample answer in the block, or create a default one
                        const sampleAnswerMatch = block.match(/Sample\s+Answer:\s*(.*?)(?=\nPoints:|Topic:|$)/i);
                        const topicForAnswer = topicMatch ? topicMatch[1].trim() : topicsToUse[i % topicsToUse.length];
                        
                        correctAnswer = sampleAnswerMatch 
                            ? sampleAnswerMatch[1].trim() 
                            : `A comprehensive answer about ${topicForAnswer} should explain the key concepts and demonstrate understanding of the main principles.`;
                    }
                    
                    questions.push({
                        id: `q${questions.length + 1}`,
                        question: questionMatch[1].trim(),
                        // Canonical type ("multiple choice" -> "multiple-choice") so grading and the UI recognise it
                        questionType: normalizeQuestionType(questionType),
                        options: options,
                        correctAnswer: correctAnswer,
                        topic: topicMatch ? topicMatch[1].trim() : topicsToUse[i % topicsToUse.length],
                        points: pointsMatch ? parseInt(pointsMatch[1], 10) || 1 : 1,
                        difficulty: difficulty,
                        explanation: "Explanation will be provided after submission."
                    });
                }
            }

            const finalQuestions = questions.length > 0 ? questions : generateFallbackQuestions(topicsToUse, questionCount);

            // Create a complete quiz structure even if parsing was incomplete
            const quiz = {
                title: `${basicInfo.courseTitle} Quick Quiz`,
                description: `A quick assessment covering ${topicsToUse.join(', ')}`,
                totalPoints: finalQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
                timeLimit: timeLimit,
                questions: finalQuestions,
                generatedAt: new Date().toISOString(),
                generatedBy: 'gemini',
                courseInfo: {
                    title: basicInfo.courseTitle,
                    code: basicInfo.courseCode,
                    level: basicInfo.academicLevel
                }
            };
            
            console.log(`Successfully generated quiz with ${quiz.questions.length} questions using Gemini`);
            return quiz;
        } catch (error) {
            console.error('Error parsing quiz response from Gemini:', error);
            
            // Generate fallback questions directly
            const fallbackQuestions = generateFallbackQuestions(topicsToUse, questionCount);
            return {
                title: `${basicInfo.courseTitle} Quick Quiz`,
                description: `A quick assessment covering ${topicsToUse.join(', ')}`,
                totalPoints: fallbackQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
                timeLimit: timeLimit,
                questions: fallbackQuestions,
                generatedAt: new Date().toISOString(),
                generatedBy: 'gemini-fallback',
                courseInfo: {
                    title: basicInfo.courseTitle,
                    code: basicInfo.courseCode,
                    level: basicInfo.academicLevel
                }
            };
        }
    } catch (error) {
        console.error('Error generating quiz with Gemini:', error);
        throw new Error(`Failed to generate quiz with Gemini: ${error.message}`);
    }
}

/**
 * Generate fallback questions when parsing fails
 * @param {Array} topics - Available topics
 * @param {Number} count - Number of questions to generate
 * @returns {Array} - Array of question objects
 */
function generateFallbackQuestions(topics, count) {
    const questions = [];
    // Avoid "What is the main concept in undefined?" when no topics were extracted
    topics = Array.isArray(topics) && topics.length > 0 ? topics : DEFAULT_TOPICS;
    count = Number(count) > 0 ? Number(count) : 5;

    const questionTemplates = [
        topic => `What is the main concept in ${topic}?`,
        topic => `Which of the following is NOT related to ${topic}?`,
        topic => `True or False: ${topic} is fundamental to understanding this course.`,
        topic => `What is the relationship between ${topic} and ${topics[Math.floor(Math.random() * topics.length)]}?`,
        topic => `Which best describes the purpose of studying ${topic}?`
    ];
    
    for (let i = 0; i < count; i++) {
        const topic = topics[i % topics.length];
        const templateIndex = i % questionTemplates.length;
        const questionFn = questionTemplates[templateIndex];
        
        if (templateIndex <= 1) {
            // Multiple choice
            questions.push({
                id: `q${i+1}`,
                question: questionFn(topic),
                questionType: 'multiple-choice',
                options: [
                    `${topic} concept 1`,
                    `${topic} concept 2`,
                    `${topic} concept 3`,
                    'None of the above'
                ],
                correctAnswer: `${topic} concept 1`,
                topic: topic,
                points: 1,
                difficulty: ['easy', 'medium', 'hard'][i % 3],
                explanation: `This relates to fundamental concepts in ${topic}.`
            });
        } else if (templateIndex === 2) {
            // True/False
            questions.push({
                id: `q${i+1}`,
                question: questionFn(topic),
                questionType: 'true-false',
                options: ['True', 'False'],
                correctAnswer: 'True',
                topic: topic,
                points: 1,
                difficulty: 'easy',
                explanation: `${topic} is indeed a core concept in this course.`
            });
        } else {
            // Short answer - Fix: Using a proper text answer instead of true/false
            questions.push({
                id: `q${i+1}`,
                question: questionFn(topic),
                questionType: 'short-answer',
                options: [], // Short answer questions don't have options
                topic: topic,
                points: 2,
                difficulty: 'medium',
                explanation: `This tests understanding of ${topic} in context.`,
                correctAnswer: `A comprehensive answer should explain the key aspects of ${topic} and demonstrate understanding of its applications.`
            });
        }
    }
    
    return questions;
}

/**
 * Analyzes a syllabus document to extract key information
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @param {Object} options - Analysis options
 * @returns {Object} - Structured syllabus analysis
 */
async function analyzeSyllabus(syllabusContent, options = {}) {
    try {
        console.log('Analyzing syllabus content...');
        
        if (!syllabusContent || syllabusContent.trim().length < 50) {
            throw new Error('Syllabus content is too short for meaningful analysis');
        }
        
        // Default options
        const {
            extractTopics = true,
            extractSchedule = true,
            extractPolicies = true
        } = options;
        
        // Always use transformer models
        let modelPreference = options.modelPreference || 'transformer';
        
        // Build prompt for the model to extract structured information
        const prompt = `
Extract and analyze the following syllabus content:

${syllabusContent.substring(0, 8000)}

Please extract and return a JSON object with the following structure:
{
  "basicInfo": {
    "courseTitle": "",
    "courseCode": "",
    "instructorName": "",
    "term": "",
    "academicLevel": ""
  },
  "learningOutcomes": {
    "objectives": [],
    "keyTopics": [],
    "skillsGained": []
  },
  "schedule": {
    "topics": [],
    "majorAssignments": []
  },
  "assessmentStructure": {
    "gradingScale": "",
    "assessmentBreakdown": []
  },
  "policies": [],
  "assessmentPatterns": {
    "patterns": [
      {
        "name": "",
        "description": "",
        "structure": [{ "questionType": "Multiple Choice", "count": 5, "pointsPerQuestion": 1 }],
        "totalPoints": 0,
        "estimatedTime": 0,
        "difficulty": "Beginner"
      }
    ]
  }
}

For assessmentPatterns, suggest 2-3 assessment patterns that suit this course's assessments
(questionType is one of: Multiple Choice, True/False, Short Answer, Essay).

Focus on accurately extracting course content, learning outcomes, and assessment information.
If certain sections aren't present in the syllabus, leave them as empty arrays or empty strings.
`;

        // Use Gemini or Hugging Face fallback model
        // Update model name to use the latest available model
        console.log('Using Gemini model for syllabus analysis');
        const response = await transformersModel.createChatCompletion(
            'You are a helpful system for analyzing educational syllabi.',
            prompt,
            {
                temperature: 0.3,
                maxTokens: 4000,
                taskType: 'extraction',
                modelName: 'gemini-1.5-flash' // Updated to use the latest available model
            }
        );
        
        // Extract JSON from response
        let analysisResult;
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            try {
                analysisResult = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('Error parsing JSON from model response:', parseError);
                // If we can't parse JSON, create a basic structure
                analysisResult = generateBasicSyllabusStructure(syllabusContent);
            }
        } else {
            console.log('No JSON structure found in response, generating basic structure');
            analysisResult = generateBasicSyllabusStructure(syllabusContent);
        }
        
        // Validate and clean the analysis result
        if (!analysisResult || !analysisResult.basicInfo) {
            throw new Error('Failed to extract basic information from syllabus');
        }
        
        // The pattern selector reads assessmentPatterns.patterns; it was never returned
        analysisResult.assessmentPatterns = normalizeAssessmentPatterns(analysisResult.assessmentPatterns);

        // Add metadata
        analysisResult.metadata = {
            analyzedAt: new Date().toISOString(),
            modelUsed: 'gemini-1.5-flash',
            contentLength: syllabusContent.length
        };
        
        console.log('Syllabus analysis complete');
        return analysisResult;
    } catch (error) {
        console.error('Error analyzing syllabus:', error);
        console.log('Generating default syllabus analysis structure');
        return generateBasicSyllabusStructure(syllabusContent);
    }
}

/**
 * Generate a basic syllabus structure when JSON parsing fails
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @returns {Object} - Basic syllabus analysis structure
 */
function generateBasicSyllabusStructure(syllabusContent) {
    console.log('Generating basic syllabus structure');
    
    // Try to extract some basic information from the syllabus content
    const courseMatch = syllabusContent.match(/course:?\s*([^\n]+)/i);
    const codeMatch = syllabusContent.match(/code:?\s*([^\n]+)/i);
    const instructorMatch = syllabusContent.match(/instructor:?\s*([^\n]+)/i);
    const termMatch = syllabusContent.match(/term:?\s*([^\n]+)/i);
    
    // Extract topic keywords by looking for bullet points or numbered lists
    const topics = [];
    const topicMatches = syllabusContent.match(/[-•*]\s*([^\n]+)/g) || 
                        syllabusContent.match(/\d+\.\s*([^\n]+)/g) || [];
    
    // Process up to 5 topics
    for (let i = 0; i < Math.min(topicMatches.length, 5); i++) {
        // Clean up the topic text
        const topic = topicMatches[i].replace(/[-•*\d.]\s*/, '').trim();
        if (topic && topic.length > 3) {
            topics.push(topic);
        }
    }
    
    // If we couldn't extract topics, provide some defaults
    if (topics.length === 0) {
        topics.push('Course Fundamentals');
        topics.push('Key Concepts');
        topics.push('Practical Applications');
    }
    
    // Create basic syllabus analysis structure
    return {
        basicInfo: {
            courseTitle: courseMatch ? courseMatch[1].trim() : "Untitled Course",
            courseCode: codeMatch ? codeMatch[1].trim() : "N/A",
            instructorName: instructorMatch ? instructorMatch[1].trim() : "Instructor",
            term: termMatch ? termMatch[1].trim() : "Current Term",
            academicLevel: syllabusContent.includes('graduate') ? "Graduate" : "Undergraduate"
        },
        learningOutcomes: {
            objectives: [
                "Understand core concepts of the subject",
                "Apply theoretical knowledge to practical scenarios",
                "Develop critical thinking skills related to the field"
            ],
            keyTopics: topics,
            skillsGained: [
                "Critical thinking",
                "Problem-solving",
                "Subject-specific knowledge"
            ]
        },
        schedule: {
            topics: topics.map((topic, index) => ({
                week: index + 1,
                topic: topic,
                description: `Week ${index + 1} covers ${topic}`
            })),
            majorAssignments: [
                {
                    name: "Midterm Examination",
                    dueDate: "Middle of the course",
                    weight: "30%"
                },
                {
                    name: "Final Project",
                    dueDate: "End of the course",
                    weight: "40%"
                }
            ]
        },
        assessmentStructure: {
            gradingScale: "A: 90-100%, B: 80-89%, C: 70-79%, D: 60-69%, F: Below 60%",
            assessmentBreakdown: [
                { name: "Participation", weight: "10%" },
                { name: "Assignments", weight: "20%" },
                { name: "Midterm Exam", weight: "30%" },
                { name: "Final Project", weight: "40%" }
            ]
        },
        policies: [
            "Regular attendance is expected.",
            "Late assignments may be subject to penalties.",
            "Academic integrity is taken seriously."
        ],
        assessmentPatterns: normalizeAssessmentPatterns(null)
    };
}

const DEFAULT_ASSESSMENT_PATTERNS = [
    {
        name: "Weekly Quiz Pattern",
        description: "Short weekly quizzes to reinforce learning",
        structure: [
            { questionType: "Multiple Choice", count: 5, pointsPerQuestion: 1 },
            { questionType: "True/False", count: 5, pointsPerQuestion: 1 }
        ],
        totalPoints: 10,
        estimatedTime: 15,
        difficulty: "Beginner"
    },
    {
        name: "Midterm Assessment",
        description: "Comprehensive assessment of course topics",
        structure: [
            { questionType: "Multiple Choice", count: 10, pointsPerQuestion: 2 },
            { questionType: "Short Answer", count: 5, pointsPerQuestion: 4 }
        ],
        totalPoints: 40,
        estimatedTime: 60,
        difficulty: "Intermediate"
    }
];

/**
 * Validate model-suggested patterns into { patterns: [...] } with consistent
 * structure/totalPoints; falls back to two standard patterns.
 */
function normalizeAssessmentPatterns(value) {
    const raw = Array.isArray(value) ? value : (value && Array.isArray(value.patterns) ? value.patterns : []);
    const patterns = raw
        .filter(p => p && typeof p === 'object' && Array.isArray(p.structure))
        .map(p => {
            const structure = p.structure
                .filter(s => s && typeof s === 'object')
                .map(s => ({
                    questionType: String(s.questionType || s.type || 'Multiple Choice'),
                    count: Math.max(1, parseInt(s.count, 10) || 1),
                    pointsPerQuestion: Math.max(1, Number(s.pointsPerQuestion || s.pointsEach) || 1)
                }));
            return {
                name: String(p.name || 'Syllabus Pattern'),
                description: String(p.description || ''),
                structure,
                totalPoints: structure.reduce((sum, s) => sum + s.count * s.pointsPerQuestion, 0),
                estimatedTime: Math.max(5, parseInt(p.estimatedTime, 10) || 30),
                difficulty: String(p.difficulty || 'Intermediate')
            };
        })
        .filter(p => p.structure.length > 0);
    return { patterns: patterns.length > 0 ? patterns : DEFAULT_ASSESSMENT_PATTERNS.map(p => ({ ...p, structure: p.structure.map(s => ({ ...s })) })) };
}

/**
 * Generate a fallback syllabus analysis when all model calls fail
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @returns {Object} - Basic syllabus analysis object
 */
function generateFallbackSyllabusAnalysis(syllabusContent) {
  // This is essentially the same as our generateBasicSyllabusStructure function
  // We can reuse that implementation to provide a consistent fallback
  return generateBasicSyllabusStructure(syllabusContent);
}

/**
 * Extract text from an uploaded file (PDF, DOCX, TXT)
 * @param {Object} file - Uploaded file object from multer
 * @returns {string} - Extracted text content
 */
async function extractTextFromFile(file) {
    try {
        console.log(`Extracting text from file: ${file.originalname} (${file.mimetype})`);
        
        // Simple mock implementation for demo purposes
        // In a real application, this would use libraries like pdf-parse, docx-parser, etc.
        return `This is extracted text from ${file.originalname}. 
            In a real implementation, this would contain the actual content of the uploaded file.
            The file would be parsed based on its mimetype (${file.mimetype}).
            Course: Introduction to Computer Science
            Code: CS101
            Instructor: Dr. Jane Smith
            Term: Fall 2025
            
            Learning Outcomes:
            - Understand fundamental concepts of programming
            - Apply problem-solving techniques using algorithms
            - Develop basic software applications
            
            Topics:
            1. Introduction to Programming Languages
            2. Data Structures and Algorithms
            3. Object-Oriented Programming
            4. Web Development Basics
            5. Database Management Systems
            
            Assessments:
            - Quizzes (20%)
            - Midterm Exam (30%)
            - Final Project (30%)
            - Participation (20%)`;
    } catch (error) {
        console.error('Error extracting text from file:', error);
        throw new Error(`Failed to extract text from file: ${error.message}`);
    }
}

/**
 * Extract topics from syllabus content
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @returns {Object} - Object containing the extracted topics
 */
async function extractTopicsFromSyllabus(syllabusContent) {
    try {
        console.log('Extracting topics from syllabus content...');
        
        if (!syllabusContent || syllabusContent.trim().length < 50) {
            throw new Error('Syllabus content is too short for meaningful topic extraction');
        }
        
        // Build a prompt focused specifically on topic extraction
        const prompt = `
Extract the main topics covered in this syllabus. Focus only on the academic subjects, 
course modules, or knowledge areas that will be taught, not administrative details.
Return the result as a JSON array of strings, with each string being a course topic.

Example:
If extracting from a Computer Science syllabus, the result might be:
["Introduction to Programming", "Data Structures", "Algorithms", "Database Systems", "Web Development"]

Syllabus content:
${syllabusContent.substring(0, 8000)}

Topics (JSON array of strings):
`;

        // Use transformer model to extract topics
        const response = await transformersModel.createChatCompletion(
            'You are a system for extracting course topics from educational syllabi.',
            prompt,
            {
                temperature: 0.3,
                maxTokens: 1000,
                taskType: 'extraction',
                modelName: 'gemini-pro'
            }
        );
        
        // Extract JSON array from response
        let topics = [];
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                topics = JSON.parse(jsonMatch[0]);
                
                // Ensure topics is an array of strings
                if (!Array.isArray(topics)) {
                    topics = [];
                }
                
                // Clean up topics - remove any that are too short or not strings
                topics = topics
                    .filter(topic => typeof topic === 'string' && topic.trim().length > 2)
                    .map(topic => topic.trim());
                
            } catch (parseError) {
                console.error('Error parsing topics JSON from model response:', parseError);
                // If we can't parse JSON, extract topics using regex patterns
                topics = extractTopicsUsingPatterns(syllabusContent);
            }
        } else {
            console.log('No JSON topics array found in response, using pattern extraction');
            topics = extractTopicsUsingPatterns(syllabusContent);
        }
        
        // If we couldn't extract any topics, return an empty array, not defaults
        if (!topics || topics.length === 0) {
            console.log('No topics found, returning empty array');
            topics = [];
        }
        
        // Limit to a reasonable number of topics
        topics = topics.slice(0, 15);
        
        return {
            topics,
            metadata: {
                extractedAt: new Date().toISOString(),
                modelUsed: 'gemini-pro',
                topicCount: topics.length
            }
        };
    } catch (error) {
        console.error('Error extracting topics from syllabus:', error);
        // Return empty array on error, not defaults
        return {
            topics: [],
            metadata: {
                extractedAt: new Date().toISOString(),
                modelUsed: 'fallback',
                error: error.message
            }
        };
    }
}

/**
 * Extract topics using regex patterns when AI extraction fails
 * @private
 * @param {string} syllabusContent - Raw text content of the syllabus
 * @returns {Array} - Array of topic strings
 */
function extractTopicsUsingPatterns(syllabusContent) {
    // Look for common topic patterns in the syllabus
    const topics = [];
    
    // Match sections that might contain topics
    const contentSections = syllabusContent.match(/(?:topics|content|subject|curriculum|modules|units|lessons)[ :].+?(?:\n\n|\n\r\n|$)/gi) || [];
    
    // Process each potential section to extract topics
    for (const section of contentSections) {
        // Look for bulleted or numbered list items
        const listItems = section.match(/[-•*][ \t](.+?)(?:\n|$)/g) || 
                          section.match(/\d+\.[ \t](.+?)(?:\n|$)/g) || 
                          section.match(/[A-Z]\.[ \t](.+?)(?:\n|$)/g);
        
        if (listItems && listItems.length > 0) {
            for (const item of listItems) {
                // Clean up the item
                const cleaned = item.replace(/^[-•*\d.A-Z][ \t]+/, '').trim();
                if (cleaned.length > 3 && !topics.includes(cleaned)) {
                    topics.push(cleaned);
                }
            }
        }
    }
    
    // Look for potential topics in headings or bold text
    const headings = syllabusContent.match(/#{1,6}[ \t](.+?)(?:\n|$)/g) || 
                     syllabusContent.match(/\*\*(.+?)\*\*/g) || 
                     syllabusContent.match(/Chapter \d+:[ \t](.+?)(?:\n|$)/gi);
    
    if (headings && headings.length > 0) {
        for (const heading of headings) {
            // Clean up the heading
            const cleaned = heading.replace(/^#{1,6}[ \t]+/, '')
                                 .replace(/^\*\*|\*\*$/g, '')
                                 .replace(/^Chapter \d+:[ \t]+/i, '')
                                 .trim();
            
            if (cleaned.length > 3 && !topics.includes(cleaned) && 
                !cleaned.match(/course|syllabus|overview|assessment|grading|schedule|policy|objective/i)) {
                topics.push(cleaned);
            }
        }
    }
    
    return topics;
}

/**
 * Get list of analyzed syllabi (mock implementation)
 * @returns {Array} - List of syllabi
 */
async function getSyllabiList() {
    // Mock implementation for demo purposes
    return [
        {
            id: 'syllabus-1',
            courseTitle: 'Introduction to Computer Science',
            courseCode: 'CS101',
            analyzedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
        },
        {
            id: 'syllabus-2',
            courseTitle: 'Advanced Programming Techniques',
            courseCode: 'CS301',
            analyzedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        }
    ];
}

/**
 * Generate assessment based on syllabus analysis
 * @param {Object} syllabusAnalysis - The analyzed syllabus data
 * @param {Object} preferences - Assessment generation preferences
 * @returns {Object} - The generated assessment
 */
async function generateAssessment(syllabusAnalysis, preferences = {}) {
    try {
        console.log(`Generating assessment with pattern:`, JSON.stringify(preferences.pattern || {}));
        
        const pattern = preferences.pattern || {};
        // Extract key topics from syllabus analysis, honouring the instructor's topic selection
        const keyTopics = Array.isArray(syllabusAnalysis.learningOutcomes?.keyTopics) ? syllabusAnalysis.learningOutcomes.keyTopics : [];
        const topics = Array.isArray(pattern.topicFocus) && pattern.topicFocus.length > 0 ? pattern.topicFocus : keyTopics;

        // Patterns come either as questionDistribution [{type,count,pointsEach}] (templates)
        // or as structure [{questionType,count,pointsPerQuestion}] (syllabus-derived patterns)
        const rawDistribution = Array.isArray(pattern.questionDistribution) && pattern.questionDistribution.length > 0
            ? pattern.questionDistribution
            : (Array.isArray(pattern.structure) ? pattern.structure : null);
        const distribution = rawDistribution
            ? rawDistribution.map(d => ({
                type: normalizeQuestionType(d.type || d.questionType),
                count: Math.max(0, parseInt(d.count, 10) || 0),
                pointsEach: Number(d.pointsEach || d.pointsPerQuestion) || 1
            })).filter(d => d.count > 0)
            : null;
        const requestedCount = distribution ? distribution.reduce((sum, d) => sum + d.count, 0) : 0;

        // Use the latest available model name (retired/non-Gemini names are mapped by the model layer)
        const modelName = preferences.modelName || pattern.modelName;
        console.log(`Using model ${modelName || '(default)'} for assessment generation`);
        
        // Build a detailed prompt with the syllabus information and pattern
        const prompt = `
Generate an assessment for a course based on the following syllabus information:

Course: ${syllabusAnalysis.basicInfo?.courseTitle || 'Untitled Course'}
Code: ${syllabusAnalysis.basicInfo?.courseCode || 'Unknown'}
Level: ${syllabusAnalysis.basicInfo?.academicLevel || 'Undergraduate'}

Key Topics: ${topics.join(', ')}

Assessment Pattern:
- Name: ${pattern.name || 'Standard Assessment'}
- Difficulty: ${pattern.difficulty || 'Medium'}
- Question Distribution: ${JSON.stringify(distribution || [])}
- Time Limit: ${pattern.timeLimit || pattern.estimatedTime || 60} minutes
${requestedCount > 0 ? `\nGenerate exactly ${requestedCount} questions in total, matching the distribution above.\n` : ''}
Please create a complete assessment with diverse questions covering the key topics. For each question:
1. Write a clear question text
2. Specify the question type (multiple-choice, true-false, short-answer, essay)
3. For multiple-choice questions, provide 4 options with the correct answer
4. Indicate the topic the question relates to
5. Specify difficulty level
6. Assign appropriate point value

Generate questions that match the pattern's difficulty level and distribution.
Format each question as follows:

Question 1: [Question text]
Type: [multiple-choice/true-false/short-answer/essay]
Option A: [Option text]
Option B: [Option text]
Option C: [Option text]
Option D: [Option text]
Correct Answer: [A/B/C/D]
Topic: [Related topic]
Difficulty: [Easy/Medium/Hard]
Points: [point value]

Question 2: ...
`;

        // Use transformers model with the latest model name
        console.log('Calling model to generate assessment...');
        const response = await transformersModel.createChatCompletion(
            'You are an expert assessment creator for educational courses.',
            prompt,
            {
                temperature: 0.7,
                maxTokens: 4000,
                modelName: modelName,
                topP: 0.9
            }
        );
        
        // Parse the response to extract questions
        console.log('Parsing model response for assessment questions...');
        
        // Process the response to extract questions - use simple parsing rather than expecting JSON
        const questions = [];
        // Strip markdown bold markers (e.g. "**Type:**") that break the field regexes
        const cleanedResponse = String(response || '').replace(/\*\*/g, '');
        const questionRegex = /Question\s+(\d+):\s*(.*?)(?=\s*Question\s+\d+:|$)/gs;
        const questionMatches = [...cleanedResponse.matchAll(questionRegex)];

        if (questionMatches && questionMatches.length > 0) {
            for (let i = 0; i < questionMatches.length; i++) {
                const questionBlock = questionMatches[i][2];

                // First extract all metadata we'll need to avoid reference errors
                const typeMatch = questionBlock.match(/Type:\s*([^\n]+)/i);
                const questionType = typeMatch ? normalizeQuestionType(typeMatch[1]) : 'multiple-choice';

                const topicMatch = questionBlock.match(/Topic:\s*([^\n]+)/i);
                const topic = topicMatch ? topicMatch[1].trim() : (topics[i % topics.length] || 'General');
                
                const difficultyMatch = questionBlock.match(/Difficulty:\s*(Easy|Medium|Hard)/i);
                const difficulty = difficultyMatch ? difficultyMatch[1] : (pattern.difficulty || 'Medium');
                
                const pointsMatch = questionBlock.match(/Points:\s*(\d+)/i);
                const points = pointsMatch ? parseInt(pointsMatch[1]) : (
                    questionType === 'multiple-choice' ? 2 : 
                    questionType === 'true-false' ? 1 : 5
                );
                
                const questionTextMatch = questionBlock.match(/^(.*?)(?=\s*Type:|$)/i);
                const questionText = questionTextMatch ? questionTextMatch[1].trim() : `Question about ${topic}`;
                
                // Extract options for multiple-choice
                const options = [];
                if (questionType === 'multiple-choice') {
                    const optionA = questionBlock.match(/Option\s+A:\s*(.*?)(?=\s*Option\s+B:|$)/i);
                    const optionB = questionBlock.match(/Option\s+B:\s*(.*?)(?=\s*Option\s+C:|$)/i);
                    const optionC = questionBlock.match(/Option\s+C:\s*(.*?)(?=\s*Option\s+D:|$)/i);
                    const optionD = questionBlock.match(/Option\s+D:\s*(.*?)(?=\s*Correct\s+Answer:|$)/i);
                    
                    if (optionA) options.push(optionA[1].trim());
                    if (optionB) options.push(optionB[1].trim());
                    if (optionC) options.push(optionC[1].trim());
                    if (optionD) options.push(optionD[1].trim());
                } else if (questionType === 'true-false') {
                    options.push('True');
                    options.push('False');
                }
                
                // Extract correct answer
                let correctAnswer = '';
                const correctKey = extractCorrectKey(questionBlock);
                // Short answers carry a sample answer instead of a letter/True/False key.
                if (correctKey || questionType === 'short-answer') {
                    if (questionType === 'multiple-choice') {
                        const index = correctKey && /^[A-D]$/.test(correctKey) ? correctKey.charCodeAt(0) - 65 : -1;
                        if (index >= 0 && index < options.length) {
                            correctAnswer = options[index];
                        } else {
                            correctAnswer = options[0] || '';
                        }
                    } else if (questionType === 'true-false') {
                        correctAnswer = toTrueFalseKey(correctKey) || 'True';
                    } else if (questionType === 'short-answer') {
                        // For short answer, instead of using True/False, use a proper text answer
                        // Look for a sample answer in the question block
                        const sampleAnswerMatch = questionBlock.match(/Sample\s+Answer:\s*(.*?)(?=\s*Topic:|$)/i);
                        correctAnswer = sampleAnswerMatch 
                            ? sampleAnswerMatch[1].trim() 
                            : `A comprehensive answer should address key concepts related to ${topic} and demonstrate understanding of the core principles.`;
                    }
                } else {
                    // Default answers based on question type
                    if (questionType === 'multiple-choice') {
                        correctAnswer = options[0] || '';
                    } else if (questionType === 'true-false') {
                        correctAnswer = 'True';
                    } else if (questionType === 'short-answer') {
                        // For short answer, provide a sample answer instead of True/False
                        correctAnswer = `A comprehensive answer should address key concepts related to ${topic} and demonstrate understanding of the core principles.`;
                    }
                }
                
                // Add the question to our array
                questions.push({
                    id: `q${i + 1}`,
                    question: questionText,
                    questionType: questionType,
                    options: options,
                    correctAnswer: correctAnswer,
                    topic: topic,
                    difficulty: difficulty,
                    points: points,
                    explanation: `This question tests understanding of ${topic}.`
                });
            }
        }

        
        // If we couldn't extract questions, generate fallback ones. With a pattern,
        // fall through to the enforcement below, which builds topic-based questions
        // that still follow the requested types/counts/points.
        if (questions.length === 0 && !(distribution && distribution.length > 0)) {
            console.log('Could not extract questions from model response, generating fallbacks...');
            const fallbackQuestions = generateBasicQuestions(topics, { ...preferences, questionCount: preferences.questionCount || requestedCount || undefined });
            return {
                title: `${syllabusAnalysis.basicInfo?.courseTitle || 'Course'} Assessment`,
                description: `Assessment based on the course syllabus`,
                totalPoints: fallbackQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
                timeLimit: preferences.timeLimit || pattern.timeLimit || 60,
                questions: fallbackQuestions,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                generatedAt: new Date().toISOString(),
                generatedBy: 'fallback-system'
            };
        }

        // Enforce pattern: match question type/count/points to the pattern's distribution
        if (distribution && distribution.length > 0) {
            let enforcedQuestions = [];
            let used = new Set();
            let qIndex = 0;
            for (const dist of distribution) {
                let count = dist.count;
                let type = dist.type;
                let pointsEach = dist.pointsEach;
                for (let i = 0; i < count; i++) {
                    // Take the next unused generated question of this type. (Previously the
                    // used-set was keyed on a clone and never matched, so questions repeated.)
                    const origIdx = questions.findIndex((qq, idx) => !used.has(idx) && qq.questionType === type);
                    let q;
                    if (origIdx !== -1) {
                        used.add(origIdx);
                        // Clone and enforce points/type
                        q = { ...questions[origIdx], questionType: type, points: pointsEach };
                    } else {
                        // Not enough generated questions of this type: build a topic-based one
                        const topic = topics.length > 0 ? topics[qIndex % topics.length] : 'General';
                        q = {
                            id: `q${qIndex + 1}`,
                            question: type === 'true-false'
                                ? [`True or False: ${topic} is a core topic covered in this course.`,
                                   `True or False: Understanding ${topic} helps solve practical problems in this course.`][qIndex % 2]
                                : type === 'multiple-choice'
                                    ? [`Which of the following best describes ${topic}?`,
                                       `Which statement about ${topic} is most accurate?`,
                                       `What is the main reason to study ${topic} in this course?`][qIndex % 3]
                                    : [`Explain the key concepts of ${topic} and give an example of how it is applied.`,
                                       `Discuss the advantages and limitations of ${topic}.`][qIndex % 2],
                            questionType: type,
                            options: type === 'multiple-choice'
                                ? [`${topic} is a fundamental concept in this field`, `${topic} is unrelated to the course material`, `${topic} has no practical applications`, `${topic} is only used in advanced research`]
                                : (type === 'true-false' ? ['True', 'False'] : []),
                            correctAnswer: type === 'multiple-choice'
                                ? `${topic} is a fundamental concept in this field`
                                : (type === 'true-false' ? 'True' : ''),
                            topic,
                            difficulty: pattern.difficulty || 'Medium',
                            points: pointsEach,
                            explanation: `This question tests understanding of ${topic}.`
                        };
                    }
                    enforcedQuestions.push(q);
                    qIndex++;
                }
            }
            // Re-number so ids are unique: kept questions keep their parse-order id while
            // placeholders were numbered by slot, which produced duplicate ids (and
            // answers keyed by question id then overwrote each other).
            enforcedQuestions = enforcedQuestions.map((q, idx) => ({ ...q, id: `q${idx + 1}` }));
            // Replace questions with enforced
            return {
                title: `${syllabusAnalysis.basicInfo?.courseTitle || 'Course'} Assessment`,
                description: `${pattern.name || 'Standard'} assessment covering key course topics`,
                totalPoints: enforcedQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
                timeLimit: preferences.timeLimit || pattern.timeLimit || 60,
                questions: enforcedQuestions,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                generatedAt: new Date().toISOString(),
                generatedBy: questions.length > 0 ? (modelName || 'gemini') : 'fallback-system'
            };
        } else {
            // Return as before if no pattern
            return {
                title: `${syllabusAnalysis.basicInfo?.courseTitle || 'Course'} Assessment`,
                description: `${pattern.name || 'Standard'} assessment covering key course topics`,
                totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
                timeLimit: preferences.timeLimit || pattern.timeLimit || 60,
                questions: questions,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                generatedAt: new Date().toISOString(),
                generatedBy: modelName
            };
        }
    } catch (error) {
        console.error('Error generating assessment:', error);
        
        // Generate fallback questions on error
        const topics = syllabusAnalysis?.learningOutcomes?.keyTopics || [];
        const fallbackQuestions = generateBasicQuestions(topics, preferences);
        return {
            title: `${syllabusAnalysis?.basicInfo?.courseTitle || 'Course'} Assessment`,
            description: `Assessment based on the course syllabus (fallback mode)`,
            totalPoints: fallbackQuestions.reduce((sum, q) => sum + (q.points || 0), 0),
            timeLimit: preferences.timeLimit || 60,
            questions: fallbackQuestions,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            generatedAt: new Date().toISOString(),
            generatedBy: 'error-fallback'
        };
    }
}

/**
 * Generate basic questions based on topics
 * @private
 */
function generateBasicQuestions(topics, preferences) {
    // Generate a mix of question types based on preferences
    const questions = [];
    const questionCount = (preferences && preferences.questionCount) || 10;
    topics = Array.isArray(topics) ? topics : [];

    for (let i = 0; i < questionCount; i++) {
        const topic = topics[i % topics.length] || `Topic ${i+1}`;

        // Every question needs a unique id and a questionType: answers are keyed by
        // question id and the grader/UI read questionType.
        if (i % 3 === 0) {
            questions.push({
                id: `q${i + 1}`,
                questionType: 'multiple-choice',
                type: 'multiple-choice',
                question: `Which of the following best describes ${topic}?`,
                options: [
                    `${topic} is a fundamental concept in this field`,
                    `${topic} is an advanced technique rarely used`,
                    `${topic} is unrelated to the course material`,
                    `${topic} is only theoretical with no practical applications`
                ],
                correctAnswer: `${topic} is a fundamental concept in this field`,
                points: 10
            });
        } else if (i % 3 === 1) {
            questions.push({
                id: `q${i + 1}`,
                questionType: 'short-answer',
                type: 'short-answer',
                question: `Briefly explain the importance of ${topic} in this course.`,
                sampleAnswer: `${topic} is important because it forms the foundation for understanding more complex concepts.`,
                correctAnswer: `${topic} is important because it forms the foundation for understanding more complex concepts.`,
                points: 15
            });
        } else {
            questions.push({
                id: `q${i + 1}`,
                questionType: 'essay',
                type: 'essay',
                question: `Discuss the practical applications of ${topic} and how it relates to other concepts in this course.`,
                rubric: `Excellent answers will thoroughly explain ${topic}, provide multiple practical examples, and draw connections to at least three other course concepts.`,
                points: 25
            });
        }
    }
    
    return questions;
}

// Export existing functions from the original code
module.exports = {
    generateQuickQuiz,
    analyzeSyllabus,
    extractTextFromFile,
    extractTopicsFromSyllabus,
    getSyllabiList,
    generateAssessment,
    generateFallbackSyllabusAnalysis
};