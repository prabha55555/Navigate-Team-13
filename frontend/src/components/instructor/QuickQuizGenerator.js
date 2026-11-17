import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Ported from react-bootstrap/react-toastify (neither package is installed, so
// importing the old component broke the build) to MUI.

const QUESTION_TYPES = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True/False' },
  { value: 'short-answer', label: 'Short Answer' }
];

const AI_TIMEOUT_MS = 120000;

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

// Split `total` questions across the selected types so the counts add up exactly
const distributeQuestions = (total, types) => {
  const base = Math.floor(total / types.length);
  const remainder = total % types.length;
  return types
    .map((type, index) => ({ type, count: base + (index < remainder ? 1 : 0) }))
    .filter(item => item.count > 0);
};

const QuickQuizGenerator = ({ syllabusAnalysis: providedAnalysis = null, onNavigateToPatternSelector }) => {
  const navigate = useNavigate();
  const [selectedSyllabusId, setSelectedSyllabusId] = useState('');
  const [syllabusOptions, setSyllabusOptions] = useState([]);
  const [syllabiError, setSyllabiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [iterationHistory, setIterationHistory] = useState([]);
  const [showIterationModal, setShowIterationModal] = useState(false);
  const [iterationFeedback, setIterationFeedback] = useState('');
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const timeoutRef = useRef(null);

  // Quiz parameter state
  const [quizParameters, setQuizParameters] = useState({
    questionCount: 10,
    difficulty: 'medium',
    timeLimit: 15,
    questionTypes: ['multiple-choice', 'true-false', 'short-answer']
  });

  // Clear the "taking longer than expected" timer on unmount
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  useEffect(() => {
    // A syllabus analysis passed in by the parent needs no server lookup
    if (providedAnalysis) return undefined;

    let cancelled = false;
    // Load available syllabi
    axios.get('/api/assessment/syllabus/list')
      .then(response => {
        if (cancelled) return;
        if (response.data?.success && Array.isArray(response.data.syllabi)) {
          setSyllabusOptions(response.data.syllabi);
        } else {
          setSyllabiError('No analyzed syllabi are available yet.');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Error fetching syllabi:', err);
        setSyllabiError('No analyzed syllabi are available on the server. Analyze a syllabus in the Assessment Creator first.');
      });

    return () => {
      cancelled = true;
    };
  }, [providedAnalysis]);

  const handleQuestionTypeToggle = (type) => {
    setQuizParameters(prev => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(type)
        ? prev.questionTypes.filter(t => t !== type)
        : [...prev.questionTypes, type]
    }));
  };

  const handleQuizParameterChange = (e) => {
    const { name, value, type } = e.target;
    setQuizParameters(prev => ({
      ...prev,
      [name]: type === 'number' ? value.replace(/[^\d]/g, '') : value
    }));
  };

  const handleGenerateQuiz = async () => {
    if (loading) return;
    if (!providedAnalysis && !selectedSyllabusId) {
      setError('Please select a syllabus first');
      return;
    }

    // Ensure at least one question type is selected
    if (quizParameters.questionTypes.length === 0) {
      setError('Please select at least one question type');
      return;
    }

    const questionCount = Math.min(50, Math.max(1, parseInt(quizParameters.questionCount, 10) || 10));
    const timeLimit = Math.min(180, Math.max(1, parseInt(quizParameters.timeLimit, 10) || 15));

    setLoading(true);
    setError(null);
    setNotice(null);
    setGeneratedQuiz(null);
    setTimeoutWarning(false);
    // Reset iteration history when generating a new quiz
    setIterationHistory([]);

    // Set a timeout warning if generation takes too long
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setTimeoutWarning(true), 15000);

    try {
      let syllabusAnalysis = providedAnalysis;
      if (!syllabusAnalysis) {
        // First get the syllabus analysis
        const syllabusResponse = await axios.get(`/api/assessment/syllabus/${encodeURIComponent(selectedSyllabusId)}`);
        if (!syllabusResponse.data?.success || !syllabusResponse.data.syllabusAnalysis) {
          throw new Error('Failed to retrieve syllabus analysis');
        }
        syllabusAnalysis = syllabusResponse.data.syllabusAnalysis;
      }

      // Format the pattern based on the quiz parameters for consistent pattern-based generation
      const distribution = distributeQuestions(questionCount, quizParameters.questionTypes);
      const quizPattern = {
        name: 'Quick Quiz',
        description: `A ${quizParameters.difficulty} difficulty quiz with ${questionCount} questions`,
        structure: distribution.map(({ type, count }) => ({
          questionType: QUESTION_TYPES.find(t => t.value === type)?.label || type,
          count,
          pointsPerQuestion: 1
        })),
        totalPoints: questionCount,
        estimatedTime: timeLimit,
        difficulty: quizParameters.difficulty,
        isQuickQuiz: true
      };

      // Generate quiz using the pattern-based approach
      const response = await axios.post('/api/assessment/generate-questions', {
        syllabusAnalysis,
        pattern: quizPattern
      }, { timeout: AI_TIMEOUT_MS });

      if (response.data?.success && response.data.assessment) {
        setGeneratedQuiz(response.data.assessment);
        setNotice('Quiz generated successfully!');
      } else {
        setError(response.data?.message || 'Failed to generate quiz');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      setError(errorMessage(err, 'Failed to generate quiz'));
    } finally {
      clearTimeout(timeoutRef.current);
      setTimeoutWarning(false);
      setLoading(false);
    }
  };

  const handleIterateQuiz = async () => {
    if (loading) return;
    if (!iterationFeedback.trim()) {
      setError('Please provide some feedback for improvement');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/assessment/iterate-quiz', {
        syllabusId: selectedSyllabusId || null,
        currentQuiz: generatedQuiz,
        feedback: iterationFeedback,
        parameters: quizParameters
      }, { timeout: AI_TIMEOUT_MS });

      if (response.data?.success && response.data.iteratedQuiz) {
        // Keep the previous version so it can be restored with Undo
        setIterationHistory(prev => [...prev, generatedQuiz]);
        setGeneratedQuiz(response.data.iteratedQuiz);
        setShowIterationModal(false);
        setIterationFeedback('');
        setNotice('Quiz improved successfully!');
      } else {
        setError('Failed to improve quiz. Please try again.');
      }
    } catch (err) {
      console.error('Error iterating quiz:', err);
      setError(errorMessage(err, 'Failed to improve quiz. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleUndoIteration = () => {
    if (iterationHistory.length === 0) {
      setNotice('No previous versions available');
      return;
    }

    // Restore the last quiz from history
    setGeneratedQuiz(iterationHistory[iterationHistory.length - 1]);
    setIterationHistory(prev => prev.slice(0, -1));
    setNotice('Reverted to previous version');
  };

  // Hand the quiz to the Assessment Creator (it reads location.state.quiz)
  const handleUseQuiz = () => {
    navigate('/instructor/assessment', {
      state: { quiz: generatedQuiz, syllabusId: selectedSyllabusId || null }
    });
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Quick Quiz Generator
      </Typography>

      <Grid container spacing={2}>
        {!providedAnalysis && (
          <Grid item xs={12}>
            <TextField
              select
              fullWidth
              label="Select Syllabus"
              value={selectedSyllabusId}
              onChange={(e) => setSelectedSyllabusId(e.target.value)}
              disabled={loading || syllabusOptions.length === 0}
              helperText={syllabiError || ' '}
              error={Boolean(syllabiError)}
            >
              <MenuItem value="">-- Select a syllabus --</MenuItem>
              {syllabusOptions.map(syllabus => (
                <MenuItem key={syllabus.id} value={syllabus.id}>
                  {syllabus.name || [syllabus.courseCode, syllabus.courseTitle].filter(Boolean).join(' - ') || syllabus.id}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            type="number"
            name="questionCount"
            label="Number of Questions"
            value={quizParameters.questionCount}
            onChange={handleQuizParameterChange}
            inputProps={{ min: 1, max: 50 }}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            select
            fullWidth
            name="difficulty"
            label="Difficulty"
            value={quizParameters.difficulty}
            onChange={handleQuizParameterChange}
            disabled={loading}
          >
            <MenuItem value="easy">Easy</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="hard">Hard</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            type="number"
            name="timeLimit"
            label="Time Limit (minutes)"
            value={quizParameters.timeLimit}
            onChange={handleQuizParameterChange}
            inputProps={{ min: 1, max: 180 }}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12}>
          <FormLabel component="legend">Question Types</FormLabel>
          <FormGroup row>
            {QUESTION_TYPES.map(type => (
              <FormControlLabel
                key={type.value}
                control={
                  <Checkbox
                    checked={quizParameters.questionTypes.includes(type.value)}
                    onChange={() => handleQuestionTypeToggle(type.value)}
                    disabled={loading}
                  />
                }
                label={type.label}
              />
            ))}
          </FormGroup>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleGenerateQuiz}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Generating...' : 'Generate Quiz'}
          </Button>
        </Grid>
      </Grid>

      {timeoutWarning && <Alert severity="warning" sx={{ mt: 2 }}>Quiz generation is taking longer than expected...</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mt: 2 }} onClose={() => setNotice(null)}>{notice}</Alert>}

      {generatedQuiz && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6">{generatedQuiz.title}</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {generatedQuiz.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip size="small" label={`Questions: ${generatedQuiz.questions?.length || 0}`} />
              {generatedQuiz.timeLimit != null && <Chip size="small" label={`Time: ${generatedQuiz.timeLimit} min`} />}
              {generatedQuiz.totalPoints != null && <Chip size="small" label={`Points: ${generatedQuiz.totalPoints}`} />}
            </Box>
            {(generatedQuiz.questions || []).map((question, index) => (
              <Typography key={question.id || index} variant="body2" sx={{ mb: 0.5 }}>
                {index + 1}. {question.question}
              </Typography>
            ))}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              <Button variant="contained" onClick={handleUseQuiz} disabled={loading}>
                Use in Assessment Creator
              </Button>
              <Button variant="outlined" onClick={() => setShowIterationModal(true)} disabled={loading}>
                Improve Quiz
              </Button>
              <Button variant="outlined" onClick={handleUndoIteration} disabled={loading || iterationHistory.length === 0}>
                Undo
              </Button>
              {onNavigateToPatternSelector && (
                <Button onClick={onNavigateToPatternSelector} disabled={loading}>
                  Use a Pattern Instead
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog open={showIterationModal} onClose={() => !loading && setShowIterationModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Improve Quiz</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            label="Feedback"
            value={iterationFeedback}
            onChange={(e) => setIterationFeedback(e.target.value)}
            disabled={loading}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowIterationModal(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={handleIterateQuiz} disabled={loading || !iterationFeedback.trim()}>
            {loading ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuickQuizGenerator;
