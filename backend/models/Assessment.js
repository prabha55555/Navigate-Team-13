const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define Question schema (embedded document)
const QuestionSchema = new Schema({
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer', 'multiple-select', 'essay'],
    required: true
  },
  options: {
    type: [String],
    default: []
  },
  correctAnswer: {
    type: Schema.Types.Mixed, // Can be String, Boolean, or Array depending on question type
    required: true
  },
  points: {
    type: Number,
    default: 1
  },
  explanation: {
    type: String
  }
});

// Define Assessment schema
const AssessmentSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  courseId: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  questions: [QuestionSchema],
  timeLimit: {
    type: Number, // in minutes
    default: 60
  },
  totalPoints: {
    type: Number,
    default: function() {
      return this.questions.reduce((sum, q) => sum + q.points, 0);
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  allowedAttempts: {
    type: Number,
    default: 1
  },
  randomizeQuestions: {
    type: Boolean,
    default: false
  },
  // New fields for assessment flow
  syllabusTitle: {
    type: String,
    default: ''
  },
  isAssignedToAllStudents: {
    type: Boolean,
    default: false
  },
  assignedStudents: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  visibility: {
    instructorCanSeeAnswers: {
      type: Boolean,
      default: true
    },
    studentsCanSeeAnswers: {
      type: Boolean,
      default: false
    },
    studentsCanSeeSyllabusTitle: {
      type: Boolean,
      default: false
    },
    showResultsImmediately: {
      type: Boolean,
      default: true
    }
  },
  // AI-based evaluation settings
  aiEvaluationSettings: {
    enablePlagiarismDetection: {
      type: Boolean,
      default: true
    },
    plagiarismService: {
      type: String,
      enum: ['turnitin', 'gptzero', 'aws-comprehend'],
      default: 'turnitin'
    },
    enableLLMEvaluation: {
      type: Boolean,
      default: true
    },
    llmEvaluationWeights: {
      exactMatch: {
        type: Number,
        default: 0.3
      },
      semanticSimilarity: {
        type: Number,
        default: 0.4
      },
      reasoning: {
        type: Number,
        default: 0.3
      }
    },
    enableExpertPanelFeedback: {
      type: Boolean,
      default: true
    },
    expertPanelFocus: {
      misconceptions: {
        type: Boolean,
        default: true
      },
      learningGaps: {
        type: Boolean,
        default: true
      },
      strengthAreas: {
        type: Boolean,
        default: true
      },
      improvementSuggestions: {
        type: Boolean,
        default: true
      }
    }
  }
});

// Define Submission schema
const SubmissionSchema = new Schema({
  assessmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Map,
    of: Schema.Types.Mixed // Can be String, Boolean, or Array depending on question type
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  isGraded: {
    type: Boolean,
    default: false
  },
  feedback: {
    overallFeedback: {
      type: String
    },
    questionFeedback: {
      type: Map,
      of: String
    }
  },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  // AI Evaluation Results
  aiEvaluation: {
    plagiarismResults: {
      score: { type: Number }, // 0-100, higher means more likely to be plagiarized
      source: { type: String, enum: ['turnitin', 'gptzero', 'aws-comprehend'] },
      details: { type: Map, of: String }, // Details about matched sources
      isPlagiarized: { type: Boolean, default: false },
      timestamp: { type: Date }
    },
    llmEvaluation: {
      exactMatchScore: { type: Number, default: 0 }, // Exact keyword matching score
      semanticSimilarityScore: { type: Number, default: 0 }, // How close to model answer
      reasoningCheckScore: { type: Number, default: 0 }, // Logical reasoning evaluation
      overallScore: { type: Number, default: 0 }, // Combined AI score
      timestamp: { type: Date }
    },    expertPanelFeedback: {
      misconceptions: [String],
      learningGaps: [String],
      strengthAreas: [String],
      improvementSuggestions: [String],
      detailedAnalysis: [{
        questionIndex: Number,
        questionText: String,
        factualAccuracy: {
          feedback: String,
          suggestions: [String]
        },
        conceptualUnderstanding: {
          feedback: String,
          suggestions: [String]
        },
        clarity: {
          feedback: String,
          suggestions: [String]
        }
      }],
      competencyScores: {
        factualAccuracy: Number,
        conceptualUnderstanding: Number,
        clarity: Number,
        overallCompetency: Number
      },
      topConcepts: [String],
      feedbackSummary: String,
      generatedAt: Date,
      analysisVersion: String,
      timestamp: { type: Date }
    },
    evaluationStatus: {
      type: String,
      enum: ['pending', 'plagiarism-complete', 'llm-complete', 'expert-complete', 'fully-complete'],
      default: 'pending'
    }
  }
});

// Create models
const Assessment = mongoose.model('Assessment', AssessmentSchema);
const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = {
  Assessment,
  Submission
};