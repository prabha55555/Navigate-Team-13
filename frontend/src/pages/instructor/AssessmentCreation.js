import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PreviewIcon from '@mui/icons-material/Preview';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Step,
    StepLabel,
    Stepper,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SyllabusUpload from '../../components/instructor/SyllabusUpload';
import { saveAssessment } from '../../services/assessmentSaveService';
import {
    findInstructorAssessment,
    loadInstructorCourses,
    normalizeQuestionType,
    questionTypeLabel
} from './instructorData';
import { useNotify } from '../../contexts/NotificationContext';

const EDITABLE_QUESTION_TYPES = ['Multiple Choice', 'True/False', 'Short Answer', 'Essay', 'Programming'];
const OPTION_QUESTION_TYPES = ['Multiple Choice', 'True/False'];

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in local time
const toDateTimeLocal = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Questions are edited with display labels ('Multiple Choice', ...) in this page
const toEditorQuestion = (q, index, idPrefix) => {
  const questionType = questionTypeLabel(q.questionType || q.type);
  return {
    ...q,
    id: q.id || `${idPrefix}-${index + 1}`,
    question: q.question || q.text || '',
    questionType,
    options: Array.isArray(q.options) && q.options.length
      ? q.options
      : (questionType === 'True/False' ? ['True', 'False'] : []),
    // `??` not `||`: a boolean false key is a real answer, not a missing one.
    correctAnswer: (() => {
      const key = q.groundTruth ?? q.correctAnswer ?? '';
      return typeof key === 'boolean' ? (key ? 'True' : 'False') : key;
    })(),
    topic: q.topic || 'General',
    difficulty: q.difficulty || 'Medium',
    points: Number(q.points) || 1,
    bloomLevel: q.bloomLevel || 'Remember'
  };
};

const pointsOf = (question) => Number(question.points) || 0;

// Mock data for patterns generated from syllabus analysis
const mockPatterns = [
  {
    id: '1',
    name: 'Comprehensive Examination',
    description: 'A balanced assessment covering all key topics and cognitive levels',
    difficulty: 'Medium',
    structure: [
      { questionType: 'Multiple Choice', count: 15, pointsPerQuestion: 2 },
      { questionType: 'Short Answer', count: 5, pointsPerQuestion: 5 },
      { questionType: 'Essay', count: 2, pointsPerQuestion: 10 }
    ],
    totalPoints: 80,
    estimatedTime: 90,
    evaluationCriteria: [
      'Content mastery',
      'Critical thinking',
      'Communication skills'
    ],
    bestSuitedFor: 'Midterm or final examination'
  },
  {
    id: '2',
    name: 'Programming Skills Assessment',
    description: 'Focus on practical implementation of data structures',
    difficulty: 'Hard',
    structure: [
      { questionType: 'Multiple Choice', count: 5, pointsPerQuestion: 2 },
      { questionType: 'Programming', count: 3, pointsPerQuestion: 15 },
      { questionType: 'Problem Solving', count: 2, pointsPerQuestion: 10 }
    ],
    totalPoints: 75,
    estimatedTime: 120,
    evaluationCriteria: [
      'Algorithm design',
      'Code efficiency',
      'Implementation correctness',
      'Problem-solving approach'
    ],
    bestSuitedFor: 'Practical programming skills evaluation'
  },
  {
    id: '3',
    name: 'Concept Mastery Check',
    description: 'Quick assessment focused on fundamental concepts',
    difficulty: 'Easy',
    structure: [
      { questionType: 'Multiple Choice', count: 20, pointsPerQuestion: 2 },
      { questionType: 'True/False', count: 10, pointsPerQuestion: 1 },
      { questionType: 'Matching', count: 5, pointsPerQuestion: 2 }
    ],
    totalPoints: 60,
    estimatedTime: 45,
    evaluationCriteria: [
      'Basic concept understanding',
      'Terminology knowledge',
      'Conceptual relationships'
    ],
    bestSuitedFor: 'Quick knowledge check or quiz'
  }
];

// Mock data for AI-generated questions
const mockGeneratedQuestions = [
  {
    id: '1',
    question: 'Which Java collection interface is implemented by ArrayList and LinkedList?',
    questionType: 'Multiple Choice',
    options: ['Set', 'List', 'Queue', 'Map'],
    correctAnswer: 'List',
    topic: 'Java Collections Framework',
    difficulty: 'Easy',
    points: 2,
    bloomLevel: 'Remember'
  },
  {
    id: '2',
    question: 'Explain the key differences between HashMap and TreeMap in Java, including time complexity for common operations.',
    questionType: 'Short Answer',
    correctAnswer: 'HashMap uses a hash table for storage with O(1) average lookup, while TreeMap uses a Red-Black tree with O(log n) lookup. HashMap doesn\'t maintain any order, while TreeMap keeps keys sorted. HashMap allows null keys and values, TreeMap allows null values but not null keys. TreeMap provides methods like firstKey(), lastKey() for navigating the sorted structure, which HashMap doesn\'t support.',
    topic: 'Java Maps',
    difficulty: 'Medium',
    points: 5,
    bloomLevel: 'Understand'
  },  {
    id: '3',
    question: 'Implement a Java method to check if a given string has balanced parentheses using a Stack.',
    questionType: 'Programming',
    correctAnswer: `public static boolean isBalanced(String str) {
    Stack<Character> stack = new Stack<>();
    
    for (char c : str.toCharArray()) {
        if (c == '(' || c == '{' || c == '[') {
            stack.push(c);
        } else if (c == ')' || c == '}' || c == ']') {
            if (stack.isEmpty()) {
                return false;
            }
            
            char top = stack.pop();
            if ((c == ')' && top != '(') || 
                (c == '}' && top != '{') || 
                (c == ']' && top != '[')) {
                return false;
            }
        }
    }
    
    return stack.isEmpty();
}`,
    topic: 'Java Stack Implementation',
    difficulty: 'Hard',
    points: 15,
    bloomLevel: 'Apply'
  },
  {
    id: '4',
    question: 'What is the time complexity of the containsKey() method in a Java HashMap?',
    questionType: 'Multiple Choice',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    correctAnswer: 'O(1)',
    topic: 'Java HashMap',
    difficulty: 'Medium',
    points: 2,
    bloomLevel: 'Apply'
  },  {
    id: '5',
    question: 'Discuss the implementation differences between Java\'s ArrayList and LinkedList, including when you would choose one over the other for specific use cases.',
    questionType: 'Essay',
    correctAnswer: 'ArrayList in Java uses a dynamic array for storing elements while LinkedList implements the doubly-linked list data structure. ArrayList provides O(1) random access but O(n) insertion/deletion at arbitrary positions due to element shifting. LinkedList has O(n) random access as it must traverse from head/tail, but provides O(1) insertion/deletion once the position is located. ArrayList is memory-efficient for storage but requires occasional resizing, while LinkedList consumes more memory for storing node pointers but never needs resizing. ArrayList performs better for random access and iteration scenarios, while LinkedList is superior for frequent insertions and deletions at known positions, especially at the beginning or end. For large datasets with frequent random access, ArrayList is preferred, while LinkedList is better for implementations requiring frequent structural modifications like queues or priority lists.',
    topic: 'Java Collections',
    difficulty: 'Hard',
    points: 10,
    bloomLevel: 'Analyze'
  }
];

// Remount the form whenever the edited assessment changes (e.g. sidebar
// "Assessment Creator" from /instructor/assessment/4 -> /instructor/assessment),
// so no state from the previous assessment leaks into the new one.
const AssessmentCreation = () => {
  const { assessmentId } = useParams();
  return <AssessmentCreationForm key={assessmentId || 'new'} />;
};

const AssessmentCreationForm = () => {
  const notify = useNotify();
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeStep, setActiveStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Assessment data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [assignToAllStudents, setAssignToAllStudents] = useState(false);
  const [syllabusAnalysis, setSyllabusAnalysis] = useState(null);
  const [syllabusTitle, setSyllabusTitle] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  // Same course list as Course Management (demo courses + locally created ones)
  const [courses] = useState(() => loadInstructorCourses().map(c => ({ id: c.id, title: c.title })));
  // Stable local id so retrying a failed save does not create duplicates
  const draftIdRef = useRef(assessmentId || `assessment-${Date.now()}`);

  // Load assessment data if editing existing assessment or coming from quiz generator
  useEffect(() => {
    const quizData = location.state?.quiz;

    // Check if we have quiz data from the quiz generator
    if (quizData) {
      // Set quiz data into our assessment
      setTitle(quizData.title || 'Quick Knowledge Check');
      setDescription(quizData.description || 'Auto-generated quiz based on syllabus analysis');
      setTimeLimit(quizData.timeLimit || 15);

      // Transform quiz questions to match our format
      if (Array.isArray(quizData.questions)) {
        setQuestions(quizData.questions.map((q, index) => toEditorQuestion({ ...q, id: undefined }, index, 'quiz')));
      }
      // Move to question customization step
      setActiveStep(2);
      return;
    }

    if (!assessmentId) return;

    // Edit mode. There is no backend endpoint that returns an instructor's
    // assessment (with answers), so load the locally saved copy.
    setIsEditing(true);
    const { assessment, isFullRecord } = findInstructorAssessment(assessmentId);

    if (assessment && isFullRecord) {
      setTitle(assessment.title || '');
      setDescription(assessment.description || '');
      setCourseId(assessment.courseId || '');
      setDueDate(toDateTimeLocal(assessment.dueDate));
      setTimeLimit(assessment.timeLimit ?? 60);
      setRandomizeQuestions(!!assessment.randomizeQuestions);
      setShowAnswers(assessment.showAnswers ?? !!assessment.visibility?.studentsCanSeeAnswers);
      setAssignToAllStudents(!!assessment.assignToAllStudents);
      setSyllabusTitle(assessment.syllabusTitle || '');
      setQuestions((assessment.questions || []).map((q, index) => toEditorQuestion(q, index, 'q')));
      setSelectedPattern(assessment.pattern || null);
    } else {
      // Demo assessment (or unknown id): show sample questions so it can be edited and saved
      setTitle(assessment?.title || 'Java Data Structures Assessment');
      setDescription('Comprehensive evaluation of Java collections, data structures implementation, and algorithms');
      setCourseId(assessment?.courseId || '1');
      setDueDate(toDateTimeLocal(assessment?.dueDate ? `${assessment.dueDate}T23:59` : '2025-11-15T23:59'));
      setTimeLimit(90);
      setRandomizeQuestions(true);
      setShowAnswers(false);
      setAssignToAllStudents(!!assessment?.assignToAllStudents);
      setSyllabusTitle(assessment?.syllabusTitle || '');
      setQuestions(mockGeneratedQuestions.map((q, index) => toEditorQuestion(q, index, 'q')));
      setSelectedPattern(mockPatterns[0]);
    }
    // Go straight to the question editor instead of the syllabus upload step
    setActiveStep(2);
  }, [assessmentId, location.state]);

  // Handle syllabus analysis
  const handleSyllabusAnalysisComplete = (analysisData) => {
    if (!analysisData) return;

    setSyllabusAnalysis(analysisData);
    setTitle(`${mockPatterns[0].name}: ${analysisData.basicInfo?.courseTitle || 'Course'}`);
    setCourseId(courses[0]?.id || '');
    // Now that we have analysis data, proceed to the question customization step
    setActiveStep(2);
  };

  // Generate questions based on syllabus and pattern
  const handleGenerateQuestions = async () => {
    if (generating) return;
    if (!selectedPattern || !syllabusAnalysis) {
      notify('Please select a pattern and upload a syllabus before generating questions.', 'warning');
      return;
    }

    setGenerating(true);

    try {
      // The backend enforces `questionDistribution` ({type, count, pointsEach});
      // the local patterns only define `structure`, so derive it.
      const pattern = {
        ...selectedPattern,
        questionDistribution: selectedPattern.questionDistribution || (selectedPattern.structure || []).map(s => ({
          type: normalizeQuestionType(s.questionType),
          count: s.count,
          pointsEach: s.pointsPerQuestion
        }))
      };

      // axios carries the x-auth-token header (the old fetch call had none -> 401)
      const { data } = await axios.post('/api/assessment/generate-questions', {
        syllabusAnalysis,
        pattern
      }, { timeout: 120000 });

      if (data?.success && Array.isArray(data.assessment?.questions) && data.assessment.questions.length) {
        const formattedQuestions = data.assessment.questions.map((q, index) => toEditorQuestion({ ...q, id: undefined }, index, 'gen'));
        setQuestions(formattedQuestions);

        // Update assessment title and description if provided by the API
        if (data.assessment.title) {
          setTitle(data.assessment.title);
        }

        if (data.assessment.description) {
          setDescription(data.assessment.description);
        }

        // Update time limit if provided
        if (data.assessment.timeLimit) {
          setTimeLimit(data.assessment.timeLimit);
        }

        // Show success message
        notify(`Generated ${formattedQuestions.length} questions with Gemini AI.`, 'success');
      } else {
        notify(data?.message || 'Failed to generate questions with Gemini AI. Please try again with a different pattern or syllabus.', 'error');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      notify(`An error occurred while generating questions: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Add a new question manually (opens the editor; added on save)
  const handleAddQuestion = () => {
    setEditingQuestion({
      id: `new-${Date.now()}`,
      question: '',
      questionType: 'Multiple Choice',
      options: ['', '', '', ''],
      correctAnswer: '',
      topic: '',
      difficulty: 'Medium',
      points: 2,
      bloomLevel: 'Remember',
      isNew: true
    });
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion({ ...question, options: [...(question.options || [])] });
  };

  const updateEditingQuestion = (field, value) => {
    setEditingQuestion(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'questionType') {
        if (value === 'True/False') {
          next.options = ['True', 'False'];
          if (!next.options.includes(next.correctAnswer)) next.correctAnswer = 'True';
        } else if (value === 'Multiple Choice') {
          next.options = prev.options && prev.options.length >= 2 && prev.questionType === 'Multiple Choice'
            ? prev.options
            : ['', '', '', ''];
          if (!next.options.includes(next.correctAnswer)) next.correctAnswer = '';
        } else {
          next.options = [];
        }
      }
      return next;
    });
  };

  const updateEditingOption = (index, value) => {
    setEditingQuestion(prev => {
      const options = [...prev.options];
      const wasCorrect = prev.correctAnswer === options[index];
      options[index] = value;
      return { ...prev, options, correctAnswer: wasCorrect ? value : prev.correctAnswer };
    });
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;
    const { isNew, ...question } = editingQuestion;
    const cleaned = {
      ...question,
      question: question.question.trim(),
      options: OPTION_QUESTION_TYPES.includes(question.questionType)
        ? question.options.map(o => o.trim()).filter(Boolean)
        : [],
      correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer.trim() : question.correctAnswer,
      points: Math.max(0, Number(question.points) || 0),
      topic: (question.topic || '').trim() || 'General'
    };
    setQuestions(prev => (isNew
      ? [...prev, cleaned]
      : prev.map(q => (q.id === cleaned.id ? cleaned : q))));
    setEditingQuestion(null);
  };

  const editingQuestionError = (() => {
    if (!editingQuestion) return null;
    if (!editingQuestion.question.trim()) return 'Enter the question text';
    if (OPTION_QUESTION_TYPES.includes(editingQuestion.questionType)) {
      const options = editingQuestion.options.map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return 'Provide at least two options';
      if (!editingQuestion.correctAnswer || !options.includes(editingQuestion.correctAnswer.trim())) {
        return 'Select the correct answer';
      }
    }
    if (!(Number(editingQuestion.points) > 0)) return 'Points must be greater than 0';
    return null;
  })();

  // Remove a question
  const handleRemoveQuestion = (id) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Save assessment
  const handleSave = async () => {
    if (loading) return;
    const emptyIndex = questions.findIndex(q => !String(q.question || '').trim());
    if (emptyIndex !== -1) {
      notify(`Question ${emptyIndex + 1} has no text. Edit or remove it before saving.`, 'warning');
      return;
    }

    // Students' AssessmentTake and the backend grader expect kebab-case types
    const normalizedQuestions = questions.map(q => {
      const type = normalizeQuestionType(q.questionType);
      return { ...q, questionType: type, type, points: pointsOf(q) };
    });

    // Prepare assessment data
    const assessmentData = {
      id: draftIdRef.current,
      title: title.trim(),
      description,
      courseId,
      courseName: courses.find(c => c.id === courseId)?.title,
      syllabusTitle,
      dueDate,
      timeLimit: Number(timeLimit) || 0,
      randomizeQuestions,
      showAnswers,
      assignToAllStudents,
      questions: normalizedQuestions,
      pattern: selectedPattern,
      // Add these fields for student display
      questionCount: questions.length,
      totalPoints: calculateTotalPoints(),
      createdAt: new Date().toISOString(),
      // Explicitly set status based on whether it's assigned to all students
      status: assignToAllStudents ? 'published' : 'draft',
      // Include visibility settings to match SyllabusUpload component
      visibility: {
        instructorCanSeeAnswers: true,
        studentsCanSeeAnswers: showAnswers,
        studentsCanSeeSyllabusTitle: true,
        showResultsImmediately: true,
        pattern: selectedPattern ? {
          name: selectedPattern.name,
          description: selectedPattern.description,
          questionDistribution: selectedPattern.questionDistribution || selectedPattern.structure,
          difficulty: selectedPattern.difficulty
        } : null
      }
    };
    
    setLoading(true);
    
    try {
      // Use the assessment save service to save both locally and to backend
      await saveAssessment(assessmentData);
      notify('Assessment saved successfully!', 'success');
      
      // Navigate back to course management page
      navigate(`/instructor/courses/${courseId}`);
    } catch (error) {
      console.error('Error saving assessment:', error);
      notify(`Error saving assessment: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate total points
  const calculateTotalPoints = () => {
    return questions.reduce((total, question) => total + pointsOf(question), 0);
  };
  
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }
  
  // For the initial steps (0-1), we'll use the SyllabusUpload component
  if (activeStep < 2) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditing ? 'Edit Assessment' : 'Create New Assessment'}
        </Typography>
        
        <SyllabusUpload onAnalysisComplete={handleSyllabusAnalysisComplete} />
      </Container>
    );
  }
  
  // For steps 2-3, we'll use our own UI
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEditing ? 'Edit Assessment' : 'Create New Assessment'}
      </Typography>
      
      <Stepper activeStep={activeStep - 2} sx={{ mb: 4 }}>
        {['Customize Questions', 'Settings & Review'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        {/* Step 3: Customize Questions */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Customize Questions
            </Typography>
            
            {/* Display syllabus analysis summary */}
            {syllabusAnalysis && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Based on analysis of: {syllabusAnalysis.basicInfo?.courseTitle}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {syllabusAnalysis.learningOutcomes?.keyTopics?.map((topic, index) => (
                    <Chip key={index} label={topic} size="small" />
                  ))}
                </Box>
                
                {/* Add pattern selection indicator */}
                {selectedPattern && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Pattern: <strong>{selectedPattern.name}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedPattern.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <img src="https://www.gstatic.com/lamda/images/gemini_logo_v1.svg" 
                        alt="Gemini AI" 
                        width="16" 
                        height="16" 
                        style={{ marginRight: '4px' }} 
                      />
                      <Typography variant="caption" color="text.secondary">
                        Questions will be generated using Gemini AI
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                {/* Generate questions button always visible when syllabus is uploaded */}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    variant="contained" 
                    onClick={handleGenerateQuestions}
                    disabled={generating || !selectedPattern}
                    startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                    size="small"
                  >
                    {generating ? 'Generating...' : 'Generate with Gemini'}
                  </Button>
                </Box>
              </Paper>
            )}
            
            <Typography variant="body1" paragraph>
              Review, edit, or add assessment questions. You can modify AI-generated questions or create your own.
            </Typography>
            
            <Box sx={{ width: '100%', mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab label="All Questions" />
                <Tab label="Multiple Choice" />
                <Tab label="Free Response" />
                <Tab label="Programming" />
              </Tabs>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />}
                onClick={handleAddQuestion}
              >
                Add New Question
              </Button>
            </Box>
            
            <List>
              {questions
                .filter(q => {
                  if (activeTab === 0) return true;
                  if (activeTab === 1) return OPTION_QUESTION_TYPES.includes(q.questionType);
                  if (activeTab === 2) return ['Short Answer', 'Essay'].includes(q.questionType);
                  if (activeTab === 3) return q.questionType === 'Programming';
                  return true;
                })
                .map((question, index) => (
                  <React.Fragment key={question.id}>
                    <ListItem
                      alignItems="flex-start"
                      secondaryAction={
                        <Box>
                          <IconButton edge="end" aria-label="edit question" onClick={() => handleEditQuestion(question)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleRemoveQuestion(question.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                      sx={{ py: 2 }}
                    >
                      <ListItemIcon sx={{ mt: 0 }}>
                        <Typography variant="body1">
                          {index + 1}.
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div' }}
                        primary={
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body1">{question.question || <em>(no question text)</em>}</Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                              <Chip 
                                label={question.questionType} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                              />
                              <Chip 
                                label={question.difficulty} 
                                size="small" 
                                color={
                                  question.difficulty === 'Easy' ? 'success' : 
                                  question.difficulty === 'Medium' ? 'primary' : 
                                  'error'
                                }
                                variant="outlined"
                              />
                              <Chip 
                                label={`${question.points} pts`} 
                                size="small" 
                                variant="outlined"
                              />
                              <Chip 
                                label={question.topic} 
                                size="small" 
                                variant="outlined"
                              />
                            </Box>
                            
                            {OPTION_QUESTION_TYPES.includes(question.questionType) && (
                              <List dense>
                                {(question.options || []).map((option, idx) => (
                                  <ListItem key={idx} dense sx={{ py: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                      {option === question.correctAnswer ? (
                                        <CheckCircleIcon color="success" fontSize="small" />
                                      ) : (
                                        <Typography variant="body2">
                                          {String.fromCharCode(65 + idx)}.
                                        </Typography>
                                      )}
                                    </ListItemIcon>
                                    <ListItemText primary={option} />
                                  </ListItem>
                                ))}
                              </List>
                            )}
                            
                            {(question.questionType === 'Short Answer' || question.questionType === 'Essay') && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  <b>Sample Answer:</b> {String(question.correctAnswer || '').length > 100 ?
                                    `${String(question.correctAnswer).substring(0, 100)}...` :
                                    String(question.correctAnswer || '')}
                                </Typography>
                              </Box>
                            )}
                            
                            {question.questionType === 'Programming' && (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  <b>Sample Solution</b> (abbreviated)
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontFamily: 'monospace', 
                                    whiteSpace: 'pre-wrap',
                                    bgcolor: 'grey.100',
                                    p: 1,
                                    borderRadius: 1,
                                    maxHeight: 80,
                                    overflow: 'hidden'
                                  }}
                                >
                                  {String(question.correctAnswer || '').split('\n').slice(0, 3).join('\n')}...
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
            </List>
            
            {questions.length === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  {generating ? 
                    'Generating questions with Gemini AI...' : 
                    'No questions added yet. Click "Generate with Gemini" to create questions based on your syllabus and selected pattern.'}
                </Typography>
                {!generating && !selectedPattern && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    Please select a pattern first to enable question generation.
                  </Typography>
                )}
                {!generating && (
                  <Button 
                    variant="contained" 
                    onClick={handleGenerateQuestions}
                    disabled={generating || !selectedPattern}
                    startIcon={<AutoAwesomeIcon />}
                    sx={{ mt: 2 }}
                  >
                    Generate Questions with Gemini
                  </Button>
                )}
                {generating && (
                  <CircularProgress size={40} sx={{ mt: 2 }} />
                )}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
              <Button 
                variant="contained" 
                onClick={() => setActiveStep(3)}
                disabled={questions.length === 0}
              >
                Continue to Settings
              </Button>
            </Box>
          </Box>
        )}
        
        {/* Step 4: Settings & Review */}
        {activeStep === 3 && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Assessment Settings & Review
            </Typography>
            <Typography variant="body1" paragraph>
              Configure assessment settings and review all details before saving.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <TextField
                  label="Assessment Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  margin="normal"
                  required
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  margin="normal"
                  multiline
                  rows={3}
                />
                <FormControl fullWidth margin="normal" required>
                  <InputLabel>Course</InputLabel>
                  <Select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    label="Course"
                  >
                    {courses.map(course => (
                      <MenuItem key={course.id} value={course.id}>
                        {course.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Due Date & Time"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  fullWidth
                  margin="normal"
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Assessment Settings
                </Typography>
                <TextField
                  label="Time Limit (minutes)"
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  fullWidth
                  margin="normal"
                  InputProps={{ inputProps: { min: 0 } }}
                  helperText="Set to 0 for no time limit"
                />
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={randomizeQuestions}
                        onChange={(e) => setRandomizeQuestions(e.target.checked)}
                      />
                    }
                    label="Randomize question order"
                  />
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showAnswers}
                        onChange={(e) => setShowAnswers(e.target.checked)}
                      />
                    }
                    label="Show answers after submission"
                  />
                </Box>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Availability Settings
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={assignToAllStudents}
                        onChange={(e) => setAssignToAllStudents(e.target.checked)}
                      />
                    }
                    label="Make visible to all students immediately"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                    When enabled, all enrolled students will see this assessment on their dashboard
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Assessment Summary
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Question Type</TableCell>
                        <TableCell align="right">Count</TableCell>
                        <TableCell align="right">Points Each</TableCell>
                        <TableCell align="right">Total Points</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...new Set([...EDITABLE_QUESTION_TYPES, ...questions.map(q => q.questionType)])].map(type => {
                        const typeQuestions = questions.filter(q => q.questionType === type);
                        if (typeQuestions.length === 0) return null;

                        return (
                          <TableRow key={type}>
                            <TableCell component="th" scope="row">
                              {type}
                            </TableCell>
                            <TableCell align="right">{typeQuestions.length}</TableCell>
                            <TableCell align="right">
                              {typeQuestions.length > 0
                                ? `${Math.min(...typeQuestions.map(pointsOf))} - ${Math.max(...typeQuestions.map(pointsOf))}`
                                : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              {typeQuestions.reduce((sum, q) => sum + pointsOf(q), 0)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ '& td': { fontWeight: 'bold' } }}>
                        <TableCell>Total</TableCell>
                        <TableCell align="right">{questions.length}</TableCell>
                        <TableCell align="right">-</TableCell>
                        <TableCell align="right">{calculateTotalPoints()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button variant="outlined" onClick={() => setActiveStep(2)}>
                Back
              </Button>
              <Box>
                <Button 
                  variant="outlined" 
                  sx={{ mr: 2 }}
                  startIcon={<PreviewIcon />}
                >
                  Preview
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleSave}
                  disabled={loading || !title.trim() || !courseId}
                  startIcon={<CheckCircleIcon />}
                >
                  {isEditing ? 'Save Changes' : 'Create Assessment'}
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Add / edit question dialog */}
      <Dialog open={Boolean(editingQuestion)} onClose={() => setEditingQuestion(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editingQuestion?.isNew ? 'Add Question' : 'Edit Question'}</DialogTitle>
        {editingQuestion && (
          <DialogContent>
            <TextField
              autoFocus
              label="Question"
              value={editingQuestion.question}
              onChange={(e) => updateEditingQuestion('question', e.target.value)}
              fullWidth
              multiline
              minRows={2}
              margin="dense"
              required
            />
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Question Type</InputLabel>
                  <Select
                    value={EDITABLE_QUESTION_TYPES.includes(editingQuestion.questionType) ? editingQuestion.questionType : ''}
                    label="Question Type"
                    onChange={(e) => updateEditingQuestion('questionType', e.target.value)}
                  >
                    {EDITABLE_QUESTION_TYPES.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4}>
                <FormControl fullWidth margin="dense">
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={['Easy', 'Medium', 'Hard'].includes(editingQuestion.difficulty) ? editingQuestion.difficulty : 'Medium'}
                    label="Difficulty"
                    onChange={(e) => updateEditingQuestion('difficulty', e.target.value)}
                  >
                    <MenuItem value="Easy">Easy</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="Hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField
                  label="Points"
                  type="number"
                  value={editingQuestion.points}
                  onChange={(e) => updateEditingQuestion('points', e.target.value)}
                  fullWidth
                  margin="dense"
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Topic"
              value={editingQuestion.topic || ''}
              onChange={(e) => updateEditingQuestion('topic', e.target.value)}
              fullWidth
              margin="dense"
            />

            {editingQuestion.questionType === 'Multiple Choice' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Options (select the correct answer)
                </Typography>
                {editingQuestion.options.map((option, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <IconButton
                      size="small"
                      aria-label={`mark option ${String.fromCharCode(65 + idx)} correct`}
                      onClick={() => updateEditingQuestion('correctAnswer', option)}
                      disabled={!option.trim()}
                    >
                      <CheckCircleIcon
                        fontSize="small"
                        color={option.trim() && option === editingQuestion.correctAnswer ? 'success' : 'disabled'}
                      />
                    </IconButton>
                    <TextField
                      size="small"
                      label={`Option ${String.fromCharCode(65 + idx)}`}
                      value={option}
                      onChange={(e) => updateEditingOption(idx, e.target.value)}
                      fullWidth
                    />
                  </Box>
                ))}
              </Box>
            )}

            {editingQuestion.questionType === 'True/False' && (
              <FormControl fullWidth margin="dense">
                <InputLabel>Correct Answer</InputLabel>
                <Select
                  value={editingQuestion.correctAnswer === 'False' ? 'False' : 'True'}
                  label="Correct Answer"
                  onChange={(e) => updateEditingQuestion('correctAnswer', e.target.value)}
                >
                  <MenuItem value="True">True</MenuItem>
                  <MenuItem value="False">False</MenuItem>
                </Select>
              </FormControl>
            )}

            {!OPTION_QUESTION_TYPES.includes(editingQuestion.questionType) && (
              <TextField
                label={editingQuestion.questionType === 'Programming' ? 'Sample Solution' : 'Sample Answer'}
                value={editingQuestion.correctAnswer || ''}
                onChange={(e) => updateEditingQuestion('correctAnswer', e.target.value)}
                fullWidth
                multiline
                minRows={3}
                margin="dense"
                InputProps={editingQuestion.questionType === 'Programming' ? { sx: { fontFamily: 'monospace' } } : undefined}
              />
            )}

            {editingQuestionError && (
              <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                {editingQuestionError}
              </Typography>
            )}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditingQuestion(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveQuestion} disabled={Boolean(editingQuestionError)}>
            {editingQuestion?.isNew ? 'Add Question' : 'Save Question'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AssessmentCreation;