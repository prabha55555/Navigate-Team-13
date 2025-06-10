import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
<<<<<<< HEAD
    Tooltip,
=======
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

// Mock data for courses
const mockCourses = [
  {
    id: '1',
    title: 'Data Structures and Algorithms',
    code: 'CS301',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 45,
    assessmentCount: 3,
    description: 'Introduction to fundamental data structures and algorithms used in computer science.',
    students: [
      { id: '1', name: 'Alex Johnson', email: 'alex.j@example.com', avgScore: 88 },
      { id: '2', name: 'Jamie Smith', email: 'jamie.s@example.com', avgScore: 92 },
      { id: '3', name: 'Taylor Williams', email: 'taylor.w@example.com', avgScore: 76 },
      // More students...
    ],    assessments: [
      { id: '1', title: 'Java Data Structures Assessment', syllabusTitle: 'Chapter 1-5', type: 'Exam', dueDate: '2025-10-15', avgScore: 82, submissions: 40, assignToAllStudents: true },
      { id: '2', title: 'Binary Trees Implementation', syllabusTitle: 'Chapter 6', type: 'Programming Assignment', dueDate: '2025-11-01', avgScore: 89, submissions: 42, assignToAllStudents: false },
      { id: '3', title: 'Final Exam', syllabusTitle: 'Chapter 1-10', type: 'Exam', dueDate: '2025-12-10', avgScore: 0, submissions: 0, assignToAllStudents: true }
    ],
    materials: [
      { id: '1', title: 'Introduction to Data Structures', type: 'Lecture Notes', week: 1, url: '#' },
      { id: '2', title: 'Array Implementation', type: 'Programming Example', week: 2, url: '#' },
      { id: '3', title: 'Linked Lists vs Arrays', type: 'Research Article', week: 3, url: '#' }
    ]
  },
  {
    id: '2',
    title: 'Introduction to Programming',
    code: 'CS101',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 120,
    assessmentCount: 5,
    description: 'Fundamentals of programming using Python. No prior experience required.',
    students: [],
    assessments: [],
    materials: []
  },
  {
    id: '3',
    title: 'Web Development Fundamentals',
    code: 'CS240',
    department: 'Computer Science',
    term: 'Fall 2025',
    enrollment: 60,
    assessmentCount: 4,
    description: 'Introduction to web development including HTML, CSS, JavaScript, and responsive design.',
    students: [],
    assessments: [],
    materials: []
  }
];

const CourseManagement = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState('');
  const [dialogItem, setDialogItem] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openCourseFormDialog, setOpenCourseFormDialog] = useState(false);
  const [newCourseData, setNewCourseData] = useState({
    title: '',
    code: '',
    department: 'Computer Science',
    term: 'Fall 2025',
    description: ''
  });

  // Function to handle back to courses navigation
  const handleBackToCourses = () => {
    setSelectedCourse(null);
    navigate('/instructor/courses');
  };

  // Handle course form open
  const handleCourseFormOpen = () => {
    setOpenCourseFormDialog(true);
  };

  // Handle course form close
  const handleCourseFormClose = () => {
    setOpenCourseFormDialog(false);
    // Reset form data
    setNewCourseData({
      title: '',
      code: '',
      department: 'Computer Science',
      term: 'Fall 2025',
      description: ''
    });
  };

  // Handle course form change
  const handleCourseFormChange = (e) => {
    const { name, value } = e.target;
    setNewCourseData({
      ...newCourseData,
      [name]: value
    });
  };

  // Handle course form submit
  const handleCourseFormSubmit = () => {
    // Validate form data
    if (!newCourseData.title || !newCourseData.code) {
      alert('Please fill in all required fields.');
      return;
    }

    // Create a new course with form data
    const newCourse = {
      id: `new-${Date.now()}`, // Generate a unique ID
      title: newCourseData.title,
      code: newCourseData.code,
      department: newCourseData.department,
      term: newCourseData.term,
      enrollment: 0,
      assessmentCount: 0,
      description: newCourseData.description,
      students: [],
      assessments: [],
      materials: []
    };
    
    // Add the new course to the courses list
    const updatedCourses = [...courses, newCourse];
    setCourses(updatedCourses);
    
    // Save courses to localStorage to persist between page refreshes
    try {
      // Get existing saved courses
      const savedCoursesString = localStorage.getItem('savedCourses');
      let savedCourses = [];
      
      if (savedCoursesString) {
        savedCourses = JSON.parse(savedCoursesString);
      }
      
      // Add new course to saved courses
      savedCourses.push(newCourse);
      
      // Save back to localStorage
      localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
      
      console.log('Course saved successfully:', newCourse.title);
      alert(`Course "${newCourse.title}" created successfully!`);
    } catch (error) {
      console.error('Error saving course:', error);
      alert('Error creating course. Please try again.');
    }
    
    // Close the dialog
    handleCourseFormClose();
    
    // Navigate to the new course - include a small delay to ensure state is updated
    setTimeout(() => {
      navigate(`/instructor/courses/${newCourse.id}`);
    }, 100);
  };
  
  // New state for course creation dialog
  const [createCourseDialogOpen, setCreateCourseDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    code: '',
    department: 'Computer Science',
    term: 'Fall 2025',
    description: ''
  });
    // Load courses
  useEffect(() => {
    setLoading(true);
    
    // Try to fetch course data from API
    const fetchCourseData = async () => {
      try {
        // In a real implementation, this would fetch from your real API
        // const response = await axios.get(`/api/courses/${courseId || ''}`);
        // setCourses(response.data.courses);
        // if (courseId) {
        //   setSelectedCourse(response.data.course);
        // }
        
        // For now, use mock data with a simulated API delay
        setTimeout(() => {
<<<<<<< HEAD
          // First check localStorage for any saved courses
          try {
            const savedCoursesString = localStorage.getItem('savedCourses');
            let allCourses = [...mockCourses]; // Start with mock courses
            
            if (savedCoursesString) {
              const savedCourses = JSON.parse(savedCoursesString);
              console.log('Found saved courses:', savedCourses);
              
              // Add saved courses to the list (don't duplicate existing ones)
              savedCourses.forEach(savedCourse => {
                // Check if this course already exists in the mock data
                if (!allCourses.some(c => c.id === savedCourse.id)) {
                  allCourses.push(savedCourse);
                }
              });
            }
            
            // Now check for any saved assessments 
            const savedAssessmentsString = localStorage.getItem('savedAssessments');
            let savedAssessments = [];
            
            if (savedAssessmentsString) {
              savedAssessments = JSON.parse(savedAssessmentsString);
              console.log('Found saved assessments:', savedAssessments);
              
              // Update all courses with saved assessments
              allCourses = allCourses.map(course => {
                const courseAssessments = savedAssessments.filter(a => a.courseId === course.id);
                
                if (courseAssessments.length > 0) {
                  return {
                    ...course,
                    assessments: [
                      ...(course.assessments || []),
                      ...courseAssessments.map(a => ({
                        id: a.id || `saved-${Date.now()}`,
                        title: a.title,
                        syllabusTitle: a.syllabusTitle || 'Generated Assessment',
                        type: 'Quiz',
                        dueDate: a.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        avgScore: 0,
                        submissions: 0,
                        assignToAllStudents: a.assignToAllStudents
                      }))
                    ],
                    assessmentCount: (course.assessmentCount || 0) + courseAssessments.length
                  };
                }
                
                return course;
              });
            }
            
            setCourses(allCourses);
            
            if (courseId) {
              const course = allCourses.find(c => c.id === courseId);
              if (course) {
                setSelectedCourse(course);
=======
          // Check localStorage for any saved courses first
          try {
            const savedCoursesString = localStorage.getItem('savedCourses');
            if (savedCoursesString) {
              const savedCourses = JSON.parse(savedCoursesString);
              console.log('Found saved courses:', savedCourses);
              
              setCourses(savedCourses);
              
              if (courseId) {
                const course = savedCourses.find(c => c.id === courseId);
                if (course) {
                  setSelectedCourse(course);
                }
              }
            } else {
              // Check localStorage for any saved assessments
              const savedAssessmentsString = localStorage.getItem('savedAssessments');
              let savedAssessments = [];
              
              if (savedAssessmentsString) {
                savedAssessments = JSON.parse(savedAssessmentsString);
                console.log('Found saved assessments:', savedAssessments);
                
                // Update the mock courses with saved assessments
                const updatedCourses = mockCourses.map(course => {
                  const courseAssessments = savedAssessments.filter(a => a.courseId === course.id);
                  
                  if (courseAssessments.length > 0) {
                    return {
                      ...course,
                      assessments: [
                        ...course.assessments,
                        ...courseAssessments.map(a => ({
                          id: a.id || `saved-${Date.now()}`,
                          title: a.title,
                          syllabusTitle: a.syllabusTitle || 'Generated Assessment',
                          type: 'Quiz',
                          dueDate: a.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                          avgScore: 0,
                          submissions: 0,
                          assignToAllStudents: a.assignToAllStudents
                        }))
                      ],
                      assessmentCount: course.assessmentCount + courseAssessments.length
                    };
                  }
                  
                  return course;
                });
                
                setCourses(updatedCourses);
                
                if (courseId) {
                  const course = updatedCourses.find(c => c.id === courseId);
                  if (course) {
                    setSelectedCourse(course);
                  }
                }
              } else {
                setCourses(mockCourses);
                
                if (courseId) {
                  const course = mockCourses.find(c => c.id === courseId);
                  if (course) {
                    setSelectedCourse(course);
                  }
                }
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
              }
            }
            
            setLoading(false);
          } catch (error) {
            console.error('Error processing saved data:', error);
            setCourses(mockCourses);
            
            if (courseId) {
              const course = mockCourses.find(c => c.id === courseId);
              if (course) {
                setSelectedCourse(course);
              }
            }
            
            setLoading(false);
          }
        }, 1000);
      } catch (error) {
        console.error('Error fetching course data:', error);
        setCourses(mockCourses);
        
        if (courseId) {
          const course = mockCourses.find(c => c.id === courseId);
          if (course) {
            setSelectedCourse(course);
          }
        }
        
        setLoading(false);
      }
    };
    
    fetchCourseData();
  }, [courseId]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle course selection
  const handleSelectCourse = (course) => {
    navigate(`/instructor/courses/${course.id}`);
  };
    // Handle create new course
  const handleCreateCourse = () => {
<<<<<<< HEAD
    handleCourseFormOpen();
  };
  
  // Handle menu open
  const handleMenuOpen = (event, course) => {
    setAnchorEl({ element: event.currentTarget, course: course });
=======
    setCreateCourseDialogOpen(true);
  };
    // Handle course creation submission
  const handleCreateCourseSubmit = () => {
    // Validate required fields
    if (!newCourse.title || !newCourse.code) {
      return;
    }
    
    // Create a new ID (in a real app this would come from the backend)
    const newId = `course-${Date.now()}`;
    
    // Create the new course object
    const courseToAdd = {
      id: newId,
      title: newCourse.title,
      code: newCourse.code,
      department: newCourse.department,
      term: newCourse.term,
      description: newCourse.description,
      enrollment: 0,
      assessmentCount: 0,
      students: [],
      assessments: [],
      materials: []
    };
    
    // Add the course to the courses list and save to localStorage
    const updatedCourses = [...courses, courseToAdd];
    setCourses(updatedCourses);
    
    // Save courses to localStorage
    try {
      localStorage.setItem('savedCourses', JSON.stringify(updatedCourses));
      console.log('Saved courses to localStorage');
    } catch (error) {
      console.error('Error saving courses to localStorage:', error);
    }
    
    // Close the dialog and reset the form
    setCreateCourseDialogOpen(false);
    setNewCourse({
      title: '',
      code: '',
      department: 'Computer Science',
      term: 'Fall 2025',
      description: ''
    });
    
    // Navigate to the new course
    navigate(`/instructor/courses/${newId}`);
  };
    // Handle menu open
  const handleMenuOpen = (event, course) => {
    setAnchorEl(event.currentTarget);
    setDialogItem(course);
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
  };
  
  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  // Handle dialog open
  const handleOpenDialog = (action, item) => {
    setDialogAction(action);
    setDialogItem(item);
    setOpenDialog(true);
    handleMenuClose();
  };
  
  // Handle dialog close
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
    // Handle dialog confirm
  const handleConfirmDialog = () => {
    // Handle different actions based on dialogAction
    switch (dialogAction) {
      case 'delete-course':
        console.log('Delete course:', dialogItem);
<<<<<<< HEAD
        // Remove course from local state
        const updatedCourses = courses.filter(course => course.id !== dialogItem.id);
        setCourses(updatedCourses);
        
        // Remove from localStorage
        try {
          const savedCoursesString = localStorage.getItem('savedCourses');
          if (savedCoursesString) {
            let savedCourses = JSON.parse(savedCoursesString);
            savedCourses = savedCourses.filter(course => course.id !== dialogItem.id);
            localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
          }
          
          // Also remove any related assessments
          const savedAssessmentsString = localStorage.getItem('savedAssessments');
          if (savedAssessmentsString) {
            let savedAssessments = JSON.parse(savedAssessmentsString);
            savedAssessments = savedAssessments.filter(assessment => assessment.courseId !== dialogItem.id);
            localStorage.setItem('savedAssessments', JSON.stringify(savedAssessments));
          }
          
          alert(`Course "${dialogItem.title}" has been deleted.`);
        } catch (error) {
          console.error('Error deleting course from localStorage:', error);
        }
        
        // Navigate back to course list
=======
        // Remove course from state
        const updatedCourses = courses.filter(course => course.id !== dialogItem.id);
        setCourses(updatedCourses);
        
        // Save updated course list to localStorage
        try {
          localStorage.setItem('savedCourses', JSON.stringify(updatedCourses));
          console.log('Updated courses in localStorage after deletion');
        } catch (error) {
          console.error('Error updating courses in localStorage:', error);
        }
        
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
        navigate('/instructor/courses');
        break;
      case 'delete-assessment':
        console.log('Delete assessment:', dialogItem);
        // Remove assessment from course
        setSelectedCourse(prevCourse => ({
          ...prevCourse,
          assessments: prevCourse.assessments.filter(a => a.id !== dialogItem.id),
          assessmentCount: prevCourse.assessmentCount - 1
        }));
        
        // Remove from localStorage if it exists there
        try {
          const savedAssessmentsString = localStorage.getItem('savedAssessments');
          if (savedAssessmentsString) {
            let savedAssessments = JSON.parse(savedAssessmentsString);
            savedAssessments = savedAssessments.filter(a => a.id !== dialogItem.id);
            localStorage.setItem('savedAssessments', JSON.stringify(savedAssessments));
          }
        } catch (error) {
          console.error('Error deleting assessment from localStorage:', error);
        }
        break;
      case 'delete-material':
        console.log('Delete material:', dialogItem);
        // Remove material from course
        setSelectedCourse(prevCourse => ({
          ...prevCourse,
          materials: prevCourse.materials.filter(m => m.id !== dialogItem.id)
        }));
        break;
      case 'remove-student':
        console.log('Remove student:', dialogItem);
        // Remove student from course
        setSelectedCourse(prevCourse => ({
          ...prevCourse,
          students: prevCourse.students.filter(s => s.id !== dialogItem.id),
          enrollment: prevCourse.enrollment - 1
        }));
        break;
      default:
        break;
    }
    
    handleCloseDialog();
  };
  
  // Handle create assessment
  const handleCreateAssessment = () => {
    navigate('/instructor/assessment');
  };
  
  // Handle edit assessment
  const handleEditAssessment = (assessmentId) => {
    navigate(`/instructor/assessment/${assessmentId}`);
  };

  // Handle view assessment results
  const handleViewResults = (assessmentId) => {
    navigate(`/instructor/student-results/${selectedCourse.id}?assessment=${assessmentId}`);
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
  
  // If no course is selected, show the course list
  if (!selectedCourse) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Course Management
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleCreateCourse}
          >
            Create New Course
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          {courses.map(course => (
            <Grid item xs={12} md={6} lg={4} key={course.id}>
              <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h5" component="h2" gutterBottom>
                      {course.title}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={(event) => handleMenuOpen(event, course)}
                      aria-label="course options"
                    >
                      <MoreVertIcon />
                    </IconButton>
                    <Menu
<<<<<<< HEAD
                      anchorEl={anchorEl?.element}
                      open={Boolean(anchorEl)}
=======
                      anchorEl={anchorEl}
                      open={Boolean(anchorEl) && dialogItem?.id === course.id}
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
                      onClose={handleMenuClose}
                    >
                      <MenuItem onClick={() => handleOpenDialog('delete-course', anchorEl?.course)}>
                        <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                        Delete Course
                      </MenuItem>
                    </Menu>
                  </Box>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    {course.code} • {course.department}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {course.description}
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonAddIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {course.enrollment} Students
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AssessmentIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {course.assessmentCount} Assessments
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {course.term}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    onClick={() => handleSelectCourse(course)}
                  >
                    Manage Course
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
          {/* Confirm Delete Dialog */}
        <Dialog
          open={openDialog && dialogAction === 'delete-course'}
          onClose={handleCloseDialog}
        >
          <DialogTitle>Delete Course</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the course "{dialogItem?.title}"? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleConfirmDialog} color="error">Delete</Button>
          </DialogActions>
        </Dialog>
<<<<<<< HEAD

        {/* Course Form Dialog */}
        <Dialog
          open={openCourseFormDialog}
          onClose={handleCourseFormClose}
        >
          <DialogTitle>Create New Course</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              name="title"
              label="Course Title"
              type="text"
              fullWidth
              value={newCourseData.title}
              onChange={handleCourseFormChange}
            />
            <TextField
              margin="dense"
              name="code"
              label="Course Code"
              type="text"
              fullWidth
              value={newCourseData.code}
              onChange={handleCourseFormChange}
            />
            <TextField
              margin="dense"
              name="department"
              label="Department"
              type="text"
              fullWidth
              value={newCourseData.department}
              onChange={handleCourseFormChange}
            />
            <TextField
              margin="dense"
              name="term"
              label="Term"
              type="text"
              fullWidth
              value={newCourseData.term}
              onChange={handleCourseFormChange}
            />
            <TextField
              margin="dense"
              name="description"
              label="Description"
              type="text"
              fullWidth
              multiline
              rows={4}
              value={newCourseData.description}
              onChange={handleCourseFormChange}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCourseFormClose}>Cancel</Button>
            <Button onClick={handleCourseFormSubmit} color="primary">Create</Button>
=======
        
        {/* Course Creation Dialog */}
        <Dialog 
          open={createCourseDialogOpen} 
          onClose={() => setCreateCourseDialogOpen(false)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>Create New Course</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Course Title"
                    fullWidth
                    required
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({...newCourse, title: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Course Code"
                    fullWidth
                    required
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({...newCourse, code: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Department"
                    fullWidth
                    value={newCourse.department}
                    onChange={(e) => setNewCourse({...newCourse, department: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Term"
                    fullWidth
                    value={newCourse.term}
                    onChange={(e) => setNewCourse({...newCourse, term: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    fullWidth
                    multiline
                    rows={4}
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateCourseDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateCourseSubmit} 
              variant="contained"
              disabled={!newCourse.title || !newCourse.code}
            >
              Create Course
            </Button>
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
          </DialogActions>
        </Dialog>
      </Container>
    );
  }
  
  // Course detail view
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={handleBackToCourses} 
          variant="outlined"
          sx={{ mb: 2 }}
        >
          Back to Courses
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1">
            {selectedCourse.title}
          </Typography>          <Button            variant="outlined"
            startIcon={<AutoGraphIcon />}
            component={RouterLink}
            to={`/instructor/curriculum/${selectedCourse.id}`}
<<<<<<< HEAD
            onClick={() => {
              // Store the course details in localStorage before navigating
              localStorage.setItem('currentCourse', JSON.stringify({
                id: selectedCourse.id,
                title: selectedCourse.title,
                code: selectedCourse.code,
                description: selectedCourse.description,
                topics: selectedCourse.topics || []
              }));
            }}
=======
            state={{ courseDescription: selectedCourse.description, courseTitle: selectedCourse.title }}
>>>>>>> 47dcb750ab6d6b7f1cac7657d9e0177b3632e637
          >
            Curriculum Mapping
          </Button>
        </Box>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          {selectedCourse.code} • {selectedCourse.department} • {selectedCourse.term}
        </Typography>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<AssessmentIcon />} label="Assessments" iconPosition="start" />
          <Tab icon={<PersonAddIcon />} label="Students" iconPosition="start" />
          <Tab icon={<MenuBookIcon />} label="Course Materials" iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Assessments Tab */}
      <Box hidden={activeTab !== 0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Assessments
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleCreateAssessment}
          >
            Create Assessment
          </Button>
        </Box>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>              <TableRow>
                <TableCell>Assessment Title</TableCell>
                <TableCell>Syllabus Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Pattern</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Submissions</TableCell>
                <TableCell align="right">Avg. Score</TableCell>
                <TableCell align="right">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedCourse.assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell component="th" scope="row">
                    {assessment.title}
                  </TableCell>                  <TableCell>
                    {assessment.syllabusTitle || 'N/A'}
                  </TableCell>
                  <TableCell>{assessment.type}</TableCell>
                  <TableCell>
                    {assessment.visibility && assessment.visibility.pattern ? (
                      <Tooltip title={assessment.visibility.pattern.description || 'No description available'}>
                        <span>{assessment.visibility.pattern.name} • {assessment.visibility.pattern.difficulty}</span>
                      </Tooltip>
                    ) : assessment.pattern ? (
                      <Tooltip title={assessment.pattern.description || 'No description available'}>
                        <span>{assessment.pattern.name} • {assessment.pattern.difficulty}</span>
                      </Tooltip>
                    ) : 'Standard'}
                  </TableCell>
                  <TableCell>{new Date(assessment.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    {assessment.submissions}/{selectedCourse.enrollment}
                  </TableCell>
                  <TableCell align="right">
                    {assessment.avgScore > 0 ? `${assessment.avgScore}%` : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <Chip 
                      size="small" 
                      label={assessment.assignToAllStudents ? 'Assigned' : 'Draft'} 
                      color={assessment.assignToAllStudents ? 'success' : 'default'} 
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small" 
                      onClick={() => handleEditAssessment(assessment.id)}
                      aria-label="edit assessment"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleViewResults(assessment.id)}
                      aria-label="view results"
                      sx={{ ml: 1 }}
                    >
                      <AssessmentIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenDialog('delete-assessment', assessment)}
                      aria-label="delete assessment"
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {selectedCourse.assessments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No assessments created yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      
      {/* Students Tab */}
      <Box hidden={activeTab !== 1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Students
          </Typography>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<PersonAddIcon />}
              sx={{ mr: 2 }}
            >
              Add Students
            </Button>
            <Button 
              variant="contained" 
              component={RouterLink}
              to={`/instructor/student-results/${selectedCourse.id}`}
            >
              View Student Results
            </Button>
          </Box>
        </Box>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Average Score</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {selectedCourse.students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell component="th" scope="row">
                    {student.name}
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell align="right">
                    <Chip 
                      label={`${student.avgScore}%`} 
                      color={
                        student.avgScore >= 90 ? 'success' :
                        student.avgScore >= 70 ? 'primary' :
                        student.avgScore >= 60 ? 'warning' : 'error'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenDialog('remove-student', student)}
                      aria-label="remove student"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {selectedCourse.students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    No students enrolled yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      
      {/* Course Materials Tab */}
      <Box hidden={activeTab !== 2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Course Materials
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
          >
            Add Material
          </Button>
        </Box>
        
        <List>
          {selectedCourse.materials.map((material) => (
            <React.Fragment key={material.id}>
              <ListItem
                secondaryAction={
                  <Box>
                    <IconButton 
                      edge="end" 
                      aria-label="edit material"
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete material"
                      onClick={() => handleOpenDialog('delete-material', material)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={material.title}
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
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
          {selectedCourse.materials.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No course materials added yet."
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
      </Box>
      
      {/* Dialogs */}
      <Dialog
        open={openDialog && dialogAction === 'delete-assessment'}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Delete Assessment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the assessment "{dialogItem?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmDialog} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog
        open={openDialog && dialogAction === 'delete-material'}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Delete Course Material</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the material "{dialogItem?.title}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmDialog} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog
        open={openDialog && dialogAction === 'remove-student'}
        onClose={handleCloseDialog}
      >
        <DialogTitle>Remove Student</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove {dialogItem?.name} from this course?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfirmDialog} color="error">Remove</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CourseManagement;