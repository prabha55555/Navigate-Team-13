import {
    AccessTime as AccessTimeIcon,
    ArrowBack as ArrowBackIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Flag as FlagIcon,
    ManageSearch as ManageSearchIcon,
    PsychologyAlt as PsychologyAltIcon,
    School as SchoolIcon,
    TrendingUp as TargetIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Grid,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography
} from '@mui/material';
import axios from 'axios';
import InlineCode from '../../components/common/InlineCode';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { isAnswered, normalizeQuestions } from '../../services/assessmentTakeLoader';

const PASS_THRESHOLD = 50;

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

// timeSpent is stored in seconds by the submit endpoint
const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';

// Booleans (older submissions) and "True"/"False" strings both display as text
const formatChoice = (value) => {
  if (value === true) return 'True';
  if (value === false) return 'False';
  return value;
};

const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Grade objective questions in the browser when the server didn't send per-question results
// (e.g. results opened from navigation state). Returns null when it can't be decided.
const gradeLocally = (question, userAnswer) => {
  const { type, correctAnswer, points } = question;
  if (!hasValue(correctAnswer) || type === 'short-answer') return null;
  if (!isAnswered(userAnswer)) {
    return { questionId: question.id, correct: false, score: 0 };
  }
  let correct;
  if (type === 'multiple-select') {
    const expected = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
    const given = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
    correct = expected.length === given.length && expected.every((option) => given.includes(option));
  } else if (type === 'true-false') {
    correct = sameText(formatChoice(userAnswer), formatChoice(correctAnswer));
  } else {
    correct = userAnswer === correctAnswer;
  }
  return { questionId: question.id, correct, score: correct ? points : 0 };
};

/**
 * Normalize a submission from either navigation state or GET /api/assessment/results/:id.
 * Submissions created by /api/student/assessment/submit store per-question results in a
 * `feedback` array and the raw questions use `question`/`questionType`, so map those here.
 * Fields missing from `raw` fall back to `fallback` (e.g. the state-built submission).
 */
const normalizeSubmission = (raw = {}, fallback = {}) => {
  const rawAssessment = raw.assessment || {};
  const fallbackAssessment = fallback.assessment || {};
  const questionsSource = rawAssessment.questions?.length ? rawAssessment.questions : fallbackAssessment.questions;
  const questions = normalizeQuestions(questionsSource);

  const answers = firstDefined(raw.answers, fallback.answers) || null;
  const maxScore = Number(firstDefined(raw.maxScore, fallback.maxScore)) ||
    questions.reduce((sum, question) => sum + question.points, 0);
  const score = Number(firstDefined(raw.score, fallback.score)) || 0;
  const rawPercentage = Number(firstDefined(raw.percentage, fallback.percentage));
  const percentage = Number.isFinite(rawPercentage)
    ? rawPercentage
    : (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);
  const isPassed = firstDefined(raw.isPassed, fallback.isPassed) ?? percentage >= PASS_THRESHOLD;

  let questionResults = firstDefined(raw.questionResults, fallback.questionResults) || null;
  if (!questionResults && Array.isArray(raw.feedback)) {
    questionResults = raw.feedback.map((item) => ({
      questionId: item.questionId,
      correct: item.correct === true,
      partialCredit: item.correct === 'partial',
      score: Number(item.points) || 0,
      feedback: item.feedback
    }));
  }

  const objectFeedback = raw.feedback && !Array.isArray(raw.feedback) ? raw.feedback : null;

  return {
    ...fallback,
    ...raw,
    assessment: { ...fallbackAssessment, ...rawAssessment, questions },
    answers,
    answersAvailable: answers !== null,
    score,
    maxScore,
    percentage,
    isPassed,
    questionResults,
    feedback: objectFeedback || raw.aiFeedback || fallback.feedback || {},
    timeSpent: firstDefined(raw.timeSpent, fallback.timeSpent) ?? null,
    submittedAt: firstDefined(raw.submittedAt, fallback.submittedAt) ?? null,
    submissionMessage: firstDefined(raw.submissionMessage, fallback.submissionMessage)
  };
};

const buildFromState = (state) => normalizeSubmission({
  assessment: state.assessment,
  answers: state.answers,
  score: state.score,
  maxScore: state.maxScore,
  percentage: state.percentage,
  isPassed: state.isPassed,
  timeSpent: state.timeSpent,
  submittedAt: state.submittedAt,
  submissionMessage: state.message,
  conceptMastery: []
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SubmissionResults = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  const locationState = location.state;

  // Show the summary passed from the previous page immediately, then load the stored
  // submission (per-question results, correct answers) when there is a real id.
  useEffect(() => {
    let cancelled = false;
    const hasState = locationState?.score !== undefined;
    setError(null);
    if (hasState) {
      setSubmission(buildFromState(locationState));
      setLoading(false);
    } else {
      setSubmission(null);
      setLoading(true);
    }
          
    const token = localStorage.getItem('token');
    if (!submissionId || submissionId === 'temp' || !token) {
      if (!hasState) {
        if (!token) setError('Authentication required. Please log in.');
        setLoading(false);
      }
      return undefined;
    }

    axios.get(`/api/assessment/results/${submissionId}`, {
      headers: { 'x-auth-token': token }
    })
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.success || !response.data.submission) {
          throw new Error(response.data?.message || 'Failed to fetch submission results');
        }
        setSubmission((prev) => normalizeSubmission(response.data.submission, prev || {}));
      })
      .catch((fetchError) => {
        if (cancelled) return;
        console.error('Error fetching submission results:', fetchError);
        // With navigation state the summary is already shown; only fail when there's nothing.
        if (!hasState) setError('Failed to load submission results. Please try again.');
      })
      .finally(() => {
        if (!cancelled && !hasState) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submissionId, locationState]);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h5" color="error" gutterBottom>
          Error Loading Results
        </Typography>
        <Typography variant="body1" paragraph>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/dashboard')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  if (!submission) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h5" color="error">
          Submission not found
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => navigate('/dashboard')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  // Use the server's percentage so the page matches the pass/fail decision
  const scorePercentage = submission.percentage;
  const timeLimitMinutes = Number(submission.assessment.timeLimit) || 0;
  const hasTimeSpent = submission.timeSpent !== null && submission.timeSpent !== undefined;
  const integrityFlagged = Boolean(
    submission.plagiarismResults?.isPlagiarismDetected || submission.plagiarismResults?.aiGeneratedContentDetected
  );
  const resultsByQuestion = new Map(
    (submission.questionResults || []).map((result) => [String(result.questionId), result])
  );
  const scoreColor = 
    scorePercentage >= 90 ? 'success.main' : 
    scorePercentage >= 70 ? 'primary.main' : 
    scorePercentage >= 60 ? 'warning.main' : 'error.main';

// Helper to generate pass/fail messages based on score
const getSubmissionMessage = () => {
    return submission.isPassed
        ? 'You have successfully met the passing threshold of 50%.'
        : 'You need at least 50% to pass this assessment. Please review the material and try again.';
};

// Helper to generate overall feedback based on score
const getOverallFeedback = () => {
    if (scorePercentage >= 90) {
        return 'Outstanding performance! You have an excellent grasp of the material.';
    } else if (scorePercentage >= 75) {
        return 'Great job! You have a strong understanding of the concepts.';
    } else if (scorePercentage >= 60) {
        return 'Good effort. You have a fair understanding, but there is room for improvement.';
    } else if (scorePercentage >= 50) {
        return 'You passed, but consider reviewing the material to strengthen your understanding.';
    } else {
        return 'You did not meet the passing threshold. Please review the material and try again.';
    }
};

return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/dashboard')}
            sx={{ mb: 3 }}
        >
            Back to Dashboard
        </Button>
        
        {/* Results Header */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={7}>
                    <Typography variant="h4" gutterBottom>
                        Assessment Results
                    </Typography>
                    {submission.assessment.title && (
                        <Typography variant="h5" gutterBottom>
                            {submission.assessment.title}
                        </Typography>
                    )}
                    {/* Removed course name to avoid showing placeholder or extra text */}
                    <Typography variant="body2" color="text.secondary">
                        Submitted: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '—'}
                    </Typography>
                </Grid>
                <Grid item xs={12} md={5}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h3" color={scoreColor} sx={{ fontWeight: 'bold' }}>
                                {Math.round(scorePercentage)}%
                            </Typography>
                            <Typography variant="h6" color="text.secondary" sx={{ ml: 1.5 }}>
                                ({submission.score}/{submission.maxScore} points)
                            </Typography>
                        </Box>
                        
                        {/* Pass/Fail Status */}
                        <Box sx={{ mb: 2 }}>
                            <Chip 
                                label={submission.isPassed ? '✓ PASSED' : '✗ FAILED'}
                                color={submission.isPassed ? 'success' : 'error'}
                                size="medium"
                                sx={{ 
                                    fontSize: '1.1rem', 
                                    fontWeight: 'bold',
                                    px: 2,
                                    py: 1
                                }}
                            />
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip 
                                icon={<AssignmentTurnedInIcon />} 
                                label={`${submission.assessment.questions.length} Questions`}
                                variant="outlined" 
                            />
                            {hasTimeSpent && (
                                <Chip
                                    icon={<AccessTimeIcon />}
                                    label={formatDuration(submission.timeSpent)}
                                    variant="outlined"
                                />
                            )}
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Paper>
        
        {/* Pass/Fail Summary Alert */}
        <Alert 
            severity={submission.isPassed ? 'success' : 'warning'}
            sx={{ mb: 3 }}
        >
            <Typography variant="subtitle1" fontWeight="bold">
                {submission.submissionMessage ||
                    (submission.isPassed ? 'Congratulations! You passed this assessment.' : 'You did not pass this assessment.')}
            </Typography>
            <Typography variant="body2">
                {getSubmissionMessage()}
            </Typography>
        </Alert>
        
        {/* Results Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="results tabs">
                <Tab label="Question Review" />
                <Tab label="Performance Analysis" />
                <Tab label="AI Feedback" />
                <Tab label="Integrity Check" />
            </Tabs>
        </Box>
        
        {/* Question Review Tab */}
        <TabPanel value={activeTab} index={0}>
            <Typography variant="h6" gutterBottom>
                Questions and Answers
            </Typography>
            {submission.assessment.questions.map((question, index) => {
                // Safely handle undefined answers
                const userAnswer = submission.answers ? submission.answers[question.id] : undefined;
                const answered = isAnswered(userAnswer);
                const questionResult = resultsByQuestion.get(String(question.id)) ||
                    (submission.answersAvailable ? gradeLocally(question, userAnswer) : null);
                const isGraded = Boolean(questionResult);
                const isCorrect = questionResult?.correct === true;
                const earnedPoints = questionResult?.score ?? 0;
                const feedback = questionResult?.feedback || '';
                const hasCorrectAnswer = hasValue(question.correctAnswer);
                const correctOptions = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer
                    : (hasCorrectAnswer ? [question.correctAnswer] : []);
                const noAnswer = submission.answersAvailable
                    ? <em>No answer provided</em>
                    : <em>Answer not available</em>;

                return (
                    <Card key={question.id} variant="outlined" sx={{ mb: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                    Question {index + 1}
                                </Typography>
                                <Box>
                                    {isGraded ? (
                                        <Chip
                                            icon={isCorrect ? <CheckCircleIcon /> : <CancelIcon />}
                                            label={isCorrect ? 'Correct' : questionResult?.partialCredit ? 'Partial Credit' : 'Incorrect'}
                                            color={isCorrect ? 'success' : questionResult?.partialCredit ? 'warning' : 'error'}
                                            size="small"
                                            sx={{ mr: 1 }}
                                        />
                                    ) : (
                                        <Chip
                                            label="Not graded"
                                            size="small"
                                            sx={{ mr: 1 }}
                                        />
                                    )}
                                    <Chip
                                        label={isGraded ? `${earnedPoints}/${question.points} pts` : `${question.points} pts`}
                                        variant="outlined"
                                        size="small"
                                    />
                                </Box>
                            </Box>

                            <Typography variant="body1" paragraph>
                                <InlineCode text={question.text} />
                            </Typography>

                            {/* Show options for multiple choice */}
                            {question.type === 'multiple-choice' && question.options.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Options:
                                    </Typography>
                                    <List dense>
                                        {question.options.map((option, idx) => (
                                            <ListItem key={idx}>
                                                <ListItemText
                                                    primary={`${String.fromCharCode(65 + idx)}. ${option}`}
                                                    sx={{
                                                        color: hasCorrectAnswer && option === question.correctAnswer ? 'success.main' :
                                                            option === userAnswer ? 'error.main' : 'inherit'
                                                    }}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Box>
                            )}

                            <Divider sx={{ my: 2 }} />

                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Your Answer:
                                    </Typography>

                                    {/* Render user answer based on question type */}
                                    {(question.type === 'multiple-choice' || question.type === 'true-false') && (
                                        <Typography variant="body1" sx={{
                                            color: !answered || !isGraded ? 'text.primary' : isCorrect ? 'success.main' : 'error.main',
                                            fontWeight: 'medium'
                                        }}>
                                            {answered ? formatChoice(userAnswer) : noAnswer}
                                        </Typography>
                                    )}

                                    {question.type === 'short-answer' && (
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {answered ? String(userAnswer) : noAnswer}
                                        </Typography>
                                    )}

                                    {question.type === 'multiple-select' && (
                                        <List dense>
                                            {answered ? (
                                                (Array.isArray(userAnswer) ? userAnswer : [userAnswer]).map((option, idx) => (
                                                    <ListItem key={idx}>
                                                        <ListItemIcon sx={{ minWidth: 28 }}>
                                                            <CheckCircleIcon
                                                                color={!hasCorrectAnswer ? 'action' : correctOptions.includes(option) ? 'success' : 'error'}
                                                                fontSize="small"
                                                            />
                                                        </ListItemIcon>
                                                        <ListItemText primary={option} />
                                                    </ListItem>
                                                ))
                                            ) : (
                                                <ListItem>
                                                    <ListItemText primary={noAnswer} />
                                                </ListItem>
                                            )}
                                        </List>
                                    )}
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Correct Answer:
                                    </Typography>

                                    {!hasCorrectAnswer && (
                                        <Typography variant="body1" color="text.secondary">
                                            <em>Not available</em>
                                        </Typography>
                                    )}

                                    {hasCorrectAnswer && (question.type === 'multiple-choice' || question.type === 'true-false') && (
                                        <Typography variant="body1" color="success.main" fontWeight="medium">
                                            {formatChoice(question.correctAnswer)}
                                        </Typography>
                                    )}

                                    {hasCorrectAnswer && question.type === 'short-answer' && (
                                        <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                            <em>Sample answer:</em> {String(question.correctAnswer)}
                                        </Typography>
                                    )}

                                    {hasCorrectAnswer && question.type === 'multiple-select' && (
                                        <List dense>
                                            {correctOptions.map((option, idx) => (
                                                <ListItem key={idx}>
                                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                                        <CheckCircleIcon color="success" fontSize="small" />
                                                    </ListItemIcon>
                                                    <ListItemText primary={option} />
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                </Grid>
                            </Grid>

                            {/* Show detailed feedback */}
                            {feedback && (
                                <Alert
                                    severity={isCorrect ? 'success' : questionResult?.partialCredit ? 'warning' : 'info'}
                                    sx={{ mt: 2 }}
                                >
                                    <Typography variant="subtitle2">Feedback:</Typography>
                                    <Typography variant="body2">
                                        {feedback}
                                    </Typography>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </TabPanel>
        
        {/* Performance Analysis Tab */}
        <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Score Breakdown
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Category</TableCell>
                                        <TableCell align="right">Your Score</TableCell>
                                        <TableCell align="right">Max Score</TableCell>
                                        <TableCell align="right">Percentage</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>Overall</TableCell>
                                        <TableCell align="right">{submission.score}</TableCell>
                                        <TableCell align="right">{submission.maxScore}</TableCell>
                                        <TableCell align="right">{Math.round(scorePercentage)}%</TableCell>
                                    </TableRow>
                                    {/* You could add category breakdowns here */}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Time Analysis
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                            <Typography variant="body1">
                                Time Spent:
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                                {hasTimeSpent ? formatDuration(submission.timeSpent) : '—'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="body1">
                                Time Limit:
                            </Typography>
                            <Typography variant="body1">
                                {timeLimitMinutes > 0 ? `${timeLimitMinutes} minutes` : 'No time limit'}
                            </Typography>
                        </Box>
                        {timeLimitMinutes > 0 && hasTimeSpent && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                                <Typography variant="body1">
                                    Time Utilization:
                                </Typography>
                                <Typography variant="body1" fontWeight="bold" color={submission.timeSpent <= timeLimitMinutes * 60 ? 'success.main' : 'error.main'}>
                                    {Math.round((submission.timeSpent / (timeLimitMinutes * 60)) * 100)}%
                                </Typography>
                            </Box>
                        )}
                    </Paper>
                </Grid>
                
                {submission.conceptMastery && submission.conceptMastery.length > 0 && (
                    <Grid item xs={12}>
                        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Concept Mastery
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {submission.conceptMastery.map((concept, index) => (
                                    <Grid item xs={12} sm={6} md={3} key={index}>
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Typography variant="subtitle1" gutterBottom>
                                                    {concept.concept}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                                    <Box sx={{ width: '100%', mr: 1 }}>
                                                        <LinearProgress 
                                                            variant="determinate" 
                                                            value={concept.masteryLevel} 
                                                            color={
                                                                concept.masteryLevel >= 80 ? 'success' :
                                                                concept.masteryLevel >= 60 ? 'primary' :
                                                                concept.masteryLevel >= 40 ? 'warning' : 'error'
                                                            }
                                                            sx={{ height: 10, borderRadius: 5 }}
                                                        />
                                                    </Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {concept.masteryLevel}%
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </TabPanel>
        
        {/* AI Feedback Tab */}
        <TabPanel value={activeTab} index={2}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <PsychologyAltIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h5">
                        AI-Generated Feedback
                    </Typography>
                </Box>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                        Your submission was evaluated by an AI expert panel using multiple evaluation techniques tailored to each question type.
                    </Typography>
                </Alert>

                <Typography variant="h6" gutterBottom>
                    Overall Assessment
                </Typography>
                <Typography variant="body1" paragraph>
                    {submission.feedback?.overallFeedback || getOverallFeedback()}
                </Typography>
                
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom>
                    Strengths Identified
                </Typography>
                <List>
                    {submission.aiFeedback?.strengths?.length > 0 ? (
                        submission.aiFeedback.strengths.map((strength, index) => (
                            <ListItem key={index}>
                                <ListItemIcon>
                                    <CheckCircleIcon color="success" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary={strength}
                                    secondary="AI-identified strength based on your performance patterns"
                                />
                            </ListItem>
                        ))
                    ) : (
                        <ListItem>
                            <ListItemIcon>
                                <CheckCircleIcon color="success" />
                            </ListItemIcon>
                            <ListItemText 
                                primary={
                                    scorePercentage >= 90
                                        ? "Exceptional mastery of the material"
                                        : scorePercentage >= 75
                                            ? "Strong understanding of key concepts"
                                            : scorePercentage >= 60
                                                ? "Solid effort and engagement"
                                                : "Completion of the assessment shows engagement with the material"
                                }
                                secondary="You demonstrated effort in attempting all questions."
                            />
                        </ListItem>
                    )}
                </List>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Areas for Improvement
                </Typography>
                <List>
                    {submission.aiFeedback?.weaknesses?.length > 0 ? (
                        submission.aiFeedback.weaknesses.map((weakness, index) => (
                            <ListItem key={index}>
                                <ListItemIcon>
                                    <FlagIcon color="warning" />
                                </ListItemIcon>
                                <ListItemText 
                                    primary={weakness}
                                    secondary="AI-identified area needing attention based on your performance"
                                />
                            </ListItem>
                        ))
                    ) : (
                        <ListItem>
                            <ListItemIcon>
                                <FlagIcon color="info" />
                            </ListItemIcon>
                            <ListItemText 
                                primary={
                                    scorePercentage >= 90
                                        ? "Keep challenging yourself with advanced topics"
                                        : scorePercentage >= 75
                                            ? "Review minor mistakes to achieve perfection"
                                            : scorePercentage >= 60
                                                ? "Focus on weaker areas for improvement"
                                                : "Continue practicing to strengthen your understanding"
                                }
                                secondary="Regular practice will help improve your performance."
                            />
                        </ListItem>
                    )}
                </List>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Study Recommendations
                </Typography>
                <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        The AI recommends these study strategies to improve your understanding:
                    </Typography>
                    <List dense>
                        {submission.aiFeedback?.studyRecommendations?.length > 0 ? (
                            submission.aiFeedback.studyRecommendations.map((recommendation, index) => (
                                <ListItem key={index}>
                                    <ListItemIcon>
                                        <SchoolIcon color="info" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary={recommendation} />
                                </ListItem>
                            ))
                        ) : (
                            <>
                                {scorePercentage < 60 && (
                                    <ListItem>
                                        <ListItemIcon>
                                            <SchoolIcon color="info" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Review the course materials for topics you missed" />
                                    </ListItem>
                                )}
                                <ListItem>
                                    <ListItemIcon>
                                        <SchoolIcon color="info" fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary="Practice with additional exercises in your weak areas" />
                                </ListItem>
                                {scorePercentage >= 75 && (
                                    <ListItem>
                                        <ListItemIcon>
                                            <SchoolIcon color="info" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary="Attempt advanced problems to further enhance your skills" />
                                    </ListItem>
                                )}
                            </>
                        )}
                    </List>
                </Alert>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Personalized Learning Path
                </Typography>
                <Alert severity="success" sx={{ mt: 1 }}>
                    <Typography variant="body2" gutterBottom>
                        Based on your performance, here's your personalized learning plan:
                    </Typography>
                    
                    {submission.personalizedRecommendations && (
                        <>
                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                Next Steps:
                            </Typography>
                            <List dense>
                                {submission.personalizedRecommendations.nextSteps?.map((step, index) => (
                                    <ListItem key={index}>
                                        <ListItemIcon>
                                            <TargetIcon color="success" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText primary={step} />
                                    </ListItem>
                                ))}
                            </List>

                            {submission.personalizedRecommendations.practiceAreas?.length > 0 && (
                                <>
                                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                        Focus Areas for Practice:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                        {submission.personalizedRecommendations.practiceAreas.map((area, index) => (
                                            <Chip 
                                                key={index} 
                                                label={area} 
                                                color="primary" 
                                                variant="outlined" 
                                                size="small"
                                            />
                                        ))}
                                    </Box>
                                </>
                            )}

                            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                                Recommended Difficulty Level: 
                                <Chip 
                                    label={submission.personalizedRecommendations.difficultyLevel || (
                                        scorePercentage >= 90 ? 'Advanced' :
                                        scorePercentage >= 75 ? 'Intermediate' :
                                        'Beginner'
                                    )} 
                                    color="info" 
                                    size="small" 
                                    sx={{ ml: 1 }}
                                />
                            </Typography>
                        </>
                    )}
                </Alert>
            </Paper>
        </TabPanel>
        
        {/* Integrity Check Tab */}
        <TabPanel value={activeTab} index={3}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <ManageSearchIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
                    <Typography variant="h5">
                        Submission Integrity Analysis
                    </Typography>
                </Box>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                        Your submission was analyzed for originality using multiple plagiarism detection tools and AI-generated content detection.
                    </Typography>
                </Alert>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="primary">
                                    Plagiarism Detection
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                        <CircularProgress 
                                            variant="determinate" 
                                            value={100 - Math.round((submission.plagiarismResults?.overallSimilarityScore || 0) * 100)} 
                                            size={120} 
                                            thickness={5}
                                            color={submission.plagiarismResults?.overallSimilarityScore > 0.3 ? "warning" : "success"}
                                        />
                                        <Box
                                            sx={{
                                                top: 0,
                                                left: 0,
                                                bottom: 0,
                                                right: 0,
                                                position: 'absolute',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Typography variant="h4" component="div" color="text.secondary">
                                                {Math.round((submission.plagiarismResults?.overallSimilarityScore || 0) * 100)}%
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                
                                <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                                    Overall similarity score
                                </Typography>
                                
                                <Alert severity={submission.plagiarismResults?.isPlagiarismDetected ? "warning" : "success"} sx={{ mt: 2 }}>
                                    <Typography variant="body2">
                                        {submission.plagiarismResults?.isPlagiarismDetected 
                                            ? "Some similarity to external sources was detected. Please review flagged content." 
                                            : "No significant similarity to external sources was detected."
                                        }
                                    </Typography>
                                </Alert>
                                
                                <Typography variant="subtitle2" sx={{ mt: 2 }}>
                                    Detection Methods Used:
                                </Typography>
                                <List dense>
                                    {submission.plagiarismResults?.detectionMethods?.length > 0 ? (
                                        submission.plagiarismResults.detectionMethods.map((method, index) => (
                                            <ListItem key={index}>
                                                <ListItemText 
                                                    primary={method} 
                                                    secondary={
                                                        method === 'AI Service' ? 'Advanced AI-powered similarity detection' :
                                                        method === 'Turnitin' ? 'Comparing against academic sources' :
                                                        method === 'AWS Comprehend' ? 'Semantic similarity analysis' :
                                                        'Text analysis and comparison'
                                                    } 
                                                />
                                            </ListItem>
                                        ))
                                    ) : (
                                        <>
                                            <ListItem>
                                                <ListItemText primary="Text pattern matching" secondary="Comparing against web sources" />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText primary="Cross-reference analysis" secondary="Comparing with other student submissions" />
                                            </ListItem>
                                            <ListItem>
                                                <ListItemText primary="Semantic similarity detection" secondary="Analyzing meaning regardless of wording" />
                                            </ListItem>
                                        </>
                                    )}
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom color="primary">
                                    AI-Generated Content Analysis
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                                        <CircularProgress 
                                            variant="determinate" 
                                            value={100 - Math.round((submission.plagiarismResults?.aiGeneratedContentScore || 0) * 100)} 
                                            size={120} 
                                            thickness={5}
                                            color={submission.plagiarismResults?.aiGeneratedContentDetected ? "warning" : "success"}
                                        />
                                        <Box
                                            sx={{
                                                top: 0,
                                                left: 0,
                                                bottom: 0,
                                                right: 0,
                                                position: 'absolute',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <Typography variant="h4" component="div" color="text.secondary">
                                                {Math.round((submission.plagiarismResults?.aiGeneratedContentScore || 0) * 100)}%
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                
                                <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
                                    AI-generated content probability
                                </Typography>
                                
                                <Alert severity={submission.plagiarismResults?.aiGeneratedContentDetected ? "warning" : "success"} sx={{ mt: 2 }}>
                                    <Typography variant="body2">
                                        {submission.plagiarismResults?.aiGeneratedContentDetected 
                                            ? "Potential AI-generated content detected. Please ensure your work is original." 
                                            : "No evidence of AI-generated content was detected in your submission."
                                        }
                                    </Typography>
                                </Alert>
                                
                                <Typography variant="subtitle2" sx={{ mt: 2 }}>
                                    Detection Methods Used:
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText primary="GPTZero" secondary="AI text pattern analysis" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText primary="Linguistic variance analysis" secondary="Human vs. AI writing patterns" />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText primary="AWS Comprehend" secondary="Natural language processing analysis" />
                                    </ListItem>
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12}>
                        <Alert severity={integrityFlagged ? 'warning' : 'success'} sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                <Box component="span" fontWeight="bold">
                                    Academic Integrity Status: {integrityFlagged ? 'Review Required' : 'Passed'}
                                </Box>
                            </Typography>
                            <Typography variant="body2">
                                {integrityFlagged
                                    ? 'Parts of your submission were flagged by the integrity checks above and may be reviewed by your instructor.'
                                    : 'Your submission meets all academic integrity requirements. The analysis indicates that this is your original work with no signs of plagiarism or AI-generated content.'}
                            </Typography>
                        </Alert>
                    </Grid>
                </Grid>
            </Paper>
        </TabPanel>
    </Container>
);
};

export default SubmissionResults;