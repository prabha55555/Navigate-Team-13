import {
    AccessTime as AccessTimeIcon,
    ArrowBack as ArrowBackIcon,
    ArrowForward as ArrowForwardIcon,
    CheckCircle as CheckCircleIcon,
    Flag as FlagIcon,
    Help as HelpIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    FormControlLabel,
    FormGroup,
    Grid,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Radio,
    RadioGroup,
    TextField,
    Typography
} from '@mui/material';
import axios from 'axios';
import InlineCode from '../../components/common/InlineCode';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProctoringWebcam from '../../components/student/ProctoringWebcam';
import { useAuth } from '../../contexts/AuthContext';
import AssessmentTakeLoader, { isAnswered } from '../../services/assessmentTakeLoader';

const VIOLATION_THRESHOLD = 5; // You can adjust this value
const PASS_THRESHOLD = 50;
// Ctrl/Cmd + C, V, R are blocked. `code` covers non-Latin keyboard layouts.
const BLOCKED_COMBO_KEYS = new Set(['c', 'v', 'r']);
const BLOCKED_COMBO_CODES = new Set(['KeyC', 'KeyV', 'KeyR']);
const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];

// Fullscreen API helpers (prefixed variants for Safari / older browsers)
const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement ||
  null;

const enterFullscreen = (elem) => {
  if (!elem) return Promise.reject(new Error('Nothing to show in full screen'));
  const request =
    elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
  if (!request) return Promise.reject(new Error('Full screen is not supported'));
  try {
    return Promise.resolve(request.call(elem));
  } catch (e) {
    return Promise.reject(e);
  }
};

const exitFullscreen = () => {
  if (!getFullscreenElement()) return;
  const exit =
    document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return;
  try {
    Promise.resolve(exit.call(document)).catch(() => {});
  } catch (e) {
    // Ignore errors if the document already left full screen
  }
};

// Format the remaining time
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${secs}s`;
};

const secondsUntil = (endTime) => Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

// Owns the countdown tick so the rest of the page does not re-render every second.
// Time is derived from a fixed end timestamp, so throttled background timers can't drift.
function CountdownChip({ endTime, onExpire }) {
  const [remaining, setRemaining] = useState(() => secondsUntil(endTime));
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    let expired = false;
    const tick = () => {
      const left = secondsUntil(endTime);
      setRemaining(left);
      if (left <= 0 && !expired) {
        expired = true;
        clearInterval(intervalId);
        onExpireRef.current();
      }
    };
    const intervalId = setInterval(tick, 500);
    tick();
    return () => clearInterval(intervalId);
  }, [endTime]);

  return (
    <Chip
      icon={<AccessTimeIcon />}
      label={`Time remaining: ${formatTime(remaining)}`}
      color={remaining < 300 ? 'error' : 'default'}
      variant="outlined"
    />
  );
}

const MemoCountdownChip = memo(CountdownChip);

// An in-progress attempt (deadline, violations, answers) is kept in localStorage so a
// page reload resumes it instead of granting a fresh timer and a clean violation count.
const attemptStorageKey = (userId, assessmentId) =>
  userId && assessmentId ? `navigate:attempt:${userId}:${assessmentId}` : null;

const readAttempt = (key) => {
  if (!key) return null;
  try {
    const attempt = JSON.parse(localStorage.getItem(key));
    return attempt && typeof attempt.startTime === 'number' ? attempt : null;
  } catch {
    return null;
  }
};

const writeAttempt = (key, attempt) => {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(attempt));
  } catch {
    // Storage full or blocked: the attempt simply won't survive a reload.
  }
};

const clearAttempt = (key) => {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const AssessmentTake = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const attemptKey = attemptStorageKey(currentUser?.id, assessmentId);

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState([]);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [fullscreenViolation, setFullscreenViolation] = useState(false);
  const [proctorViolation, setProctorViolation] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [savedAttempt, setSavedAttempt] = useState(null);
  const containerRef = useRef(null);
  const attemptKeyRef = useRef(attemptKey);
  attemptKeyRef.current = attemptKey;

  // Refs read from event handlers and timers so they always see current values.
  const testActiveRef = useRef(false);
  const submittingRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const startTimeRef = useRef(null);
  const answersRef = useRef(answers);
  const assessmentRef = useRef(assessment);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    assessmentRef.current = assessment;
  }, [assessment]);

  useEffect(() => {
    let cancelled = false;
    const ifActive = (setter) => (value) => {
      if (!cancelled) setter(value);
    };
    setLoading(true);
    setError(null);
    // The loader reports its own (more specific) errors through setError.
    AssessmentTakeLoader(
      assessmentId,
      ifActive(setAssessment),
      ifActive(setTimeLimitSeconds),
      ifActive(setError),
      ifActive(setLoading)
    ).catch((loadError) => {
      console.error('Error loading assessment:', loadError);
      if (!cancelled) {
        setError('Failed to load assessment. Please try again later.');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);
  
  // Offer to resume an attempt that was interrupted by a reload.
  useEffect(() => {
    setSavedAttempt(assessment ? readAttempt(attemptKey) : null);
  }, [assessment, attemptKey]);

  // Keep the stored attempt current while the test is running.
  useEffect(() => {
    if (!testStarted || !startTimeRef.current) return;
    writeAttempt(attemptKey, {
      startTime: startTimeRef.current,
      endTime,
      violationCount,
      answers,
      currentQuestionIndex
    });
  }, [testStarted, attemptKey, endTime, violationCount, answers, currentQuestionIndex]);

  // Stop counting violations once the component is gone.
  useEffect(() => () => {
    testActiveRef.current = false;
  }, []);

  // Helper to increment violation count (ignored outside an active, unsubmitted test)
  const recordViolation = useCallback((reason) => {
    if (!testActiveRef.current || submittingRef.current) return;
    setViolationCount((prev) => prev + 1);
  }, []);

  // Enter full screen when the test starts; leave it when the test ends or the page unmounts.
  useEffect(() => {
    if (!testStarted) return undefined;
    enterFullscreen(containerRef.current).catch(() => {
      // Request refused (e.g. browser policy): prompt the student to retry instead of
      // silently continuing in a window. Not counted as a violation.
      if (testActiveRef.current && !getFullscreenElement()) {
        setFullscreenViolation(true);
      }
    });
    return () => exitFullscreen();
  }, [testStarted]);

  // Listen for fullscreen changes. Only a real fullscreen -> windowed transition counts,
  // so duplicate (prefixed + unprefixed) events can't double count.
  useEffect(() => {
    if (!testStarted) return undefined;
    const handleFullscreenChange = () => {
      if (!testActiveRef.current) return;
      const isFullscreen = Boolean(getFullscreenElement());
      if (isFullscreen === wasFullscreenRef.current) return;
      wasFullscreenRef.current = isFullscreen;
      setFullscreenViolation(!isFullscreen);
      if (!isFullscreen) {
        recordViolation('Exited full screen');
      }
    };
    FULLSCREEN_EVENTS.forEach((eventName) => document.addEventListener(eventName, handleFullscreenChange));
    return () => {
      FULLSCREEN_EVENTS.forEach((eventName) => document.removeEventListener(eventName, handleFullscreenChange));
    };
  }, [testStarted, recordViolation]);

  // Keyboard restrictions and violation logic
  useEffect(() => {
    if (!testStarted) return undefined;
    const handleKeyDown = (e) => {
      const key = (e.key || '').toLowerCase();
      const isBlockedCombo =
        (e.ctrlKey || e.metaKey) && (BLOCKED_COMBO_KEYS.has(key) || BLOCKED_COMBO_CODES.has(e.code));
      const isBlockedKey = e.key === 'F5' || e.key === 'Meta' || e.key === 'OS';
      if (!isBlockedCombo && !isBlockedKey) return;
      e.preventDefault();
      // Holding a key auto-repeats keydown; count each press once. A Cmd+<key> combo was
      // already counted when Cmd (Meta) itself went down.
      if (e.repeat || (isBlockedCombo && !e.ctrlKey && !isBlockedKey)) return;
      recordViolation('Prohibited key pressed');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [testStarted, recordViolation]);

  // Camera proctoring callbacks (stable, so the webcam is not restarted on re-render)
  const handleProctorViolation = useCallback((reason) => {
    setProctorViolation(true);
    recordViolation(reason || 'Camera/face violation');
  }, [recordViolation]);

  const handleProctorRecover = useCallback(() => {
    setProctorViolation(false);
  }, []);

  // Terminate exam if violation threshold exceeded
  useEffect(() => {
    if (testStarted && violationCount >= VIOLATION_THRESHOLD) {
      testActiveRef.current = false;
      clearAttempt(attemptKeyRef.current);
      setTestStarted(false);
      setTerminated(true);
      setError('Exam terminated due to repeated violations.');
    }
  }, [violationCount, testStarted]);

  useEffect(() => {
    if (!terminated) return undefined;
    const timeoutId = setTimeout(() => {
      navigate('/dashboard', { replace: true, state: { terminated: true } });
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [terminated, navigate]);

  const handleReturnToFullscreen = () => {
    enterFullscreen(containerRef.current).catch(() => {});
  };
  
  const startTest = () => {
    // Resuming keeps the original deadline and violation count; if the deadline passed
    // while away, the countdown fires immediately and submits the saved answers.
    const resume = savedAttempt;
    testActiveRef.current = true;
    submittingRef.current = false;
    wasFullscreenRef.current = Boolean(getFullscreenElement());
    startTimeRef.current = resume ? resume.startTime : Date.now();
    setEndTime(
      resume
        ? resume.endTime ?? null
        : (timeLimitSeconds ? Date.now() + timeLimitSeconds * 1000 : null)
    );
    setFullscreenViolation(false);
    setProctorViolation(false);
    setViolationCount(resume ? Number(resume.violationCount) || 0 : 0);
    if (resume?.answers && typeof resume.answers === 'object') {
      setAnswers(resume.answers);
    }
    if (Number.isInteger(resume?.currentQuestionIndex)) {
      setCurrentQuestionIndex(resume.currentQuestionIndex);
    }
    setSubmitError(null);
    setTestStarted(true);
  };
  
  // Handle answer change
  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleMultiSelectChange = (questionId, option, checked) => {
    setAnswers((prev) => {
      const currentSelections = Array.isArray(prev[questionId]) ? prev[questionId] : [];
      const nextSelections = checked
        ? (currentSelections.includes(option) ? currentSelections : [...currentSelections, option])
        : currentSelections.filter((item) => item !== option);
      return { ...prev, [questionId]: nextSelections };
    });
  };
  
  // Navigate to next question
  const handleNextQuestion = () => {
    if (currentQuestionIndex < assessment.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  // Navigate to previous question
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  // Toggle flagged status of current question
  const toggleFlagged = () => {
    const questionId = assessment.questions[currentQuestionIndex].id;
    setFlaggedQuestions((prev) =>
      prev.includes(questionId) ? prev.filter((id) => id !== questionId) : [...prev, questionId]
    );
  };
  
  // Open confirmation dialog
  const handleOpenSubmitDialog = () => {
    setConfirmSubmit(true);
  };
  
  // Close confirmation dialog
  const handleCloseSubmitDialog = () => {
    if (!submittingRef.current) setConfirmSubmit(false);
  };
  
  // Handle assessment submission (manual or when the timer runs out). Guarded so a
  // double click, or the timer firing during a manual submit, only submits once.
  const handleSubmitAssessment = useCallback(async () => {
    const currentAssessment = assessmentRef.current;
    if (!currentAssessment || submittingRef.current) return;
    submittingRef.current = true;
    // The confirm dialog (if open) stays up showing "Submitting..." until we navigate away;
    // grading can take a few seconds while written answers are checked.
    setSubmitting(true);
    setSubmitError(null);

    const failSubmission = (message) => {
      submittingRef.current = false;
      setSubmitting(false);
      setConfirmSubmit(false);
      setSubmitError(message);
    };

    // Get the authentication token
    const token = localStorage.getItem('token');
    if (!token) {
      failSubmission('Authentication required. Please log in.');
      return;
    }

    const submittedAnswers = answersRef.current;
    // Time spent in seconds, capped at the time limit
    const limitMinutes = Number(currentAssessment.timeLimit);
    const elapsed = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    const timeSpent = limitMinutes > 0 ? Math.min(elapsed, Math.round(limitMinutes * 60)) : elapsed;
    const submittedAssessmentId = currentAssessment.id || currentAssessment._id;

    try {
      // Submit to backend API
      const response = await axios.post('/api/student/assessment/submit', {
        assessmentId: submittedAssessmentId,
        answers: submittedAnswers,
        timeSpent
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });

      const data = response.data || {};
      if (!data.success) {
        failSubmission(data.message || 'Failed to submit assessment (backend error).');
        return;
      }

      const questionPoints = currentAssessment.questions.reduce((sum, q) => sum + (q.points || 0), 0);
      const maxScore = Number(data.maxScore) || questionPoints;
      const score = Number(data.score) || 0;
      const percentage = data.percentage ?? (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
      const isPassed = data.isPassed ?? percentage >= PASS_THRESHOLD;
      const submissionId = data.submissionId || 'temp';

      // Mark assessment as completed (for UI/UX)
      testActiveRef.current = false;
      clearAttempt(attemptKeyRef.current);
      setTestStarted(false);
      // Replace the history entry so "Back" can't reopen a submitted test
      navigate(`/results/${submissionId}`, {
        replace: true,
        state: {
          score,
          maxScore,
          percentage,
          isPassed,
          answers: submittedAnswers,
          assessment: currentAssessment,
          submissionId,
          timeSpent,
          submittedAt: new Date().toISOString(),
          message: data.message,
          completed: true
        }
      });
    } catch (submitErr) {
      console.error('Submission error:', submitErr);
      const serverMessage = submitErr.response?.data?.message;
      failSubmission(serverMessage
        ? `Failed to submit assessment: ${serverMessage}`
        : 'Failed to submit assessment. Please try again.');
    }
  }, [navigate]);
  
  // Render the current question
  const renderQuestion = (question) => {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <RadioGroup
            value={answers[question.id] ?? ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          >
            {question.options.map((option, index) => (
              <FormControlLabel
                key={index}
                value={option}
                control={<Radio />}
                label={<InlineCode text={option} />}
              />
            ))}
          </RadioGroup>
        );
        
      case 'true-false':
        // Stored as the option text ("True"/"False"), which is what the backend compares against.
        return (
          <RadioGroup
            value={answers[question.id] ?? ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          >
            {question.options.map((option, index) => (
              <FormControlLabel
                key={index}
                value={option}
                control={<Radio />}
                label={<InlineCode text={option} />}
              />
            ))}
          </RadioGroup>
        );
        
      case 'short-answer':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Enter your answer here..."
            value={answers[question.id] ?? ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          />
        );
        
      case 'multiple-select': {
        const selections = Array.isArray(answers[question.id]) ? answers[question.id] : [];
        return (
          <FormGroup>
            {question.options.map((option, index) => (
              <FormControlLabel
                key={index}
                control={
                  <Checkbox
                    checked={selections.includes(option)}
                    onChange={(e) => handleMultiSelectChange(question.id, option, e.target.checked)}
                  />
                }
                label={<InlineCode text={option} />}
              />
            ))}
          </FormGroup>
        );
      }
        
      default:
        return <Alert severity="error">Unsupported question type</Alert>;
    }
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

  // Show error state if error is set (do not reload or auto-redirect)
  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Error
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
          <Button 
            variant="contained" 
            onClick={() => navigate('/dashboard')} 
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!assessment) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Assessment Not Found
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {"The assessment you're looking for is not available or may have been removed."}
          </Alert>
          <Typography variant="body1" paragraph>
            Please check that you have the correct assessment ID or try to access the assessment from your dashboard.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/dashboard')} 
            sx={{ mt: 2 }}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }
  
  const totalQuestions = assessment.questions.length;
  const answeredCount = assessment.questions.reduce(
    (count, question) => count + (isAnswered(answers[question.id]) ? 1 : 0),
    0
  );
  // Calculate progress percentage
  const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  if (!testStarted) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          {assessment.title && (
            <Typography variant="h4" gutterBottom>
              {assessment.title}
            </Typography>
          )}
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {assessment.courseName}
          </Typography>
          {assessment.visibility && assessment.visibility.pattern && (
            <>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {assessment.visibility.pattern.name} • {assessment.visibility.pattern.difficulty}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assessment.visibility.pattern.description}
              </Typography>
            </>
          )}
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Total Points" 
                    secondary={assessment.totalPoints ?? assessment.questions.reduce((sum, q) => sum + (q.points || 0), 0)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AccessTimeIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Time Limit" 
                    secondary={assessment.timeLimit ? `${assessment.timeLimit} minutes` : 'No time limit'} 
                  />
                </ListItem>
              </List>
            </Grid>
            <Grid item xs={12} sm={6}>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <HelpIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Questions" 
                    secondary={totalQuestions}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Due Date" 
                    secondary={assessment.dueDate ? new Date(assessment.dueDate).toLocaleString() : 'No due date'}
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
          <Alert severity="info" sx={{ mb: 3 }}>
            {assessment.timeLimit 
              ? `This assessment has a time limit of ${assessment.timeLimit} minutes. The timer will start once you begin.` 
              : 'This assessment has no time limit, but must be completed in one session.'}
          </Alert>
          <Typography variant="body1" paragraph>
            {assessment.description}
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This assessment will require full screen mode and camera proctoring. Exiting full screen or disabling the camera will be flagged as a violation.
          </Alert>
          {totalQuestions === 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              This assessment does not contain any questions yet.
            </Alert>
          )}
          {savedAttempt && (
            <Alert severity="info" sx={{ mt: 2 }}>
              You have an attempt in progress. Your answers were saved
              {savedAttempt.endTime ? ' and the timer kept running while you were away' : ''}.
              {' '}Violations recorded so far: {Number(savedAttempt.violationCount) || 0} / {VIOLATION_THRESHOLD}.
            </Alert>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button 
              variant="outlined" 
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={startTest}
              disabled={totalQuestions === 0}
            >
              {savedAttempt ? 'Resume Assessment' : 'Begin Assessment'}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }
  
  const currentQuestion = assessment.questions[Math.min(currentQuestionIndex, totalQuestions - 1)];
  const isCurrentFlagged = flaggedQuestions.includes(currentQuestion.id);

  return (
    <Container
      id="assessment-fullscreen-container"
      maxWidth="lg"
      ref={containerRef}
      sx={{
        pt: 4,
        // Leave room for the fixed webcam preview in the bottom-right corner.
        pb: 18,
        // In element full screen the browser shows a black backdrop and the page can't
        // scroll, so give the container its own background and scrolling.
        '&:fullscreen': { bgcolor: 'background.default', overflowY: 'auto' },
        '&:-webkit-full-screen': { bgcolor: 'background.default', overflowY: 'auto' }
      }}
    >
      {/* Proctoring webcam and violation alerts */}
      <ProctoringWebcam onViolation={handleProctorViolation} onRecover={handleProctorRecover} />
      {(fullscreenViolation || proctorViolation || violationCount > 0) && (
        <Alert severity={violationCount >= VIOLATION_THRESHOLD ? 'error' : 'warning'} sx={{ position: 'fixed', top: 120, right: 20, zIndex: 1200, width: { xs: 'calc(100% - 40px)', sm: 340 } }}>
          <div>
            {fullscreenViolation && (
              <div>
                You have exited full screen mode. Please return to full screen.
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Button size="small" variant="outlined" color="inherit" onClick={handleReturnToFullscreen}>
                    Return to full screen
                  </Button>
                </Box>
              </div>
            )}
            {proctorViolation && <div>Camera not detected or interrupted. Please enable your camera.</div>}
            <div>Violation Count: {violationCount} / {VIOLATION_THRESHOLD}</div>
            {violationCount >= VIOLATION_THRESHOLD && <div>Exam terminated due to repeated violations.</div>}
          </div>
        </Alert>
      )}
      {submitting && !confirmSubmit && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 2 }}>
          Submitting your answers...
        </Alert>
      )}
      {submitError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleSubmitAssessment} disabled={submitting}>
              Retry
            </Button>
          }
        >
          {submitError}
        </Alert>
      )}
      <Paper elevation={3} sx={{ p: 3, mb: 2, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">
            {assessment.title}
          </Typography>
          {endTime !== null && (
            <MemoCountdownChip endTime={endTime} onExpire={handleSubmitAssessment} />
          )}
        </Box>
      </Paper>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progressPercentage}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(progressPercentage)}% Complete
                </Typography>
                <Box>
                  <IconButton
                    onClick={toggleFlagged}
                    color={isCurrentFlagged ? 'error' : 'default'}
                    title={isCurrentFlagged ? 'Unflag question' : 'Flag for review'}
                  >
                    <FlagIcon />
                  </IconButton>
                </Box>
              </Box>
            </Box>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  <InlineCode text={currentQuestion.text} />
                </Typography>
                <Box sx={{ mt: 2 }}>
                  {renderQuestion(currentQuestion)}
                </Box>
              </CardContent>
            </Card>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handlePrevQuestion}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              {currentQuestionIndex < totalQuestions - 1 ? (
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={handleNextQuestion}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleOpenSubmitDialog}
                  disabled={submitting}
                >
                  Submit Assessment
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>
              Question Navigator
            </Typography>
            <Grid container spacing={1} sx={{ mt: 1 }}>
              {assessment.questions.map((question, index) => (
                <Grid item key={question.id}>
                  <Button
                    variant={currentQuestionIndex === index ? 'contained' : 'outlined'}
                    color={
                      flaggedQuestions.includes(question.id) ? 'error' :
                      isAnswered(answers[question.id]) ? 'success' : 'primary'
                    }
                    onClick={() => setCurrentQuestionIndex(index)}
                    sx={{ minWidth: 40, height: 40, p: 0 }}
                  >
                    {index + 1}
                  </Button>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                Legend:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 1, bgcolor: 'primary.main' }} />
                  <Typography variant="body2">Current question</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 1, bgcolor: 'success.main' }} />
                  <Typography variant="body2">Answered</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: 1, bgcolor: 'error.main' }} />
                  <Typography variant="body2">Flagged for review</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmSubmit}
        onClose={handleCloseSubmitDialog}
        // Render inside the full screen container, otherwise it is hidden behind it
        container={() => containerRef.current}
      >
        <DialogTitle>Submit Assessment?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to submit this assessment? You will not be able to change your answers after submission.
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              Total questions: {totalQuestions}
            </Typography>
            <Typography variant="body2">
              Answered questions: {answeredCount}
            </Typography>
            <Typography variant="body2">
              Unanswered questions: {totalQuestions - answeredCount}
            </Typography>
            <Typography variant="body2">
              Flagged questions: {flaggedQuestions.length}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSubmitDialog} disabled={submitting}>
            Continue Editing
          </Button>
          <Button
            onClick={handleSubmitAssessment}
            variant="contained"
            color="primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

const CalendarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;

export default AssessmentTake;
