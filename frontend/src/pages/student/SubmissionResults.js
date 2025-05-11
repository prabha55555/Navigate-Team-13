import {
    AccessTime as AccessTimeIcon,
    Analytics as AnalyticsIcon,
    ArrowBack as ArrowBackIcon,
    ArrowRight as ArrowRightIcon,
    Assessment as AssessmentIcon,
    AssignmentTurnedIn as AssignmentTurnedInIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    CommentOutlined as CommentOutlinedIcon,
    ExpandMore as ExpandMoreIcon,
    Flag as FlagIcon,
    Info as InfoIcon,
    Psychology as PsychologyIcon,
    School as SchoolIcon,
    SearchOutlined as SearchOutlinedIcon,
    Shield as ShieldIcon,
    Timeline as TimelineIcon
} from '@mui/icons-material';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
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
    Skeleton,
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
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Mock submission data
const mockSubmission = {
  id: '1',
  assessment: {
    id: '1',
    title: 'Midterm Exam',
    courseId: '1',
    courseName: 'Data Structures and Algorithms',
    description: 'Comprehensive evaluation of your understanding of data structures',
    timeLimit: 90, // in minutes
    totalPoints: 100,
    questions: [
      {
        id: 'q1',
        text: 'Which data structure uses LIFO (Last In First Out) principle?',
        type: 'multiple-choice',
        options: ['Queue', 'Stack', 'Linked List', 'Tree'],
        correctAnswer: 'Stack',
        points: 5
      },
      {
        id: 'q2',
        text: 'What is the time complexity of binary search?',
        type: 'multiple-choice',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctAnswer: 'O(log n)',
        points: 5
      },
      {
        id: 'q3',
        text: 'Explain the difference between a stack and a queue.',
        type: 'short-answer',
        correctAnswer: 'A stack follows LIFO (Last In First Out) principle where elements are added and removed from the same end, while a queue follows FIFO (First In First Out) principle where elements are added at one end and removed from the other end.',
        points: 10
      },
      {
        id: 'q4',
        text: 'Which of the following are valid operations on a binary search tree? (Select all that apply)',
        type: 'multiple-select',
        options: ['Insertion', 'Deletion', 'In-order traversal', 'Level order traversal'],
        correctAnswer: ['Insertion', 'Deletion', 'In-order traversal', 'Level order traversal'],
        points: 10
      },
      {
        id: 'q5',
        text: 'True or False: A hash table provides O(1) average time complexity for insertions and lookups.',
        type: 'true-false',
        correctAnswer: true,
        points: 5
      }
    ]
  },
  student: {
    id: '1',
    name: 'Student Name',
    email: 'student@example.com'
  },
  answers: {
    'q1': 'Stack',
    'q2': 'O(log n)',
    'q3': 'A stack uses LIFO (Last In First Out) where elements are added and removed from the top. A queue uses FIFO (First In First Out) where elements are added at the back and removed from the front.',
    'q4': ['Insertion', 'Deletion', 'In-order traversal'],
    'q5': true
  },
  score: 25,
  maxScore: 35,
  submittedAt: '2025-10-12T15:30:00',
  timeSpent: 42, // in minutes
  feedback: {
    overallFeedback: 'Good understanding of basic data structures. Continue practicing with more complex operations on trees and graphs.',
    questionFeedback: {
      'q3': 'Good explanation of the basic principles, but could elaborate more on the implementation differences.',
      'q4': 'You missed "Level order traversal" which is also a valid operation on BSTs.'
    }
  },
  conceptMastery: [
    { concept: 'Stacks', masteryLevel: 90 },
    { concept: 'Queues', masteryLevel: 85 },
    { concept: 'Binary Search Trees', masteryLevel: 70 },
    { concept: 'Algorithm Complexity', masteryLevel: 80 }
  ],
  // AI Evaluation Results
  aiEvaluation: {
    status: 'fully-complete', // pending, plagiarism-complete, llm-complete, expert-complete, fully-complete
    plagiarismResults: {
      score: 3.2, // 0-100, higher means more likely to be plagiarized
      source: 'turnitin',
      details: {
        'similarityReports': 'No significant matches found in academic databases or online sources',
      },
      isPlagiarized: false,
      timestamp: '2025-10-12T15:32:00'
    },
    llmEvaluation: {
      exactMatchScore: 85, // Exact keyword matching score
      semanticSimilarityScore: 78, // How close to model answer
      reasoningCheckScore: 82, // Logical reasoning evaluation
      overallScore: 81, // Combined AI score
      timestamp: '2025-10-12T15:33:00',
      details: {
        exactMatch: {
          explanation: "Your answers include most of the key concepts and terms expected. You correctly mentioned LIFO for stacks, FIFO for queues, and properly identified the time complexity of binary search.",
          matchedPhrases: ["LIFO", "FIFO", "stack", "queue", "O(log n)"]
        },
        semanticSimilarity: {
          explanation: "Your answers show good semantic similarity (78.0%) to the expected concepts. You've captured many of the important ideas, though there's room for more precision.",
        },
        reasoning: {
          strengths: ["Clear understanding of fundamental data structure concepts", "Strong grasp of algorithmic complexity"],
          weaknesses: ["Some gaps in understanding all operations on binary search trees"],
          improvement: ["Practice implementing BST traversal algorithms", "Study more complex tree operations"]
        }
      }
    },
    expertPanelFeedback: {
      misconceptions: [
        "You may have a misconception about the complete set of valid operations on binary search trees, as you missed 'Level order traversal'",
        "There seems to be a slight misconception about how queues are implemented in practice"
      ],
      learningGaps: [
        "Deeper understanding of tree traversal algorithms could be improved",
        "Implementation details of data structures rather than just conceptual understanding"
      ],
      strengthAreas: [
        "Excellent understanding of the fundamental principles of stacks and queues",
        "Strong grasp of time complexity analysis",
        "Good ability to compare and contrast different data structures"
      ],
      improvementSuggestions: [
        "Implement a complete binary search tree with all traversal methods",
        "Practice with more complex time complexity analysis problems",
        "Study the implementation details of data structures in different programming languages"
      ],
      timestamp: '2025-10-12T15:35:00'
    }
  }
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
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationStatus, setEvaluationStatus] = useState('');
  
  // Poll for evaluation status updates
  const pollEvaluationStatus = async (submissionId) => {
    try {
      // In a real app, this would be an API call to check status
      // const response = await fetch(`/api/assessment/evaluation-status/${submissionId}`, {
      //   headers: {
      //     'Authorization': `Bearer ${currentUser?.token}`
      //   }
      // });
      // const data = await response.json();
      
      // For demo, simulate a response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // After 2 seconds, update with completed evaluation
      setEvaluationLoading(false);
      setSubmission(mockSubmission);
      setEvaluationStatus('fully-complete');
    } catch (error) {
      console.error('Error checking evaluation status:', error);
    }
  };
  
  // Fetch submission data or use state from previous page
  useEffect(() => {
    if (location.state?.submissionId !== undefined) {
      // If navigated from assessment take with state
      const { score, maxScore, answers, assessment, submissionId, evaluationStatus, message } = location.state;
      
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
        submittedAt: new Date().toISOString(),
        timeSpent: assessment.timeLimit || 60, // Default to time limit if actual time not tracked
        feedback: {
          overallFeedback: message || 'This is automated feedback based on your submission.',
          questionFeedback: {}
        },
        conceptMastery: []
      };
      
      setSubmission(createdSubmission);
      setEvaluationStatus(evaluationStatus || 'started');
      setLoading(false);
      
      // If evaluation is in progress, simulate polling for updates
      if (evaluationStatus === 'started') {
        setEvaluationLoading(true);
        pollEvaluationStatus(submissionId);
      }
    } else {
      // If directly navigated to this page, fetch the submission data
      // In a real app, you would fetch from an API
      setTimeout(() => {
        setSubmission(mockSubmission);
        setEvaluationStatus('fully-complete');
        setLoading(false);
      }, 1000);
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
          </Grid>
        </Grid>
      </Paper>
        {/* Results Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          aria-label="results tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Question Review" />
          <Tab label="Performance Analysis" />
          <Tab label="AI Evaluation" icon={<PsychologyIcon />} iconPosition="start" />
          <Tab label="Expert Feedback" icon={<SchoolIcon />} iconPosition="start" />
          <Tab label="Feedback" />
        </Tabs>
      </Box>
      
      {/* Question Review Tab */}
      <TabPanel value={activeTab} index={0}>
        <Typography variant="h6" gutterBottom>
          Questions and Answers
        </Typography>
        
        {submission.assessment.questions.map((question, index) => {
          const userAnswer = submission.answers[question.id];
          const isCorrect = 
            question.type === 'multiple-choice' || question.type === 'true-false' 
              ? userAnswer === question.correctAnswer
              : question.type === 'multiple-select'
                ? userAnswer && userAnswer.length === question.correctAnswer.length && 
                  userAnswer.every(a => question.correctAnswer.includes(a))
                : false; // For short answer, we don't do simple comparison
          
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
                      label={isCorrect ? 'Correct' : 'Incorrect'} 
                      color={isCorrect ? 'success' : 'error'} 
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip 
                      label={`${question.points} pts`} 
                      variant="outlined" 
                      size="small" 
                    />
                  </Box>
                </Box>
                
                <Typography variant="body1" paragraph>
                  {question.text}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Your Answer:
                    </Typography>
                    
                    {/* Render user answer based on question type */}
                    {question.type === 'multiple-choice' && (
                      <Typography variant="body1">
                        {userAnswer || <em>No answer provided</em>}
                      </Typography>
                    )}
                    
                    {question.type === 'true-false' && (
                      <Typography variant="body1">
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
                      <Typography variant="body1">
                        {question.correctAnswer}
                      </Typography>
                    )}
                    
                    {question.type === 'true-false' && (
                      <Typography variant="body1">
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
                
                {/* Show feedback if available */}
                {submission.feedback.questionFeedback && submission.feedback.questionFeedback[question.id] && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Feedback:</Typography>
                    <Typography variant="body2">
                      {submission.feedback.questionFeedback[question.id]}
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
      
      {/* AI Evaluation Tab */}
      <TabPanel value={activeTab} index={2}>
        {evaluationLoading ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 3 }}>
              AI Evaluation in Progress
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Our AI is analyzing your answers for plagiarism, semantic similarity, and reasoning quality...
            </Typography>
          </Box>
        ) : submission.aiEvaluation ? (
          <>
            <Typography variant="h5" gutterBottom>
              AI-Powered Assessment Evaluation
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              This assessment was evaluated using multiple AI systems to provide comprehensive feedback on your work.
            </Alert>
            
            {/* Plagiarism Detection */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ShieldIcon color="primary" sx={{ mr: 1.5, fontSize: 28 }} />
                <Typography variant="h6">
                  Plagiarism Detection
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                      <CircularProgress
                        variant="determinate"
                        value={100 - submission.aiEvaluation.plagiarismResults.score}
                        size={120}
                        thickness={4}
                        sx={{ color: submission.aiEvaluation.plagiarismResults.isPlagiarized ? 'error.main' : 'success.main' }}
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
                          {Math.round(100 - submission.aiEvaluation.plagiarismResults.score)}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="subtitle1" textAlign="center">
                      Originality Score
                    </Typography>
                    <Chip 
                      label={submission.aiEvaluation.plagiarismResults.isPlagiarized ? "Plagiarism Detected" : "Original Work"} 
                      color={submission.aiEvaluation.plagiarismResults.isPlagiarized ? "error" : "success"}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle1" gutterBottom>
                    Analysis Details:
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <SearchOutlinedIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Detection Method" 
                        secondary={`${submission.aiEvaluation.plagiarismResults.source.toUpperCase()} content analysis`} 
                      />
                    </ListItem>
                    {Object.entries(submission.aiEvaluation.plagiarismResults.details).map(([key, value], index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <InfoIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); })} 
                          secondary={value} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </Paper>
            
            {/* LLM-based Evaluation */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PsychologyIcon color="primary" sx={{ mr: 1.5, fontSize: 28 }} />
                <Typography variant="h6">
                  LLM-based Content Evaluation
                </Typography>
              </Box>
              
              <Grid container spacing={3}>
                {/* Score Summary */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140, p: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={submission.aiEvaluation.llmEvaluation.exactMatchScore}
                        size={80}
                        thickness={4}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="subtitle2" textAlign="center">Exact Match</Typography>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        {submission.aiEvaluation.llmEvaluation.exactMatchScore}/100
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140, p: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={submission.aiEvaluation.llmEvaluation.semanticSimilarityScore}
                        size={80}
                        thickness={4}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="subtitle2" textAlign="center">Semantic Similarity</Typography>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        {submission.aiEvaluation.llmEvaluation.semanticSimilarityScore}/100
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140, p: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={submission.aiEvaluation.llmEvaluation.reasoningCheckScore}
                        size={80}
                        thickness={4}
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="subtitle2" textAlign="center">Reasoning Check</Typography>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        {submission.aiEvaluation.llmEvaluation.reasoningCheckScore}/100
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 140, p: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={submission.aiEvaluation.llmEvaluation.overallScore}
                        size={80}
                        thickness={8}
                        sx={{ mb: 1, color: 'primary.main' }}
                      />
                      <Typography variant="subtitle1" fontWeight="bold" textAlign="center">Overall Score</Typography>
                      <Typography variant="body1" color="primary" fontWeight="bold" textAlign="center">
                        {submission.aiEvaluation.llmEvaluation.overallScore}/100
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                {/* Detailed Evaluation */}
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Detailed Analysis:
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Keyword Matching:
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {submission.aiEvaluation.llmEvaluation.details.exactMatch.explanation}
                  </Typography>
                  
                  {submission.aiEvaluation.llmEvaluation.details.exactMatch.matchedPhrases && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 2 }}>
                      {submission.aiEvaluation.llmEvaluation.details.exactMatch.matchedPhrases.map((phrase, index) => (
                        <Chip key={index} label={phrase} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  )}
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Semantic Understanding:
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {submission.aiEvaluation.llmEvaluation.details.semanticSimilarity.explanation}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Reasoning Evaluation:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Strengths:
                      </Typography>
                      <List dense>
                        {submission.aiEvaluation.llmEvaluation.details.reasoning.strengths.map((strength, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={strength} />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Areas for Improvement:
                      </Typography>
                      <List dense>
                        {submission.aiEvaluation.llmEvaluation.details.reasoning.weaknesses.map((weakness, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <FlagIcon color="error" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={weakness} />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Paper>
          </>
        ) : (
          <Alert severity="warning">
            AI evaluation data is not available for this submission.
          </Alert>
        )}
      </TabPanel>
      
      {/* Expert Panel Feedback Tab */}
      <TabPanel value={activeTab} index={3}>
        {evaluationLoading ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 3 }}>
              Expert Panel Analysis in Progress
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Our AI expert panel is reviewing your answers to provide personalized feedback...
            </Typography>
          </Box>
        ) : submission.aiEvaluation && submission.aiEvaluation.expertPanelFeedback ? (
          <>
            <Typography variant="h5" gutterBottom>
              AI Expert Panel Feedback
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              This feedback was generated by an AI expert panel analysis system that identifies learning patterns, misconceptions, and areas for improvement.
            </Alert>
            
            <Grid container spacing={3}>
              {/* Misconceptions */}
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CommentOutlinedIcon color="error" sx={{ mr: 1.5 }} />
                    <Typography variant="h6">
                      Misconceptions
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {submission.aiEvaluation.expertPanelFeedback.misconceptions.map((item, index) => (
                      <ListItem key={index} sx={{ py: 1 }} alignItems="flex-start">
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CancelIcon color="error" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
              
              {/* Learning Gaps */}
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SearchOutlinedIcon color="warning" sx={{ mr: 1.5 }} />
                    <Typography variant="h6">
                      Learning Gaps
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {submission.aiEvaluation.expertPanelFeedback.learningGaps.map((item, index) => (
                      <ListItem key={index} sx={{ py: 1 }} alignItems="flex-start">
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <FlagIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
              
              {/* Strength Areas */}
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CheckCircleIcon color="success" sx={{ mr: 1.5 }} />
                    <Typography variant="h6">
                      Areas of Strength
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {submission.aiEvaluation.expertPanelFeedback.strengthAreas.map((item, index) => (
                      <ListItem key={index} sx={{ py: 1 }} alignItems="flex-start">
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircleIcon color="success" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>              </Grid>
              
              {/* Improvement Suggestions */}
              <Grid item xs={12} md={6}>
                <Paper elevation={2} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon color="primary" sx={{ mr: 1.5 }} />
                    <Typography variant="h6">
                      Suggested Improvements
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {submission.aiEvaluation.expertPanelFeedback.improvementSuggestions.map((item, index) => (
                      <ListItem key={index} sx={{ py: 1 }} alignItems="flex-start">
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <SchoolIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={item} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
              
              {/* Competency Scores */}
              {submission.aiEvaluation.expertPanelFeedback.competencyScores && (
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AssessmentIcon color="primary" sx={{ mr: 1.5 }} />
                      <Typography variant="h6">
                        Competency Assessment
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Box sx={{ px: 2 }}>
                          <Typography variant="body1" paragraph>
                            {submission.aiEvaluation.expertPanelFeedback.feedbackSummary}
                          </Typography>
                          
                          {submission.aiEvaluation.expertPanelFeedback.topConcepts && 
                           submission.aiEvaluation.expertPanelFeedback.topConcepts.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle1" gutterBottom>
                                Key Concepts in Your Responses:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {submission.aiEvaluation.expertPanelFeedback.topConcepts.map((concept, index) => (
                                  <Chip 
                                    key={index} 
                                    label={concept} 
                                    color="primary" 
                                    variant="outlined" 
                                    size="small"
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Factual Accuracy
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={submission.aiEvaluation.expertPanelFeedback.competencyScores.factualAccuracy} 
                              color="success"
                              sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="caption" align="right" display="block" sx={{ mt: 0.5 }}>
                              {submission.aiEvaluation.expertPanelFeedback.competencyScores.factualAccuracy}%
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Conceptual Understanding
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={submission.aiEvaluation.expertPanelFeedback.competencyScores.conceptualUnderstanding} 
                              color="primary"
                              sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="caption" align="right" display="block" sx={{ mt: 0.5 }}>
                              {submission.aiEvaluation.expertPanelFeedback.competencyScores.conceptualUnderstanding}%
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              Clarity of Communication
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={submission.aiEvaluation.expertPanelFeedback.competencyScores.clarity} 
                              color="info"
                              sx={{ height: 10, borderRadius: 5 }}
                            />
                            <Typography variant="caption" align="right" display="block" sx={{ mt: 0.5 }}>
                              {submission.aiEvaluation.expertPanelFeedback.competencyScores.clarity}%
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                              Overall Competency
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={submission.aiEvaluation.expertPanelFeedback.competencyScores.overallCompetency} 
                              color="secondary"
                              sx={{ height: 12, borderRadius: 5 }}
                            />
                            <Typography variant="caption" align="right" display="block" sx={{ mt: 0.5 }}>
                              {submission.aiEvaluation.expertPanelFeedback.competencyScores.overallCompetency}%
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              )}
              
              {/* Detailed Analysis */}
              {submission.aiEvaluation.expertPanelFeedback.detailedAnalysis && 
               submission.aiEvaluation.expertPanelFeedback.detailedAnalysis.length > 0 && (
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <AnalyticsIcon color="primary" sx={{ mr: 1.5 }} />
                      <Typography variant="h6">
                        Detailed Question Analysis
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Box sx={{ mt: 2 }}>
                      <Accordion>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          aria-controls="panel1a-content"
                          id="panel1a-header"
                        >
                          <Typography variant="subtitle1">How to use this detailed analysis</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="body2" color="text.secondary">
                            This section provides a detailed breakdown of your answers by question. Each analysis includes 
                            feedback on factual accuracy, conceptual understanding, and clarity. Use these insights to 
                            identify specific areas for improvement in each of your responses.
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                      
                      {submission.aiEvaluation.expertPanelFeedback.detailedAnalysis.map((analysis, index) => (
                        <Accordion key={index} sx={{ mt: 2 }}>
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls={`panel-content-${index}`}
                            id={`panel-header-${index}`}
                          >
                            <Typography variant="subtitle1">
                              Question {analysis.questionIndex + 1}: {analysis.questionText}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={4}>
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="subtitle2" color="error" gutterBottom>
                                    Factual Accuracy
                                  </Typography>
                                  <Typography variant="body2" paragraph>
                                    {analysis.factualAccuracy.feedback}
                                  </Typography>
                                  {analysis.factualAccuracy.suggestions.length > 0 && (
                                    <>
                                      <Typography variant="caption" color="text.secondary">
                                        Suggestions:
                                      </Typography>
                                      <List dense>
                                        {analysis.factualAccuracy.suggestions.map((suggestion, idx) => (
                                          <ListItem key={idx} sx={{ py: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                              <ArrowRightIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText 
                                              primary={suggestion} 
                                              primaryTypographyProps={{ variant: 'caption' }}
                                            />
                                          </ListItem>
                                        ))}
                                      </List>
                                    </>
                                  )}
                                </Box>
                              </Grid>
                              
                              <Grid item xs={12} md={4}>
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="subtitle2" color="primary" gutterBottom>
                                    Conceptual Understanding
                                  </Typography>
                                  <Typography variant="body2" paragraph>
                                    {analysis.conceptualUnderstanding.feedback}
                                  </Typography>
                                  {analysis.conceptualUnderstanding.suggestions.length > 0 && (
                                    <>
                                      <Typography variant="caption" color="text.secondary">
                                        Suggestions:
                                      </Typography>
                                      <List dense>
                                        {analysis.conceptualUnderstanding.suggestions.map((suggestion, idx) => (
                                          <ListItem key={idx} sx={{ py: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                              <ArrowRightIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText 
                                              primary={suggestion} 
                                              primaryTypographyProps={{ variant: 'caption' }}
                                            />
                                          </ListItem>
                                        ))}
                                      </List>
                                    </>
                                  )}
                                </Box>
                              </Grid>
                              
                              <Grid item xs={12} md={4}>
                                <Box sx={{ mb: 2 }}>
                                  <Typography variant="subtitle2" color="info.main" gutterBottom>
                                    Clarity of Communication
                                  </Typography>
                                  <Typography variant="body2" paragraph>
                                    {analysis.clarity.feedback}
                                  </Typography>
                                  {analysis.clarity.suggestions.length > 0 && (
                                    <>
                                      <Typography variant="caption" color="text.secondary">
                                        Suggestions:
                                      </Typography>
                                      <List dense>
                                        {analysis.clarity.suggestions.map((suggestion, idx) => (
                                          <ListItem key={idx} sx={{ py: 0 }}>
                                            <ListItemIcon sx={{ minWidth: 28 }}>
                                              <ArrowRightIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText 
                                              primary={suggestion} 
                                              primaryTypographyProps={{ variant: 'caption' }}
                                            />
                                          </ListItem>
                                        ))}
                                      </List>
                                    </>
                                  )}
                                </Box>
                              </Grid>
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  </Paper>
                </Grid>              )}
            </Grid>
          </>
        ) : (
          <Alert severity="warning">
            Expert panel feedback is not available for this submission.
          </Alert>
        )}
      </TabPanel>
      
      {/* Feedback Tab */}
      <TabPanel value={activeTab} index={4}>
        <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Overall Feedback
          </Typography>
          <Typography variant="body1" paragraph>
            {submission.feedback?.overallFeedback || 'No feedback provided.'}
          </Typography>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            Strengths
          </Typography>
          <List>
            {scorePercentage >= 80 && (
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="Strong overall understanding of the material" />
              </ListItem>
            )}
            {/* You would generate these dynamically based on the submission */}
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Good grasp of fundamental concepts" />
            </ListItem>
          </List>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Areas for Improvement
          </Typography>
          <List>
            {scorePercentage < 80 && (
              <ListItem>
                <ListItemIcon>
                  <FlagIcon color="warning" />
                </ListItemIcon>
                <ListItemText primary="Review the course materials to strengthen your understanding" />
              </ListItem>
            )}
            {/* You would generate these dynamically based on the submission */}
            <ListItem>
              <ListItemIcon>
                <FlagIcon color="warning" />
              </ListItemIcon>
              <ListItemText primary="Practice more complex problem-solving scenarios" />
            </ListItem>
          </List>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Next Steps
          </Typography>
          <Alert severity="info" sx={{ mt: 1 }}>
            <Typography variant="body1">
              Based on your performance, we recommend focusing on the following topics:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Review Tree traversal algorithms" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Practice time complexity analysis" />
              </ListItem>
            </List>
          </Alert>
        </Paper>
      </TabPanel>
    </Container>
  );
};

export default SubmissionResults;