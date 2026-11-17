import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Tab,
    Tabs,
    Typography
} from '@mui/material';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

// Mock data for development
const mockCourse = {
  id: '1',
  title: 'Data Structures and Algorithms in Java',
  code: 'CS301',
  description: 'Introduction to fundamental data structures and algorithms implemented in Java.',
  instructor: 'Dr. Jane Smith',
  term: 'Fall 2025',
  department: 'Computer Science',
  credits: 3,
  assessments: [
    {
      id: '1',
      title: 'Java Data Structures Assessment',
      type: 'Exam',
      dueDate: '2025-10-15',
      status: 'available',
      timeLimit: 90,
      totalPoints: 100
    },
    {
      id: '2',
      title: 'Binary Trees Implementation',
      type: 'Programming Assignment',
      dueDate: '2025-11-01',
      status: 'available',
      timeLimit: 0,
      totalPoints: 50
    },
    {
      id: '3',
      title: 'Final Exam',
      type: 'Exam',
      dueDate: '2025-12-10',
      status: 'upcoming',
      timeLimit: 120,
      totalPoints: 150
    }
  ],
  materials: [
    {
      id: '1',
      title: 'Introduction to Data Structures',
      type: 'Lecture Notes',
      week: 1,
      url: '#'
    },
    {
      id: '2',
      title: 'Array Implementation',
      type: 'Programming Example',
      week: 2,
      url: '#'
    },
    {
      id: '3',
      title: 'Linked Lists vs Arrays',
      type: 'Research Article',
      week: 3,
      url: '#'
    }
  ],
  syllabus: {
    learningOutcomes: [
      'Understand fundamental data structures and their implementations',
      'Analyze algorithm complexity using Big O notation',
      'Implement and use common data structures such as lists, stacks, queues, trees, and graphs',
      'Apply appropriate data structures to solve programming problems',
      'Compare and evaluate algorithms for efficiency'
    ],
    weeklyTopics: [
      {
        week: 1,
        topic: 'Introduction to Data Structures',
        description: 'Overview of course, introduction to basic concepts.'
      },
      {
        week: 2,
        topic: 'Arrays and Lists',
        description: 'Implementation and operations on arrays and lists.'
      },
      {
        week: 3,
        topic: 'Linked Lists',
        description: 'Singly and doubly linked lists, operations and applications.'
      },
      {
        week: 4,
        topic: 'Stacks and Queues',
        description: 'Stack and queue implementations and applications.'
      },
      {
        week: 5,
        topic: 'Recursion',
        description: 'Recursive algorithms and problem-solving.'
      },
      {
        week: 6,
        topic: 'Trees I',
        description: 'Binary trees, traversal algorithms.'
      },
      {
        week: 7,
        topic: 'Midterm Review and Exam',
        description: 'Review of material and midterm examination.'
      },
      {
        week: 8,
        topic: 'Trees II',
        description: 'Binary search trees, balanced trees.'
      },
      {
        week: 9,
        topic: 'Heaps and Priority Queues',
        description: 'Heap implementation and applications.'
      },
      {
        week: 10,
        topic: 'Graphs I',
        description: 'Graph representations and traversal algorithms.'
      },
      {
        week: 11,
        topic: 'Graphs II',
        description: 'Shortest path and minimum spanning tree algorithms.'
      },
      {
        week: 12,
        topic: 'Sorting and Searching',
        description: 'Comparison of sorting and searching algorithms.'
      },
      {
        week: 13,
        topic: 'Hashing',
        description: 'Hash tables, collision resolution strategies.'
      },
      {
        week: 14,
        topic: 'Advanced Topics',
        description: 'Advanced data structures and algorithms.'
      },
      {
        week: 15,
        topic: 'Final Review',
        description: 'Comprehensive review of course material.'
      }
    ]
  },
  progress: {
    completedAssessments: 1,
    totalAssessments: 3,
    averageScore: 85,
    learningPathStatus: 'on-track'
  }
};

const sumPoints = (questions) =>
  (Array.isArray(questions) ? questions : []).reduce(
    (sum, q) => sum + (Number(q.points || q.pointsPerQuestion) || 1),
    0
  );

// Map an assessment from GET /api/student/assessment/upcoming to the card format below
const toCourseAssessment = (assessment) => ({
  id: assessment.id || assessment._id,
  title: assessment.title || 'Untitled Assessment',
  type: assessment.visibility?.pattern?.name || 'Assessment',
  dueDate: assessment.dueDate,
  status: assessment.status === 'completed' ? 'completed' : 'available',
  timeLimit: assessment.timeLimit,
  totalPoints: assessment.totalPoints ?? sumPoints(assessment.questions),
  visibility: assessment.visibility,
  studentSubmission: assessment.studentSubmission,
  raw: assessment
});

// Course details from GET /api/curriculum/courses/:id (units/lessons) in this page's shape
const fromApiCourse = (courseId, apiCourse) => {
  const units = Array.isArray(apiCourse.units) ? apiCourse.units : [];
  return {
    id: courseId,
    title: apiCourse.title,
    description: apiCourse.description,
    code: apiCourse.code,
    department: apiCourse.department,
    credits: apiCourse.credits,
    level: apiCourse.level,
    instructor: apiCourse.instructorName || apiCourse.instructor?.name,
    term: apiCourse.term,
    assessments: [],
    materials: units.flatMap((unit, unitIndex) =>
      (Array.isArray(unit.lessons) ? unit.lessons : []).map((lesson, lessonIndex) => ({
        id: `${unitIndex}-${lessonIndex}`,
        title: lesson.title,
        type: lesson.type,
        week: unitIndex + 1,
        url: lesson.url
      }))
    ),
    syllabus: {
      learningOutcomes: Array.isArray(apiCourse.learningOutcomes) ? apiCourse.learningOutcomes : (apiCourse.topics || []),
      weeklyTopics: units.map((unit, unitIndex) => ({
        week: unitIndex + 1,
        topic: unit.title,
        description: (Array.isArray(unit.lessons) ? unit.lessons : []).map((lesson) => lesson.title).join(', ')
      }))
    }
  };
};

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  // Load course data
  useEffect(() => {
    let cancelled = false;

    const fetchCourseData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = { headers: { 'x-auth-token': token } };
      const [courseResult, assessmentsResult] = await Promise.allSettled([
        axios.get(`/api/curriculum/courses/${courseId}`, config),
        axios.get('/api/student/assessment/upcoming', config)
      ]);
      if (cancelled) return;
        
      const apiCourse = courseResult.status === 'fulfilled' ? courseResult.value.data?.course : null;
      const assessmentData = assessmentsResult.status === 'fulfilled' ? assessmentsResult.value.data : null;
      const apiAssessments = assessmentData?.success && Array.isArray(assessmentData.assessments)
        ? assessmentData.assessments.filter(
          (a) => a && String(a.course?._id ?? a.courseId) === String(courseId)
        )
        : null;

      let courseData;
      if (apiCourse) {
        courseData = fromApiCourse(courseId, apiCourse);
      } else if (String(courseId) === mockCourse.id) {
        // Demo content for the default course
        courseData = { ...mockCourse };
      } else if (apiAssessments && apiAssessments.length > 0) {
        courseData = {
          id: courseId,
          title: apiAssessments[0].course?.title || apiAssessments[0].courseName || 'Course',
          description: '',
          assessments: [],
          materials: [],
          syllabus: { learningOutcomes: [], weeklyTopics: [] }
        };
      } else {
        setCourse(null);
        setLoading(false);
        return;
      }

      if (apiAssessments) {
        // Real assessments replace the demo list so "Start Assessment" opens ones that exist
        courseData = { ...courseData, assessments: apiAssessments.map(toCourseAssessment) };
      } else {
        console.warn('Assessment API fetch failed, using localStorage fallback:', assessmentsResult.reason || assessmentData);
        // Try to get assessments from localStorage
        try {
          const savedAssessmentsString = localStorage.getItem('savedAssessments');
          if (savedAssessmentsString) {
            const savedAssessments = JSON.parse(savedAssessmentsString);
            
            // Filter for assessments that belong to this course and are assigned to students
            const courseAssessments = savedAssessments
              .filter(assessment => 
                assessment.courseId === courseId && 
                (assessment.assignToAllStudents || assessment.status === 'published')
              )
              .map(assessment => ({
                id: assessment.id,
                title: assessment.title,
                type: assessment.visibility?.pattern?.name || 'Assessment',
                dueDate: assessment.dueDate,
                status: 'available',
                timeLimit: assessment.timeLimit,
                totalPoints: assessment.totalPoints,
                visibility: assessment.visibility
              }));
            
            // If we found relevant assessments, use them
            if (courseAssessments.length > 0) {
              courseData = {
                ...courseData,
                assessments: [...courseData.assessments, ...courseAssessments]
              };
            }
          }
        } catch (storageError) {
          console.error('Error accessing localStorage:', storageError);
        }
      }
        
      const assessments = courseData.assessments || [];
      const completed = assessments.filter((a) => a.status === 'completed').length;
      setCourse({
        ...courseData,
        assessments,
        materials: courseData.materials || [],
        syllabus: {
          learningOutcomes: courseData.syllabus?.learningOutcomes || [],
          weeklyTopics: courseData.syllabus?.weeklyTopics || []
        },
        progress: {
          ...(courseData.progress || {}),
          completedAssessments: apiAssessments ? completed : (courseData.progress?.completedAssessments ?? completed),
          totalAssessments: apiAssessments ? assessments.length : (courseData.progress?.totalAssessments ?? assessments.length)
        }
      });
      setLoading(false);
    };
    
    fetchCourseData().catch((error) => {
      if (cancelled) return;
      console.error('Error fetching course data:', error);
      setCourse(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const viewResults = (assessment) => {
    const submission = assessment.studentSubmission || {};
    navigate(`/results/${submission.id || submission.submissionId || 'temp'}`, {
      state: {
        score: submission.score ?? 0,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        isPassed: submission.isPassed,
        submittedAt: submission.submittedAt,
        assessment: assessment.raw || assessment
      }
    });
  };

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

  if (!course) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h5" color="error">
          Course not found
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Course Header */}
      <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant="h4" component="h1" gutterBottom>
              {course.title}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {[course.code, course.department, course.credits ? `${course.credits} Credits` : null, course.level]
                .filter(Boolean)
                .join(' • ')}
            </Typography>
            <Typography variant="body1" paragraph>
              {course.description}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary="Instructor" secondary={course.instructor || '—'} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CalendarTodayIcon />
                </ListItemIcon>
                <ListItemText primary="Term" secondary={course.term || '—'} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AutoGraphIcon />
                </ListItemIcon>
                <ListItemText 
                  primary="Your Progress" 
                  secondary={`${course.progress.completedAssessments}/${course.progress.totalAssessments} assessments completed`} 
                />
              </ListItem>
            </List>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                component={RouterLink}
                to={`/learning-path/${course.id}`}
                startIcon={<AutoGraphIcon />}
              >
                Learning Path
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs Navigation */}
      <Box sx={{ width: '100%', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="Assessments" icon={<AssignmentIcon />} iconPosition="start" />
          <Tab label="Course Materials" icon={<DescriptionIcon />} iconPosition="start" />
          <Tab label="Syllabus" icon={<MenuBookIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Assessments Tab */}
      <Box hidden={activeTab !== 0}>
        <Typography variant="h5" gutterBottom>
          Assessments
        </Typography>
        <Grid container spacing={3}>
          {course.assessments.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  No assessments have been assigned for this course yet.
                </Typography>
              </Paper>
            </Grid>
          )}
          {course.assessments.map((assessment) => (
            <Grid item xs={12} sm={6} md={4} key={assessment.id}>
              <Card 
                elevation={3} 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  bgcolor: assessment.status === 'upcoming' ? '#f5f5f5' : 'background.paper'
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" gutterBottom>
                      {assessment.title}
                    </Typography>
                    <Chip 
                      label={assessment.status === 'available' ? 'Available' : assessment.status === 'completed' ? 'Completed' : 'Upcoming'}
                      color={assessment.status === 'available' ? 'primary' : assessment.status === 'completed' ? 'success' : 'default'}
                      size="small"
                    />                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {assessment.type}
                    {assessment.visibility && assessment.visibility.pattern && 
                      ` • ${assessment.visibility.pattern.name} • ${assessment.visibility.pattern.difficulty}`
                    }
                  </Typography>
                  {assessment.visibility && assessment.visibility.pattern && assessment.visibility.pattern.description && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      {assessment.visibility.pattern.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2 }}>
                    <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Due: {assessment.dueDate ? new Date(assessment.dueDate).toLocaleDateString() : 'No due date'}
                    </Typography>
                  </Box>
                  <List dense>
                    <ListItem disablePadding>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <AccessTimeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={assessment.timeLimit ? `Time Limit: ${assessment.timeLimit} minutes` : 'No time limit'}
                      />
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CheckCircleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={`Points: ${assessment.totalPoints ?? '—'}`} />
                    </ListItem>
                  </List>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  {assessment.status === 'completed' ? (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => viewResults(assessment)}
                    >
                      View Results
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      fullWidth
                      component={RouterLink}
                      to={`/assessment/${assessment.id}`}
                      disabled={assessment.status !== 'available'}
                    >
                      {assessment.status === 'available' ? 'Start Assessment' : 'Coming Soon'}
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Course Materials Tab */}
      <Box hidden={activeTab !== 1}>
        <Typography variant="h5" gutterBottom>
          Course Materials
        </Typography>
        <List>
          {course.materials.map((material) => (
            <React.Fragment key={material.id}>
              <ListItem 
                component={Paper} 
                elevation={2} 
                sx={{ mb: 2, p: 2, borderRadius: 2 }}
              >
                <ListItemIcon>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText 
                  primary={material.title}
                  // The chips are block content; the default <p> wrapper would be invalid DOM nesting
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Chip 
                        label={`Week ${material.week}`} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                        sx={{ mr: 1 }}
                      />
                      <Chip 
                        label={material.type} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                  }
                />
                <Button 
                  variant="outlined" 
                  size="small" 
                  component="a" 
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  // '#' placeholders would just open the app again in a new tab
                  disabled={!material.url || material.url === '#'}
                >
                  View
                </Button>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
        {course.materials.length === 0 && (
          <Typography color="text.secondary">No course materials have been published yet.</Typography>
        )}
      </Box>

      {/* Syllabus Tab */}
      <Box hidden={activeTab !== 2}>
        <Typography variant="h5" gutterBottom>
          Course Syllabus
        </Typography>
        
        <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Learning Outcomes
          </Typography>
          <List>
            {course.syllabus.learningOutcomes.map((outcome, index) => (
              <ListItem key={index} sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CheckCircleIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={outcome} />
              </ListItem>
            ))}
          </List>
        </Paper>
        
        <Typography variant="h6" gutterBottom>
          Weekly Schedule
        </Typography>
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {course.syllabus.weeklyTopics.map((week, index) => (
            <React.Fragment key={week.week}>
              <Box 
                sx={{ 
                  p: 2,
                  bgcolor: index % 2 === 0 ? 'background.paper' : '#f5f7fa'
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={2}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Week {week.week}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={10}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {week.topic}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {week.description}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
              {index < course.syllabus.weeklyTopics.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Paper>
      </Box>
    </Container>
  );
};

export default CourseView;