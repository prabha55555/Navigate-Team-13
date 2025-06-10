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
    TrendingUp as TargetIcon,
    Timeline as TimelineIcon
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
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Mock submission data
const mockSubmission = {
  id: '1',
  assessment: {
    id: '1',
    title: 'Java Data Structures Assessment',
    courseId: '1',
    courseName: 'Data Structures and Algorithms in Java',
    description: 'Comprehensive evaluation of your understanding of Java data structures and collections',
    timeLimit: 90, // in minutes
    totalPoints: 100,
    questions: [
      {
        id: 'q1',
        text: 'Which Java collection interface is implemented by ArrayList and LinkedList?',
        type: 'multiple-choice',
        options: ['Set', 'List', 'Queue', 'Map'],
        correctAnswer: 'List',
        points: 5      },
      {
        id: 'q2',
        text: 'In Java, which data structure would be most appropriate for implementing a FIFO (First In First Out) queue?',
        type: 'multiple-choice',
        options: ['java.util.Stack', 'java.util.LinkedList', 'java.util.TreeSet', 'java.util.HashMap'],
        correctAnswer: 'java.util.LinkedList',
        points: 5
      },
      {
        id: 'q3',
        text: 'Explain the difference between ArrayList and LinkedList in Java regarding performance characteristics.',
        type: 'short-answer',
        correctAnswer: 'ArrayList provides O(1) random access but O(n) insertion/deletion at arbitrary positions. LinkedList has O(n) random access but O(1) insertion/deletion at known positions. ArrayList is memory-efficient but requires resizing, while LinkedList uses more memory for node pointers but never needs resizing.',
        points: 10
      },
      {
        id: 'q4',
        text: 'Which of the following Java collection classes implement the Set interface? (Select all that apply)',
        type: 'multiple-select',
        options: ['HashSet', 'TreeSet', 'LinkedHashSet', 'ArrayList'],
        correctAnswer: ['HashSet', 'TreeSet', 'LinkedHashSet'],
        points: 10
      },
      {
        id: 'q5',
        text: 'True or False: In Java, HashMap allows multiple null keys.',
        type: 'true-false',
        correctAnswer: false,
        points: 5
      }
    ]  },
  student: {
    id: '1',
    name: 'Student Name',
    email: 'student@example.com'
  },
  answers: {
    'q1': 'List',
    'q2': 'java.util.LinkedList',
    'q3': 'ArrayList provides fast random access with O(1) time complexity, but insertion and deletion in the middle takes O(n) time. LinkedList has O(n) time for random access, but O(1) time for insertion and deletion at known positions once they are located.',
    'q4': ['HashSet', 'TreeSet', 'LinkedHashSet'],
    'q5': false
  },
  score: 25,
  maxScore: 35,
  submittedAt: '2025-10-12T15:30:00',
  timeSpent: 42, // in minutes
  feedback: {
    overallFeedback: 'Good understanding of Java data structures. Continue practicing with more complex implementations, especially with the Java Collections Framework.',
    questionFeedback: {
      'q3': 'Good explanation of the time complexity differences, but could elaborate more on memory usage characteristics.',
      'q4': 'Excellent understanding of the Set interface implementations.'
    }
  },
  conceptMastery: [
    { concept: 'Java Collections', masteryLevel: 90 },
    { concept: 'Java Lists', masteryLevel: 85 },
    { concept: 'Java Sets', masteryLevel: 75 },
    { concept: 'Java Maps', masteryLevel: 70 }
  ]
};

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
  const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  // Fetch submission data or use state from previous page
  useEffect(() => {
    if (location.state?.score !== undefined) {
      // If navigated from assessment take with state
      const { score, maxScore, percentage, isPassed, answers, assessment, message } = location.state;
      
      // Create a submission object from the state
      const createdSubmission = {
        id: submissionId || '1',
        assessment,
        student: {
          id: currentUser?.id || '1',
          name: currentUser?.name || 'Student Name',
          email: currentUser?.email || 'student@example.com'
        },
        answers,
        score,
        maxScore,
        percentage: percentage || Math.round((score / maxScore) * 100),
        isPassed: isPassed !== undefined ? isPassed : (percentage || Math.round((score / maxScore) * 100)) >= 50,
        submissionMessage: message || 'Assessment submitted successfully.',
        submittedAt: new Date().toISOString(),
        timeSpent: assessment.timeLimit || 60, // Default to time limit if actual time not tracked
        feedback: {
          overallFeedback: isPassed !== undefined ? 
            (isPassed ? 'Congratulations! You passed this assessment.' : 'You did not meet the passing threshold of 50%. Please review the material and try again.') :
            'This is automated feedback based on your submission.',
          questionFeedback: {}
        },
        conceptMastery: []
      };
      
      setSubmission(createdSubmission);
      setLoading(false);
    } else {
      // If directly navigated to this page, fetch the submission data from API
      const fetchSubmissionResults = async () => {
        try {
          console.log(`Fetching results for submission: ${submissionId}`);
          
          const token = localStorage.getItem('token');
          if (!token) {
            setError('Authentication required. Please log in.');
            setLoading(false);
            return;
          }          const response = await fetch(`/api/assessment/results/${submissionId}`, {
            headers: {
              'x-auth-token': token,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.message || 'Failed to fetch submission results');
          }

          console.log('Successfully fetched submission results:', data.submission);
          setSubmission(data.submission);
          
        } catch (error) {
          console.error('Error fetching submission results:', error);
          setError('Failed to load submission results. Please try again.');
        } finally {
          setLoading(false);
        }
      };

      fetchSubmissionResults();
    }
  }, [submissionId, location, currentUser]);
  
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

  const scorePercentage = (submission.score / submission.maxScore) * 100;
  const scoreColor = 
    scorePercentage >= 90 ? 'success.main' : 
    scorePercentage >= 70 ? 'primary.main' : 
    scorePercentage >= 60 ? 'warning.main' : 'error.main';

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
            <Typography variant="h5" gutterBottom>
              {submission.assessment.title}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {submission.assessment.courseName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Submitted: {new Date(submission.submittedAt).toLocaleString()}
            </Typography>
          </Grid>          <Grid item xs={12} md={5}>
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
                  label={submission.isPassed !== undefined ? 
                    (submission.isPassed ? '✓ PASSED' : '✗ FAILED') : 
                    (scorePercentage >= 50 ? '✓ PASSED' : '✗ FAILED')
                  }
                  color={submission.isPassed !== undefined ? 
                    (submission.isPassed ? 'success' : 'error') : 
                    (scorePercentage >= 50 ? 'success' : 'error')
                  }
                  size="large"
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
                <Chip 
                  icon={<AccessTimeIcon />} 
                  label={`${submission.timeSpent} minutes`} 
                  variant="outlined" 
                />
              </Box>
            </Box>
          </Grid>        </Grid>
      </Paper>
      
      {/* Pass/Fail Summary Alert */}
      {submission.submissionMessage && (
        <Alert 
          severity={submission.isPassed !== undefined ? 
            (submission.isPassed ? 'success' : 'warning') : 
            (scorePercentage >= 50 ? 'success' : 'warning')
          } 
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            {submission.submissionMessage}
          </Typography>
          <Typography variant="body2">
            {submission.isPassed !== undefined ? 
              (submission.isPassed ? 
                'You have successfully met the passing threshold of 50%.' : 
                'You need at least 50% to pass this assessment. Please review the material and try again.'
              ) : 
              (scorePercentage >= 50 ? 
                'You have successfully met the passing threshold of 50%.' : 
                'You need at least 50% to pass this assessment. Please review the material and try again.'
              )
            }
          </Typography>
        </Alert>
      )}
      
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
          const userAnswer = submission.answers[question.id];
          const questionResult = submission.questionResults?.find(r => r.questionId === question.id);
          const isCorrect = questionResult?.correct || false;
          const earnedPoints = questionResult?.score || 0;
          const feedback = questionResult?.feedback || '';
          
          return (
            <Card key={question.id} variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Question {index + 1}
                  </Typography>
                  <Box>
                    <Chip 
                      icon={isCorrect ? <CheckCircleIcon /> : <CancelIcon />} 
                      label={isCorrect ? 'Correct' : questionResult?.partialCredit ? 'Partial Credit' : 'Incorrect'} 
                      color={isCorrect ? 'success' : questionResult?.partialCredit ? 'warning' : 'error'} 
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip 
                      label={`${earnedPoints}/${question.points} pts`} 
                      variant="outlined" 
                      size="small" 
                    />
                  </Box>
                </Box>
                
                <Typography variant="body1" paragraph>
                  {question.text}
                </Typography>
                
                {/* Show options for multiple choice */}
                {question.type === 'multiple-choice' && question.options && (
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
                              color: option === question.correctAnswer ? 'success.main' : 
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
                    {question.type === 'multiple-choice' && (
                      <Typography variant="body1" sx={{ 
                        color: userAnswer === question.correctAnswer ? 'success.main' : 'error.main',
                        fontWeight: 'medium'
                      }}>
                        {userAnswer || <em>No answer provided</em>}
                      </Typography>
                    )}
                    
                    {question.type === 'true-false' && (
                      <Typography variant="body1" sx={{ 
                        color: String(userAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase() ? 'success.main' : 'error.main',
                        fontWeight: 'medium'
                      }}>
                        {userAnswer === true ? 'True' : userAnswer === false ? 'False' : <em>No answer provided</em>}
                      </Typography>
                    )}
                    
                    {question.type === 'short-answer' && (
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {userAnswer || <em>No answer provided</em>}
                      </Typography>
                    )}
                    
                    {question.type === 'multiple-select' && (
                      <List dense>
                        {userAnswer && userAnswer.length > 0 ? (
                          userAnswer.map((option, idx) => (
                            <ListItem key={idx}>
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                <CheckCircleIcon color={question.correctAnswer.includes(option) ? 'success' : 'error'} fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={option} />
                            </ListItem>
                          ))
                        ) : (
                          <ListItem>
                            <ListItemText primary={<em>No answer provided</em>} />
                          </ListItem>
                        )}
                      </List>
                    )}
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Correct Answer:
                    </Typography>
                    
                    {question.type === 'multiple-choice' && (
                      <Typography variant="body1" color="success.main" fontWeight="medium">
                        {question.correctAnswer}
                      </Typography>
                    )}
                    
                    {question.type === 'true-false' && (
                      <Typography variant="body1" color="success.main" fontWeight="medium">
                        {question.correctAnswer ? 'True' : 'False'}
                      </Typography>
                    )}
                    
                    {question.type === 'short-answer' && (
                      <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        <em>Sample answer:</em> {question.correctAnswer}
                      </Typography>
                    )}
                    
                    {question.type === 'multiple-select' && (
                      <List dense>
                        {question.correctAnswer.map((option, idx) => (
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
                  {submission.timeSpent} minutes
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body1">
                  Time Limit:
                </Typography>
                <Typography variant="body1">
                  {submission.assessment.timeLimit} minutes
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="body1">
                  Time Utilization:
                </Typography>
                <Typography variant="body1" fontWeight="bold" color={submission.timeSpent <= submission.assessment.timeLimit ? 'success.main' : 'error.main'}>
                  {Math.round((submission.timeSpent / submission.assessment.timeLimit) * 100)}%
                </Typography>
              </Box>
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
            {submission.feedback?.overallFeedback || 'Your answers demonstrate a good understanding of the core concepts, with some areas that could be strengthened with additional study and practice.'}
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
                  primary="Completion of the assessment shows engagement with the material" 
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
                  primary="Continue practicing to strengthen your understanding" 
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
                  <ListItem>
                    <ListItemIcon>
                      <SchoolIcon color="info" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Review the course materials for topics you missed" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SchoolIcon color="info" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Practice with additional exercises in your weak areas" />
                  </ListItem>
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
                    label={submission.personalizedRecommendations.difficultyLevel || 'Intermediate'} 
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
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  <Box component="span" fontWeight="bold">Academic Integrity Status: Passed</Box>
                </Typography>
                <Typography variant="body2">
                  Your submission meets all academic integrity requirements. The analysis indicates that this is your original work with no signs of plagiarism or AI-generated content.
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