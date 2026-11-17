import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, List, ListItem, MenuItem, Paper, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import axios from 'axios'; // Import axios instead of using fetch
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate hook
import { loadInstructorCourses, normalizeQuestionType } from '../../pages/instructor/instructorData';
import { saveAssessment } from '../../services/assessmentSaveService';
import AssessmentPatternSelector from './AssessmentPatternSelector';

// Relative by default so requests go through the CRA dev proxy / same origin.
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Configure axios instance with base URL and default timeout
const api = axios.create({
  baseURL: API_URL,
  timeout: 120000 // AI analysis/generation can take a while; never hang forever
});

// Prefer the backend's message over axios' generic "Request failed with status code ..."
const getErrorMessage = (err, fallback) => {
  if (err?.response?.status === 401) {
    return 'Authentication error. Please log in again to continue.';
  }
  if (err?.code === 'ECONNABORTED') {
    return 'The request timed out. The AI service may be busy - please try again.';
  }
  return err?.response?.data?.message || err?.message || fallback;
};

// Stable no-op so AssessmentPatternSelector does not see a new callback every render
const noop = () => {};

// Create axios interceptor to add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const steps = [
  'Upload Syllabus',
  'Select Pattern & Generate Quiz',
  'Customize Questions', 
  'Settings & Review'
];

const SyllabusUpload = () => {
  const [file, setFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('file');
  const [syllabusAnalysis, setSyllabusAnalysis] = useState(null);
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [generatedAssessment, setGeneratedAssessment] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatingAssessment, setGeneratingAssessment] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [syllabusTopics, setSyllabusTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const navigate = useNavigate(); // Initialize navigate hook

  const patternSectionRef = useRef(null);

  // Any change to the syllabus input invalidates a previous analysis/generation
  const resetAnalysis = () => {
    setSyllabusAnalysis(null);
    setGeneratedAssessment(null);
    setSyllabusTopics([]);
    setSelectedTopics([]);
    setSuccess(null);
  };

  const isPlainTextFile = (f) => Boolean(f) && (f.type === 'text/plain' || /\.txt$/i.test(f.name || ''));

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    // Allow re-selecting the same file later (onChange would not fire otherwise)
    event.target.value = '';
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      resetAnalysis();

      if (isPlainTextFile(selectedFile)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setTextContent(e.target.result);
        };
        reader.readAsText(selectedFile);
      }
    }
  };

  const handleTextChange = (event) => {
    setTextContent(event.target.value);
    setError(null);
    if (syllabusAnalysis) resetAnalysis();
  };

  const handleUploadMethodChange = (method) => {
    if (method === uploadMethod) return;
    setUploadMethod(method);
    setError(null);
    resetAnalysis();
  };

  const handleAnalyzeSyllabus = async () => {
    if (analyzing) return;
    try {
      setError(null);
      setSuccess(null);
      setAnalyzing(true);

      let syllabusContent = '';

      if (uploadMethod === 'file' && file) {
        if (isPlainTextFile(file)) {
          syllabusContent = textContent;
        } else {
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadResponse = await api.post('/instructor/assessment/upload-syllabus', formData);
          
          if (uploadResponse.status !== 200) {
            throw new Error(`File upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
          }
          
          const uploadData = uploadResponse.data;
          syllabusContent = uploadData.syllabusContent || '';
        }
      } else if (uploadMethod === 'text' && textContent) {
        syllabusContent = textContent;
      } else {
        throw new Error('Please upload a file or enter text content');
      }

      // The backend rejects anything shorter than 50 characters
      if (!syllabusContent || syllabusContent.trim().length < 50) {
        throw new Error('The syllabus content appears to be too short or empty. Please ensure you have uploaded a complete syllabus document.');
      }

      const analysisResponse = await api.post('/assessment/analyze-syllabus', { syllabusContent });

      const analysisData = analysisResponse.data;

      if (!analysisData.success || !analysisData.syllabusAnalysis) {
        throw new Error(analysisData.message || 'Failed to analyze syllabus');
      }

      setSyllabusAnalysis(analysisData.syllabusAnalysis);
      if (Array.isArray(analysisData.syllabusTopics) && analysisData.syllabusTopics.length > 0) {
        setSyllabusTopics(analysisData.syllabusTopics);
        setSelectedTopics(analysisData.syllabusTopics);
      } else {
        // Try to get topics from the learning outcomes
        const fallbackTopics = analysisData.syllabusAnalysis.learningOutcomes?.keyTopics || [];
        
        // If we still don't have topics, provide some mock topics based on common educational subjects
        if (fallbackTopics.length === 0) {
          const mockTopics = [
            "Introduction to the Subject",
            "Fundamental Concepts",
            "Theoretical Frameworks",
            "Practical Applications",
            "Problem-Solving Techniques",
            "Critical Analysis",
            "Research Methods",
            "Case Studies",
            "Professional Ethics",
            "Current Trends"
          ];
          
          setSyllabusTopics(mockTopics);
          setSelectedTopics(mockTopics);
        } else {
          setSyllabusTopics(fallbackTopics);
          setSelectedTopics(fallbackTopics);
        }
      }
      
      setSuccess('Syllabus successfully analyzed! Proceeding to pattern selection.');
      
      setActiveStep(1);
    } catch (err) {
      console.error('Error analyzing syllabus:', err);
      const message = getErrorMessage(err, 'Error analyzing syllabus. Please try again.');

      if (message.includes('too short') || message.includes('empty')) {
        setError('The syllabus content is too short. Please upload a complete syllabus document with sufficient content for analysis.');
      } else {
        setError(message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 0 "Continue": analyse once, reuse the analysis if the input has not changed
  const handleContinueToPatterns = () => {
    if (syllabusAnalysis) {
      setActiveStep(1);
      return;
    }
    handleAnalyzeSyllabus();
  };

  const handleGenerateAssessment = async () => {
    if (generatingAssessment) return;
    if (!selectedPattern) {
      setError('Please select an assessment pattern first');
      return;
    }
    if (!syllabusAnalysis) {
      setError('Please upload and analyze a syllabus first');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setGeneratingAssessment(true);

      const response = await api.post('/instructor/assessment/generate-questions', {
        syllabusAnalysis: syllabusAnalysis,
        pattern: {
          ...selectedPattern,
          topicFocus: selectedTopics,
          modelName: process.env.REACT_APP_GEMINI_MODEL || 'gemini-1.5-flash'
        }
      });

      const data = response.data;

      if (!data.success || !data.assessment) {
        throw new Error(data.message || 'Failed to generate assessment');
      }
      if (!Array.isArray(data.assessment.questions) || data.assessment.questions.length === 0) {
        throw new Error('The AI did not return any questions. Please try again or choose a different pattern.');
      }

      setGeneratedAssessment(data.assessment);
      setSuccess('Assessment successfully generated!');
      setActiveStep(2);
    } catch (err) {
      console.error('Error generating assessment:', err);
      setError(getErrorMessage(err, 'Error generating assessment. Please try again.'));
    } finally {
      setGeneratingAssessment(false);
    }
  };

  const handleBackToUpload = () => {
    setError(null);
    setActiveStep(0);
  };
  
  const handleOpenTopicDialog = () => {
    setTopicDialogOpen(true);
  };
  
  const handleCloseTopicDialog = () => {
    setTopicDialogOpen(false);
  };
  
  const handleToggleTopic = (topic) => {
    setSelectedTopics(prev => {
      if (prev.includes(topic)) {
        return prev.filter(t => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
  };
  
  const handleSelectAllTopics = () => {
    setSelectedTopics([...syllabusTopics]);
  };
  
  const handleDeselectAllTopics = () => {
    setSelectedTopics([]);
  };
  
  const renderTopicSelector = () => (
    <Box mt={2} mb={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Selected Topics ({selectedTopics.length}/{syllabusTopics.length})</Typography>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={handleOpenTopicDialog}
        >
          Manage Topics
        </Button>
      </Box>
      
      <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
        {selectedTopics.map((topic, index) => (
          <Chip 
            key={index} 
            label={topic} 
            color="primary" 
            variant="outlined" 
          />
        ))}
        {selectedTopics.length === 0 && (
          <Typography color="text.secondary" variant="body2">No topics selected. Click "Manage Topics" to select topics for your assessment.</Typography>
        )}
      </Box>
      
      <Dialog open={topicDialogOpen} onClose={handleCloseTopicDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6">Select Topics for Assessment</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose which topics to include in your assessment
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box mb={2} display="flex" justifyContent="space-between">
            <Button size="small" onClick={handleSelectAllTopics}>Select All</Button>
            <Button size="small" onClick={handleDeselectAllTopics}>Deselect All</Button>
          </Box>
          <List sx={{ pt: 0 }}>
            {syllabusTopics.map((topic, index) => (
              <ListItem key={index} disablePadding>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={selectedTopics.includes(topic)}
                      onChange={() => handleToggleTopic(topic)}
                    />
                  }
                  label={topic}
                  sx={{ width: '100%', py: 0.5 }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTopicDialog} color="primary">Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  const renderUploadSyllabusStep = () => (
    <Box>
      <Typography variant="body1" paragraph>
        Upload your course syllabus to move to the next step where you can select a pattern and generate assessment questions.
      </Typography>

      <Box mb={3}>
        <Box sx={{ display: 'flex', mb: 2 }}>
          <Button
            variant={uploadMethod === 'file' ? 'contained' : 'outlined'}
            onClick={() => handleUploadMethodChange('file')}
            disabled={analyzing}
            sx={{ mr: 1 }}
          >
            File Upload
          </Button>
          <Button
            variant={uploadMethod === 'text' ? 'contained' : 'outlined'}
            onClick={() => handleUploadMethodChange('text')}
            disabled={analyzing}
          >
            Enter Text
          </Button>
        </Box>

        {uploadMethod === 'file' ? (
          <Box sx={{ mb: 2 }}>
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUploadIcon />}
              fullWidth
              disabled={analyzing}
              sx={{ mb: 1 }}
            >
              Upload Syllabus
              <VisuallyHiddenInput type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Selected file: {file.name}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Supported formats: PDF, DOC, DOCX, TXT
            </Typography>
          </Box>
        ) : (
          <TextField
            multiline
            rows={6}
            fullWidth
            placeholder="Paste syllabus content here..."
            value={textContent}
            onChange={handleTextChange}
            disabled={analyzing}
            sx={{ mb: 2 }}
            variant="outlined"
          />
        )}
      </Box>

      {(!file && uploadMethod === 'file') && (
        <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Sample Content (for testing):
          </Typography>
          <Box sx={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.75rem' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              Unit 1: Introduction to Python Programming
              Unit 2: Variables, Data Types, and Operators
              Unit 3: Control Flow and Looping Statements
              Unit 4: Functions and Modular Programming
              Unit 5: Data Structures and String Manipulation
            </pre>
          </Box>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleContinueToPatterns}
          disabled={analyzing || (uploadMethod === 'file' && !file) || (uploadMethod === 'text' && !textContent.trim())}
        >
          {analyzing ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Analyzing syllabus...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </Box>
    </Box>
  );

  const renderPatternSelectionStep = () => (
    <Box>
      <Typography variant="body1" paragraph>
        Select an assessment pattern or create a custom pattern. The selected pattern will determine the structure and types of questions generated.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {syllabusTopics && syllabusTopics.length > 0 && renderTopicSelector()}

      <Box ref={patternSectionRef} mb={3}>
        <AssessmentPatternSelector
          courseId={null}
          syllabusAnalysis={syllabusAnalysis}
          onPatternSelect={setSelectedPattern}
          onCustomPatternChange={noop}
          selectedPattern={selectedPattern}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={handleBackToUpload}
          disabled={generatingAssessment}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleGenerateAssessment}
          disabled={!selectedPattern || !syllabusAnalysis || generatingAssessment}
        >
          {generatingAssessment ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Generating...
            </>
          ) : (
            'Generate Assessment'
          )}
        </Button>
      </Box>
    </Box>
  );

  const renderQuestionsCustomizationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Assessment Preview
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {generatedAssessment ? (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {generatedAssessment.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {generatedAssessment.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Chip label={`Total: ${generatedAssessment.totalPoints} points`} />
                <Chip label={`Time: ${generatedAssessment.timeLimit} minutes`} />
                <Chip label={`Questions: ${generatedAssessment.questions?.length || 0}`} />
                <Chip 
                  label={`Generated by: ${generatedAssessment.generatedBy || 'GPT-2'}`} 
                  color="secondary" 
                />
              </Box>
            </CardContent>
          </Card>

          <Typography variant="h6" gutterBottom>
            Generated Questions
          </Typography>

          {generatedAssessment.questions?.map((question, index) => (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Question {index + 1}: {question.questionType || question.type}
                  </Typography>
                  <Chip 
                    size="small" 
                    label={`${question.points || 0} points`} 
                    color="primary" 
                    variant="outlined" 
                  />
                </Box>
                <Typography variant="body1" paragraph>
                  {question.question}
                </Typography>

                {(question.options && question.options.length > 0) && (
                  <Box sx={{ ml: 2 }}>
                    {question.options.map((option, optIndex) => (
                      <Typography 
                        key={optIndex} 
                        variant="body2" 
                        sx={{ 
                          mb: 1,
                          fontWeight: option === question.correctAnswer ? 'bold' : 'normal',
                          color: option === question.correctAnswer ? 'success.main' : 'text.primary'
                        }}
                      >
                        {String.fromCharCode(65 + optIndex)}. {option}
                        {option === question.correctAnswer && ' ✓'}
                      </Typography>
                    ))}
                  </Box>
                )}

                {(!question.options || question.options.length === 0) && question.correctAnswer && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2">
                      Sample Answer:
                    </Typography>
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      {question.correctAnswer}
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip size="small" label={`Topic: ${question.topic || 'General'}`} />
                  <Chip size="small" label={`Difficulty: ${question.difficulty || 'Medium'}`} />
                  {question.bloomLevel && (
                    <Chip 
                      size="small" 
                      label={`Bloom's Level: ${question.bloomLevel}`} 
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setActiveStep(1)}
        >
          Back to Patterns
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setActiveStep(3)}
          disabled={!generatedAssessment}
        >
          Continue to Settings
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label, index) => (
          <Step key={index}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box mt={3}>
        {activeStep === 0 && renderUploadSyllabusStep()}
        {activeStep === 1 && renderPatternSelectionStep()}
        {activeStep === 2 && renderQuestionsCustomizationStep()}
        {activeStep === 3 && (
          <SettingsAndReviewStep 
            generatedAssessment={generatedAssessment}
            syllabusAnalysis={syllabusAnalysis}
            loading={loading}
            setLoading={setLoading}
            navigate={navigate}
            setActiveStep={setActiveStep}
            selectedPattern={selectedPattern}
          />
        )}
      </Box>
    </Box>
  );
};

const SettingsAndReviewStep = ({ 
  generatedAssessment, 
  syllabusAnalysis, 
  loading, 
  setLoading, 
  navigate, 
  setActiveStep,
  selectedPattern
}) => {
  // Same course list as Course Management (demo courses + locally created ones)
  const [courses] = useState(() => loadInstructorCourses());
  const [courseId, setCourseId] = useState(() => courses[0]?.id || '');
  const [assignToAll, setAssignToAll] = useState(true);
  const [formError, setFormError] = useState(null);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  // Stable id so a retry after a failed save updates the same local record
  const draftIdRef = useRef(`assessment-${Date.now()}`);
  const navigateTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(navigateTimerRef.current), []);

  const handleSaveAssessment = async () => {
    if (loading || saved) return;
    setFormError(null);

    if (!generatedAssessment) {
      setFormError('Please generate an assessment first');
      return;
    }
    if (!courseId) {
      setFormError('Please select a course');
      return;
    }

    const course = courses.find(c => c.id === courseId);
    // Students' renderer/grader expect kebab-case types and unique question ids
    const questions = (generatedAssessment.questions || []).map((q, index) => {
      const type = normalizeQuestionType(q.questionType || q.type);
      return {
        ...q,
        id: `q${index + 1}`,
        questionType: type,
        type,
        options: Array.isArray(q.options) ? q.options : [],
        points: Number(q.points) || 1
      };
    });

    // Prepare assessment data
    const assessmentData = {
      id: draftIdRef.current,
      title: generatedAssessment.title || 'Generated Assessment',
      description: generatedAssessment.description || 'Assessment generated from syllabus analysis',
      courseId,
      courseName: course?.title,
      questions,
      timeLimit: Number(generatedAssessment.timeLimit) || 60,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
      assignToAllStudents: assignToAll,
      syllabusTitle: syllabusAnalysis?.basicInfo?.courseTitle || 'Generated Assessment',
      pattern: selectedPattern, // Include the selected pattern in the assessment data
      status: assignToAll ? 'published' : 'draft', // Explicitly set the status
      visibility: {
        instructorCanSeeAnswers: true,
        studentsCanSeeAnswers: false,
        studentsCanSeeSyllabusTitle: false,
        showResultsImmediately: true,
        pattern: selectedPattern ? {
          name: selectedPattern.name,
          description: selectedPattern.description,
          questionDistribution: selectedPattern.questionDistribution || selectedPattern.structure,
          difficulty: selectedPattern.difficulty
        } : null // Include pattern information in visibility settings
      },
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Set due date 1 week in the future
      createdAt: new Date().toISOString()
    };

    setLoading(true);
    try {
      // Saves locally (so Course Management lists it) and to POST /api/assessment/save
      await saveAssessment(assessmentData);

      const successMsg = `Assessment "${assessmentData.title}" has been saved successfully. ${assignToAll ? 'It is now available to students.' : 'It has been saved as a draft.'}`;
      setMessage(successMsg);
      setSaved(true);

      // Show the confirmation briefly, then go to the course page
      navigateTimerRef.current = setTimeout(() => {
        navigate(`/instructor/courses/${courseId}`);
      }, 1500);
    } catch (err) {
      console.error('Error saving assessment:', err);
      setFormError(`Error saving assessment: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Settings & Review
      </Typography>

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Box mb={3}>
        <TextField
          select
          label="Course"
          fullWidth
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          variant="outlined"
          disabled={loading || saved}
          sx={{ mb: 2 }}
        >
          {courses.map(course => (
            <MenuItem key={course.id} value={course.id}>
              {course.code ? `${course.code} - ${course.title}` : course.title}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Checkbox
              checked={assignToAll}
              onChange={(e) => setAssignToAll(e.target.checked)}
              disabled={loading || saved}
            />
          }
          label="Assign to all students in the course"
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setActiveStep(2)}
          disabled={loading || saved}
        >
          Back to Questions
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveAssessment}
          disabled={loading || saved || !courseId}
        >
          {loading ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Saving...
            </>
          ) : (
            saved ? 'Saved' : 'Save Assessment'
          )}
        </Button>
      </Box>
    </Box>
  );
};

export default SyllabusUpload;
