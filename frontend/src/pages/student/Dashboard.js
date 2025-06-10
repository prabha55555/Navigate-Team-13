import {
    ArrowForward as ArrowForwardIcon,
    Assessment as AssessmentIcon,
    School as SchoolIcon,
    Timeline as TimelineIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
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
    Typography
} from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Utility function to check if an assessment is new (less than 3 days old)
const isNewAssessment = (dueDate) => {
  const now = new Date();
  const assessmentDate = new Date(dueDate);
  const diffTime = Math.abs(now - assessmentDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
};

const Dashboard = () => {
  const [courses, setCourses] = useState([]);
  const [upcomingAssessments, setUpcomingAssessments] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Configure API with auth token
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
        const token = localStorage.getItem('token');
        const api = axios.create({
          baseURL: API_URL,
          headers: { 'x-auth-token': token }
        });

        // Try to fetch course data
        try {
          const coursesResponse = await api.get('/courses/enrolled');
          setCourses(coursesResponse.data.courses);
        } catch (courseError) {
          console.warn('Courses API fetch failed:', courseError);
          // Use mock course data
          setCourses([
            {
              _id: '1',
              title: 'Data Structures and Algorithms',
              description: 'Introduction to fundamental data structures and algorithms used in computer science.',
              progress: 65
            },
            {
              _id: '2',
              title: 'Web Development',
              description: 'Learn modern web development techniques using React, Node.js, and related technologies.',
              progress: 40
            }
          ]);
        }        // Fetch upcoming assessments
        try {
          console.log('=== FETCHING ASSESSMENTS FOR STUDENT DASHBOARD ===');
          const assessmentsResponse = await api.get('/student/assessment/upcoming');
          
          if (assessmentsResponse.data.success && Array.isArray(assessmentsResponse.data.assessments)) {
            // Filter out any null or undefined assessments
            const validAssessments = assessmentsResponse.data.assessments
              .filter(assessment => assessment && assessment.title);
            
            // Mark assessments as new if they were created in the last 3 days
            const assessmentsWithNewFlag = validAssessments.map(assessment => ({
              ...assessment,
              _id: assessment.id || assessment._id || `assessment-${Date.now()}`,
              title: assessment.title || 'Untitled Assessment',
              course: assessment.course || { 
                title: assessment.courseName || 'Unknown Course', 
                _id: assessment.courseId || 'unknown' 
              },
              isNew: isNewAssessment(assessment.createdAt || assessment.dueDate)
            }));
            
            console.log(`Loaded ${assessmentsWithNewFlag.length} assessments from API`);
            setUpcomingAssessments(assessmentsWithNewFlag);
          } else {
            throw new Error('Invalid assessment data structure from API');
          }
        } catch (assessmentError) {
          console.warn('Assessment API fetch failed, trying localStorage fallback:', assessmentError);
          
          // Try to get assessments from localStorage as fallback
          let assessmentsFromStorage = [];
          try {
            const savedAssessmentsString = localStorage.getItem('savedAssessments');
            if (savedAssessmentsString) {
              const savedAssessments = JSON.parse(savedAssessmentsString);
              
              console.log(`Found ${savedAssessments.length} saved assessments in localStorage`);
              
              // Filter for assessments that are assigned to students AND visible
              assessmentsFromStorage = savedAssessments
                .filter(assessment => {
                  const isAssigned = assessment.assignToAllStudents === true;
                  const isVisible = assessment.visibleToStudents === true;
                  const isPublished = assessment.status === 'published' || assessment.isPublished === true;
                  
                  console.log(`Assessment "${assessment.title}": assigned=${isAssigned}, visible=${isVisible}, published=${isPublished}`);
                  
                  return isAssigned && isVisible && isPublished;
                })
                .map(assessment => ({
                  _id: assessment.id || assessment._id,
                  title: assessment.title,
                  course: { 
                    _id: assessment.courseId, 
                    title: assessment.courseName || 'Course'
                  },
                  description: assessment.description,
                  dueDate: assessment.dueDate,
                  timeLimit: assessment.timeLimit,
                  totalPoints: assessment.totalPoints,
                  questionCount: assessment.questions?.length || 0,
                  createdAt: assessment.createdAt,
                  status: 'published',
                  visibility: assessment.visibility,
                  isNew: isNewAssessment(assessment.createdAt || assessment.dueDate)
                }));
            }
          } catch (storageError) {
            console.error('Error accessing localStorage:', storageError);
          }
            // Use mock assessments if no localStorage or API data
          const mockAssessments = assessmentsFromStorage.length > 0 ? assessmentsFromStorage : [
            {
              _id: 'a1',
              title: 'Java Data Structures Assessment',
              course: { title: 'Data Structures and Algorithms in Java' },
              dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
              timeLimit: 90,
              totalPoints: 100,
              questionCount: 11,
              createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
              status: 'published'
            },
            {
              _id: 'a2',
              title: 'JavaScript Quiz',
              course: { title: 'Web Development' },
              dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
              timeLimit: 30,
              totalPoints: 50,
              questionCount: 5,
              createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
              status: 'published'
            }
          ];
          
          // Add isNew flag to mock assessments
          const mockAssessmentsWithNewFlag = mockAssessments.map(assessment => ({
            ...assessment,
            isNew: isNewAssessment(assessment.createdAt || assessment.dueDate)
          }));
          
          setUpcomingAssessments(mockAssessmentsWithNewFlag);
        }

        // Try to fetch submissions
        try {
          const submissionsResponse = await api.get('/submissions/recent');
          setRecentSubmissions(submissionsResponse.data.submissions);
        } catch (submissionError) {
          console.warn('Submissions API fetch failed:', submissionError);
          // Use mock submission data
          setRecentSubmissions([
            {
              _id: 's1',
              assessment: { title: 'Practice Quiz' },
              course: { title: 'Data Structures and Algorithms' },
              submittedAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
              score: 85,
              maxScore: 100
            },
            {
              _id: 's2',
              assessment: { title: 'HTML Basics' },
              course: { title: 'Web Development' },
              submittedAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
              score: 95,
              maxScore: 100
            }
          ]);
        }
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Render UI
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={4}>
          {/* Course Progress Section */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>
              My Courses
            </Typography>
            <Grid container spacing={3}>
              {courses.length > 0 ? (
                courses.map((course) => (
                  <Grid item xs={12} md={6} key={course._id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {course.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {course.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={course.progress} 
                              sx={{ height: 10, borderRadius: 5 }}
                            />
                          </Box>
                          <Box sx={{ minWidth: 35 }}>
                            <Typography variant="body2" color="text.secondary">
                              {course.progress}%
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button 
                          size="small" 
                          color="primary"                          onClick={() => navigate(`/course/${course._id}`)}
                          endIcon={<ArrowForwardIcon />}
                        >
                          View Course
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      You are not enrolled in any courses yet.
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Grid>
          
          {/* Upcoming Assessments Section */}
          <Grid item xs={12} md={8}>
            <Typography variant="h5" gutterBottom>
              Upcoming Assessments
            </Typography>
            <Grid container spacing={2}>              {upcomingAssessments.length > 0 ? (
                upcomingAssessments
                  .filter(assessment => assessment && assessment.title) // Filter out any null/undefined assessments or those without a title
                  .map((assessment) => (
                  <Grid item xs={12} key={assessment._id || `assessment-${Math.random()}`}>
                    <Card variant="outlined">
                      <CardContent>                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="h6">
                              {assessment.title || 'Untitled Assessment'}
                              {assessment.isNew && (
                                <Chip 
                                  label="New" 
                                  color="primary" 
                                  size="small" 
                                  sx={{ ml: 1, height: 20 }} 
                                />
                              )}
                              {assessment.isInstructorCreated && (
                                <Chip 
                                  label="Instructor Created" 
                                  color="secondary" 
                                  size="small" 
                                  sx={{ ml: 1, height: 20 }} 
                                />
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {assessment.course.title}
                              {assessment.visibility && assessment.visibility.pattern && 
                                ` • ${assessment.visibility.pattern.name} • ${assessment.visibility.pattern.difficulty}`
                              }
                            </Typography>
                            {assessment.visibility && assessment.visibility.pattern && assessment.visibility.pattern.description && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {assessment.visibility.pattern.description}
                              </Typography>
                            )}
                          </Box>
                          <Box>
                            <Chip 
                              icon={<AssessmentIcon />} 
                              label={`${assessment.totalPoints} points`} 
                              variant="outlined" 
                              size="small" 
                            />
                          </Box>
                        </Box>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        <Grid container spacing={2}>
                          <Grid item xs={6} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              Due Date
                            </Typography>
                            <Typography variant="body1">
                              {new Date(assessment.dueDate).toLocaleDateString()}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              Time Limit
                            </Typography>
                            <Typography variant="body1">
                              {assessment.timeLimit} min
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              Questions
                            </Typography>
                            <Typography variant="body1">
                              {assessment.questionCount}
                            </Typography>
                          </Grid>                          <Grid item xs={6} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                            <Typography variant="body1">
                              {assessment.status === 'completed' ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <Chip 
                                    label="Completed" 
                                    color="info"
                                    size="small" 
                                  />
                                  {assessment.studentSubmission && (
                                    <Chip 
                                      label={assessment.studentSubmission.isPassed ? 
                                        `Passed (${assessment.studentSubmission.percentage}%)` : 
                                        `Failed (${assessment.studentSubmission.percentage}%)`
                                      }
                                      color={assessment.studentSubmission.isPassed ? 'success' : 'error'}
                                      size="small"
                                      variant="outlined"
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Chip 
                                  label={assessment.originalStatus === 'draft' ? 'Coming Soon' : 'Available'} 
                                  color={assessment.status === 'available' ? 'success' : 'default'}
                                  size="small" 
                                />
                              )}
                            </Typography>
                          </Grid>
                        </Grid>
                      </CardContent>                      <CardActions>                        
                        {assessment.status === 'completed' ? (
                          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={() => navigate(`/results/${assessment.studentSubmission?.submissionId || 'temp'}`, {
                                state: {
                                  score: assessment.studentSubmission?.score,
                                  maxScore: assessment.studentSubmission?.maxScore,
                                  assessment: assessment
                                }
                              })}
                              endIcon={<ArrowForwardIcon />}
                              sx={{ flex: 1 }}
                            >
                              View Results
                            </Button>
                            {assessment.studentSubmission?.isPassed && (
                              <Chip 
                                label="✓ Passed" 
                                color="success" 
                                size="small"
                                sx={{ alignSelf: 'center' }}
                              />
                            )}
                            {!assessment.studentSubmission?.isPassed && (
                              <Chip 
                                label="✗ Failed" 
                                color="error" 
                                size="small"
                                sx={{ alignSelf: 'center' }}
                              />
                            )}
                          </Box>
                        ) : (
                          <Button 
                            size="small" 
                            color="primary"
                            disabled={assessment.status !== 'available'}
                            onClick={() => navigate(`/assessment/${assessment._id}`)}
                            endIcon={<ArrowForwardIcon />}
                            fullWidth
                          >
                            Start Assessment
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No upcoming assessments at this time.
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Grid>
          
          {/* Quick Stats Section */}
          <Grid item xs={12} md={4}>
            <Typography variant="h5" gutterBottom>
              My Progress
            </Typography>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h4" align="center" color="primary" gutterBottom>
                    78%
                  </Typography>
                  <Typography variant="body2" align="center" color="text.secondary">
                    Overall Completion Rate
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <AssessmentIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="5 Assessments Completed" 
                      secondary="2 Pending" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SchoolIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="2 Courses In Progress" 
                      secondary="25 Modules Completed" 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <TimelineIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="85% Average Score" 
                      secondary="5% improvement this month" 
                    />
                  </ListItem>
                </List>
                
                <Box sx={{ mt: 2 }}>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    fullWidth                    onClick={() => navigate('/dashboard')}
                  >
                    View Detailed Progress
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default Dashboard;