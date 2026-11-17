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
import { useLocation, useNavigate } from 'react-router-dom';

// Relative by default so requests go through the dev proxy / same origin in production
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Shown only when neither the courses API nor any assessment provides a course
const FALLBACK_COURSES = [
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
];

// Utility function to check if an assessment is new (less than 3 days old)
const isNewAssessment = (dueDate) => {
  const now = new Date();
  const assessmentDate = new Date(dueDate);
  const diffTime = Math.abs(now - assessmentDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
};

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  
// The upcoming endpoint returns the stored assessment (questions included) but no
// questionCount, and totalPoints may be missing for instructor-saved assessments.
const normalizeAssessment = (assessment) => {
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  return {
    ...assessment,
    _id: assessment.id || assessment._id,
    title: assessment.title || 'Untitled Assessment',
    course: assessment.course || {
      title: assessment.courseName || 'Unknown Course',
      _id: assessment.courseId || 'unknown'
    },
    questionCount: assessment.questionCount ?? questions.length,
    totalPoints: assessment.totalPoints ??
      questions.reduce((sum, q) => sum + (Number(q.points || q.pointsPerQuestion) || 1), 0),
    isNew: isNewAssessment(assessment.createdAt || assessment.dueDate)
  };
};

// Enrolled courses plus any course the student has assessments in (the mock course
// list on the backend doesn't include the courses instructors assign assessments to).
const buildCourseList = (apiCourses, assessments) => {
  const coursesById = new Map();
  (apiCourses || []).forEach((course) => {
    const id = course._id || course.id;
    if (id) coursesById.set(String(id), { ...course, _id: id, progress: Number(course.progress) || 0 });
  });
  assessments.forEach((assessment) => {
    const courseId = assessment.course?._id;
    if (!courseId || courseId === 'unknown' || coursesById.has(String(courseId))) return;
    const courseAssessments = assessments.filter((a) => String(a.course?._id) === String(courseId));
    const completed = courseAssessments.filter((a) => a.status === 'completed').length;
    coursesById.set(String(courseId), {
      _id: courseId,
      title: assessment.course.title || 'Course',
      description: `${plural(courseAssessments.length, 'assessment')} assigned to you.`,
      progress: Math.round((completed / courseAssessments.length) * 100)
    });
  });
  if (coursesById.size === 0 && !apiCourses) return FALLBACK_COURSES;
  return Array.from(coursesById.values());
};

const loadFallbackAssessments = () => {
          // Try to get assessments from localStorage as fallback
          let assessmentsFromStorage = [];
          try {
            const savedAssessmentsString = localStorage.getItem('savedAssessments');
            if (savedAssessmentsString) {
              const savedAssessments = JSON.parse(savedAssessmentsString);
              
              // Filter for assessments that are assigned to students AND visible
              assessmentsFromStorage = savedAssessments
                .filter(assessment => {
                  const isAssigned = assessment.assignToAllStudents === true;
                  const isVisible = assessment.visibleToStudents === true;
                  const isPublished = assessment.status === 'published' || assessment.isPublished === true;
                  
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
          
          return mockAssessmentsWithNewFlag;
};

const Dashboard = () => {
  const [courses, setCourses] = useState([]);
  const [upcomingAssessments, setUpcomingAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
        
  const navigate = useNavigate();
  const location = useLocation();
  const wasTerminated = Boolean(location.state?.terminated);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { 'x-auth-token': token } };

      // Independent requests run in parallel instead of one after another
      const [coursesResult, assessmentsResult] = await Promise.allSettled([
        axios.get(`${API_URL}/curriculum/courses/enrolled`, config),
        axios.get(`${API_URL}/student/assessment/upcoming`, config)
      ]);
      if (cancelled) return;

      let assessments;
      const assessmentData = assessmentsResult.status === 'fulfilled' ? assessmentsResult.value.data : null;
      if (assessmentData?.success && Array.isArray(assessmentData.assessments)) {
        // Filter out any null or undefined assessments
        assessments = assessmentData.assessments
          .filter(assessment => assessment && assessment.title)
          .map(normalizeAssessment);
      } else {
        console.warn('Assessment API fetch failed, using localStorage fallback:', assessmentsResult.reason || assessmentData);
        assessments = loadFallbackAssessments();
      }

      const courseData = coursesResult.status === 'fulfilled' ? coursesResult.value.data : null;
      const apiCourses = Array.isArray(courseData?.courses) ? courseData.courses : null;
      if (!apiCourses) {
        console.warn('Courses API fetch failed:', coursesResult.reason || courseData);
      }

      setUpcomingAssessments(assessments);
      setCourses(buildCourseList(apiCourses, assessments));
      setLoading(false);
    };

    fetchDashboardData().catch((fetchError) => {
      if (cancelled) return;
      console.error('Error fetching dashboard data:', fetchError);
      setError('Failed to load dashboard data. Please try again later.');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Progress summary derived from the student's actual assessments
  const completedAssessments = upcomingAssessments.filter((a) => a.status === 'completed');
  const pendingCount = upcomingAssessments.filter((a) => a.status === 'available').length;
  const completionRate = upcomingAssessments.length
    ? Math.round((completedAssessments.length / upcomingAssessments.length) * 100)
    : 0;
  const scoredPercentages = completedAssessments
    .map((a) => Number(a.studentSubmission?.percentage))
    .filter((value) => Number.isFinite(value));
  const averageScore = scoredPercentages.length
    ? Math.round(scoredPercentages.reduce((sum, value) => sum + value, 0) / scoredPercentages.length)
    : null;
  const passedCount = completedAssessments.filter((a) => a.studentSubmission?.isPassed).length;

  const viewResults = (assessment) => {
    const submission = assessment.studentSubmission || {};
    // The upcoming endpoint doesn't return the submission id yet; use it when present.
    navigate(`/results/${submission.id || submission.submissionId || 'temp'}`, {
      state: {
        score: submission.score ?? 0,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        isPassed: submission.isPassed,
        submittedAt: submission.submittedAt,
        assessment
      }
    });
  };

  // Render UI
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}
      {wasTerminated && (
        <Alert severity="error" sx={{ mb: 4 }}>
          Your last assessment was terminated because of repeated proctoring violations.
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
                  .map((assessment, index) => (
                  <Grid item xs={12} key={assessment._id || `assessment-${index}`}>
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
                              {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : 'No due date'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6} md={3}>
                            <Typography variant="body2" color="text.secondary">
                              Time Limit
                            </Typography>
                            <Typography variant="body1">
                              {assessment.timeLimit ? `${assessment.timeLimit} min` : 'None'}
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
                            <Typography variant="body1" component="div">
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
                              onClick={() => viewResults(assessment)}
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
                            {assessment.studentSubmission && !assessment.studentSubmission.isPassed && (
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
                    {completionRate}%
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
                      primary={`${plural(completedAssessments.length, 'Assessment')} Completed`}
                      secondary={`${pendingCount} Pending`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <SchoolIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={`${plural(courses.length, 'Course')} In Progress`}
                      secondary={`${plural(upcomingAssessments.length, 'assessment')} assigned`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <TimelineIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={averageScore !== null ? `${averageScore}% Average Score` : 'No scores yet'}
                      secondary={averageScore !== null
                        ? `${passedCount} of ${completedAssessments.length} passed`
                        : 'Complete an assessment to see your average'}
                    />
                  </ListItem>
                </List>
                
                <Box sx={{ mt: 2 }}>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    fullWidth
                    disabled={courses.length === 0}
                    onClick={() => navigate(`/learning-path/${courses[0]._id}`)}
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