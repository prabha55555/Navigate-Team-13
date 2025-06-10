const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
<<<<<<< HEAD
const auth = require('../middlewares/auth');
const { generateCurriculumMap, generateLearningOutcomes, generateLearningOutcomesFromDescription } = require('../services/curriculumService');
=======
const fetch = require('node-fetch');
const crypto = require('crypto');

// Import environment variables for Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use the configured model name from environment variable
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-pro';

// Simple in-memory cache
const outcomeCache = new Map();

// Helper function to create a cache key
function createCacheKey(courseTitle, courseDescription) {
  const input = `${courseTitle || ''}:${courseDescription || ''}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// Helper function to call Gemini API
async function callGeminiAPI(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  // Log the API URL and key (remove in production)
  console.log(`Using Gemini model: ${GEMINI_MODEL}`);
  console.log(`API key present: ${GEMINI_API_KEY ? 'Yes' : 'No'}`);

  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    console.log('Making request to Gemini API...');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API returned an error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const jsonResponse = await response.json();
    console.log('Gemini API response received successfully');
    return jsonResponse;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637

// Mock data for demonstration purposes
const courses = [
  {
    _id: 'mock-course-id',
    title: 'Web Development Fundamentals',
    description: 'Learn the core principles of web development including HTML, CSS, and JavaScript. This course provides a solid foundation for building modern websites and web applications.',
    instructor: 'instructor-id-1',
    topics: ['HTML', 'CSS', 'JavaScript', 'Responsive Design'],
    level: 'beginner',
    progress: 25, // For demo purposes
    units: [
      {
        title: 'Introduction to HTML',
        lessons: [
          {
            title: 'Basic HTML Structure',
            type: 'video',
            completed: true
          },
          {
            title: 'HTML Elements and Tags',
            type: 'reading',
            completed: true
          },
          {
            title: 'HTML Forms',
            type: 'interactive',
            completed: false
          }
        ]
      },
      {
        title: 'CSS Fundamentals',
        lessons: [
          {
            title: 'CSS Selectors',
            type: 'video',
            completed: false
          },
          {
            title: 'CSS Box Model',
            type: 'reading',
            completed: false
          }
        ]
      },
      {
        title: 'JavaScript Basics',
        lessons: [
          {
            title: 'Variables and Data Types',
            type: 'video',
            completed: false
          },
          {
            title: 'Functions and Control Flow',
            type: 'interactive',
            completed: false
          }
        ]
      }
    ],
    createdAt: new Date()
  }
];

// @route   GET api/courses/enrolled
// @desc    Get courses the student is enrolled in
// @access  Private
router.get('/courses/enrolled', authMiddleware, (req, res) => {
  try {
    // In a real app, this would filter courses by user enrollment
    // For demo purposes, we'll just return all courses
    
    const enrolledCourses = courses.map(course => ({
      _id: course._id,
      title: course.title,
      description: course.description,
      progress: course.progress,
      level: course.level,
      topics: course.topics
    }));
    
    res.json({
      success: true,
      courses: enrolledCourses
    });
  } catch (err) {
    console.error('Error fetching enrolled courses:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/courses/:id
// @desc    Get a specific course with all details
// @access  Private
router.get('/courses/:id', authMiddleware, (req, res) => {
  try {
    const course = courses.find(c => c._id === req.params.id);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    res.json({
      success: true,
      course
    });
  } catch (err) {
    console.error('Error fetching course:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/curriculum/map/:courseId
// @desc    Get the curriculum map for a course
// @access  Private
router.get('/map/:courseId', authMiddleware, (req, res) => {
  try {
    const { courseId } = req.params;
    const course = courses.find(c => c._id === courseId);
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    
    // Generate curriculum map
    // In a real app, this would be more elaborate with prerequisite relationships, etc.
    const curriculumMap = {
      courseId,
      courseTitle: course.title,
      topics: course.topics,
      conceptNodes: [
        {
          id: 'html-basics',
          title: 'HTML Basics',
          description: 'Understanding the fundamentals of HTML markup',
          level: 1,
          prerequisites: []
        },
        {
          id: 'css-basics',
          title: 'CSS Basics',
          description: 'Understanding how to style web pages with CSS',
          level: 1,
          prerequisites: ['html-basics']
        },
        {
          id: 'responsive-design',
          title: 'Responsive Design',
          description: 'Creating websites that work on all devices and screen sizes',
          level: 2,
          prerequisites: ['html-basics', 'css-basics']
        },
        {
          id: 'javascript-intro',
          title: 'JavaScript Introduction',
          description: 'Learning the basics of programming with JavaScript',
          level: 2,
          prerequisites: ['html-basics']
        }
      ],
      paths: [
        {
          name: 'Frontend Developer Path',
          nodes: ['html-basics', 'css-basics', 'responsive-design', 'javascript-intro']
        }
      ]
    };
    
    res.json({
      success: true,
      curriculumMap
    });
  } catch (err) {
    console.error('Error fetching curriculum map:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

<<<<<<< HEAD
// @route   POST /api/curriculum/generate
// @desc    Generate curriculum mapping with Gemini AI
// @access  Private (Instructor)
router.post('/generate', auth, async (req, res) => {
  try {
    const { courseTitle, courseDescription = '' } = req.body;
    
    if (!courseTitle) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course title is required' 
      });
    }
    
    const result = await generateCurriculumMap(courseTitle, courseDescription);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error generating curriculum map:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating curriculum map',
      error: error.message
    });
  }
});

// @route   POST /api/curriculum/generate-outcomes
// @desc    Generate learning outcomes from topics using Gemini AI
// @access  Private (Instructor)
router.post('/generate-outcomes', auth, async (req, res) => {
  try {
    const { courseTitle, courseDescription, topics } = req.body;
    
    if (!courseTitle) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course title is required' 
      });
    }
    
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Topics array is required and cannot be empty' 
      });
    }
    
    // Call the service function to generate learning outcomes from topics
    const learningOutcomes = await generateLearningOutcomes(courseTitle, courseDescription, topics);
    
    return res.status(200).json({
      success: true,
      learningOutcomes
    });
  } catch (error) {
    console.error('Error generating learning outcomes:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating learning outcomes',
      error: error.message
    });
  }
});

// @route   POST /api/curriculum/generate-outcomes-from-description
// @desc    Generate learning outcomes directly from course description using Gemini AI
// @access  Private (Instructor)
router.post('/generate-outcomes-from-description', auth, async (req, res) => {
  try {
    const { courseTitle, courseDescription } = req.body;
    
    if (!courseTitle) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course title is required' 
      });
    }
=======
// @route   POST api/curriculum/generate-outcomes
// @desc    Generate learning outcomes based on course description using Gemini AI
// @access  Private (Instructor only)
router.post('/generate-outcomes', authMiddleware, async (req, res) => {
  try {
    // Check if user is an instructor (in a real app)
    // Uncomment this in production
    /*
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only instructors can generate learning outcomes' 
      });
    }
    */
    
    const { courseDescription, courseTitle } = req.body;
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
    
    if (!courseDescription) {
      return res.status(400).json({ 
        success: false, 
        message: 'Course description is required' 
      });
    }
<<<<<<< HEAD
    
    // Call the service function to generate learning outcomes from description
    const learningOutcomes = await generateLearningOutcomesFromDescription(courseTitle, courseDescription);
    
    return res.status(200).json({
      success: true,
      learningOutcomes
    });
  } catch (error) {
    console.error('Error generating learning outcomes from description:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating learning outcomes',
      error: error.message
=======

    // Create cache key
    const cacheKey = createCacheKey(courseTitle, courseDescription);

    // Check cache
    if (outcomeCache.has(cacheKey)) {
      return res.json({
        success: true,
        outcomes: outcomeCache.get(cacheKey)
      });
    }    // Create prompt for Gemini API
    const prompt = `
You are an AI assistant that generates learning outcomes for educational courses. 
I need you to generate 5-7 learning outcomes for the following course:

Course Title: ${courseTitle || 'Course'}
Course Description: ${courseDescription}

Guidelines for learning outcomes:
- Learning outcomes should be VERY SPECIFIC and directly related to the course content
- DO NOT create generic or placeholder outcomes
- Each outcome should begin with "Students will be able to..."
- Each outcome should mention SPECIFIC SKILLS or KNOWLEDGE from the course description
- The outcomes should cover different cognitive levels from Bloom's taxonomy
- The outcomes should represent a range of competency levels from Core to Advanced
- Include specific terminology and concepts mentioned in the course description

IMPORTANT: Your response must be a valid JSON array of learning outcome objects.
Each object should have these properties:
1. "text" - The learning outcome statement starting with "Students will be able to..."
2. "bloom" - The Bloom's taxonomy level (one of: "Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create")
3. "competency" - The competency level (one of: "Core", "Intermediate", "Advanced")

Example output format:
[
  {
    "text": "Students will be able to implement basic HTML tags to structure web pages.",
    "bloom": "Apply",
    "competency": "Core"
  }
]

Your entire response must be ONLY the JSON array with no other text before or after it.
`;

    console.log('Sending prompt to Gemini API...');

    // Call Gemini API
    const geminiResponse = await callGeminiAPI(prompt);
      // Extract and parse the JSON response
    let outcomes = [];
    
    console.log('Parsing Gemini response...');
    
    if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
      const textContent = geminiResponse.candidates[0].content.parts[0].text;
      console.log('Received text content:', textContent.substring(0, 100) + '...');
      
      // Extract JSON from response (it might be wrapped in text/markdown)
      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          // Parse JSON
          outcomes = JSON.parse(jsonMatch[0]);
          console.log(`Successfully parsed JSON. Found ${outcomes.length} outcomes.`);
        } catch (e) {
          console.error('Error parsing Gemini response as JSON:', e);
          // Fallback to try parsing the entire response
          try {
            outcomes = JSON.parse(textContent);
            console.log('Fallback parsing successful.');
          } catch (e2) {
            console.error('Error parsing entire Gemini response as JSON:', e2);
            throw new Error('Failed to parse Gemini API response');
          }
        }      } else {
        console.error('No valid JSON found in response:', textContent);
        
        // Try additional fallback methods
        try {
          // 1. Try to extract any content that looks like JSON with a more aggressive regex
          const anyJsonMatch = textContent.match(/(\[|\{)[\s\S]*(\]|\})/);
          if (anyJsonMatch) {
            outcomes = JSON.parse(anyJsonMatch[0]);
            console.log('Aggressive JSON extraction successful');
          } else {
            // 2. If no JSON-like content, manually parse the response
            console.log('Attempting manual outcome extraction...');
            // Split by lines and look for lines that start with "Students will be able to"
            const lines = textContent.split('\n');
            const manualOutcomes = [];
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.includes("Students will be able to")) {
                // Extract a bloom level if possible
                let bloom = "Understand";
                for (const level of ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]) {
                  if (trimmedLine.toLowerCase().includes(level.toLowerCase())) {
                    bloom = level;
                    break;
                  }
                }
                
                // Extract a competency level if possible
                let competency = "Core";
                for (const level of ["Core", "Intermediate", "Advanced"]) {
                  if (trimmedLine.toLowerCase().includes(level.toLowerCase())) {
                    competency = level;
                    break;
                  }
                }
                
                manualOutcomes.push({
                  text: trimmedLine,
                  bloom,
                  competency
                });
              }
            }
            
            if (manualOutcomes.length > 0) {
              outcomes = manualOutcomes;
              console.log(`Manual extraction found ${outcomes.length} outcomes`);
            } else {
              throw new Error('Could not extract learning outcomes from API response');
            }
          }
        } catch (e) {
          console.error('All fallback parsing methods failed:', e);
          throw new Error('Failed to extract any valid outcomes from Gemini API response');
        }
      }
    } else {
      throw new Error('No valid response from Gemini API');
    }    // Validate outcomes
    if (!Array.isArray(outcomes)) {
      console.error('Outcomes is not an array:', outcomes);
      throw new Error('Gemini API did not return an array of outcomes');
    }
      if (outcomes.length === 0) {
      console.error('Outcomes array is empty');
      
      // Generate context-aware fallback outcomes based on course title and description
      const topics = courseDescription
        .replace(/Unit \d+:/gi, '')
        .split(/,|\.|and|;/g)
        .map(t => t.trim())
        .filter(t => t.length > 5 && t.length < 50);
      
      const fallbackOutcomes = [];
      
      // Only use these if we can extract meaningful topics from the description
      if (topics.length > 0) {
        // Take up to 3 topics for fallback outcomes
        const selectedTopics = topics.slice(0, 3);
        
        fallbackOutcomes.push({
          text: `Students will be able to demonstrate proficiency in ${selectedTopics[0] || 'key course concepts'}.`,
          bloom: "Apply",
          competency: "Core"
        });
        
        if (selectedTopics.length > 1) {
          fallbackOutcomes.push({
            text: `Students will be able to analyze and evaluate ${selectedTopics[1] || 'course materials'}.`,
            bloom: "Analyze",
            competency: "Intermediate"
          });
        }
        
        if (selectedTopics.length > 2) {
          fallbackOutcomes.push({
            text: `Students will be able to create solutions using ${selectedTopics[2] || 'concepts covered in this course'}.`,
            bloom: "Create",
            competency: "Advanced"
          });
        }
      }
      
      // Only use fallbacks if we could generate meaningful ones
      if (fallbackOutcomes.length > 0) {
        outcomes = fallbackOutcomes;
      }
      
      console.log('Generated context-specific fallback outcomes');
    }
      // Ensure each outcome has the expected structure and remove placeholders
    outcomes = outcomes.map(outcome => {
      // Validate text field
      let text = outcome.text || '';
      if (!text.startsWith("Students will be able to")) {
        text = `Students will be able to ${text}`;
      }
      
      // Validate bloom field
      const validBlooms = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
      let bloom = outcome.bloom || 'Understand';
      if (!validBlooms.includes(bloom)) {
        bloom = 'Understand';
      }
      
      // Validate competency field
      const validCompetencies = ["Core", "Intermediate", "Advanced"];
      let competency = outcome.competency || 'Core';
      if (!validCompetencies.includes(competency)) {
        competency = 'Core';
      }
      
      return { text, bloom, competency };
    });
    
    // Filter out generic or placeholder outcomes
    outcomes = outcomes.filter(outcome => {
      const text = outcome.text.toLowerCase();
      
      // Check for generic placeholder-like content
      const placeholderPhrases = [
        "understand the core principles",
        "apply the knowledge learned in",
        "analyze complex problems related to",
        "example",
        "placeholder",
        "insert",
        "fill in"
      ];
      
      // Return false for outcomes that contain placeholder phrases
      return !placeholderPhrases.some(phrase => text.includes(phrase));
    });    // Check if we have at least one valid outcome
    if (outcomes.length === 0) {
      return res.status(422).json({ 
        success: false, 
        message: 'Could not generate specific learning outcomes from the course description. Please provide more detailed course content.'
      });
    }
    
    // Cache the outcomes
    outcomeCache.set(cacheKey, outcomes);
    
    res.json({
      success: true,
      outcomes
    });
  } catch (err) {
    console.error('Error generating outcomes with Gemini:', err);
    
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(500).json({ 
        success: false, 
        message: 'Gemini API key is not configured',
        error: 'GEMINI_API_KEY_MISSING'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: `Error generating outcomes: ${err.message}` 
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
    });
  }
});

module.exports = router;