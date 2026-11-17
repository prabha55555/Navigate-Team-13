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
    Tooltip,
    Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
    deleteAssessment,
    deleteCourse,
    loadInstructorCourses,
    saveCourse
} from './instructorData';
import { useNotify } from '../../contexts/NotificationContext';

const EMPTY_COURSE_FORM = {
  title: '',
  code: '',
  department: 'Computer Science',
  term: 'Fall 2025',
  description: ''
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const CourseManagement = () => {
  const notify = useNotify();
  const { courseId } = useParams();
  const navigate = useNavigate();
  // Course data lives in localStorage (no courses API), so load it synchronously
  const [courses, setCourses] = useState(() => loadInstructorCourses());
  const [selectedCourse, setSelectedCourse] = useState(() =>
    (courseId ? courses.find(c => c.id === courseId) || null : null)
  );
  const [activeTab, setActiveTab] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState('');
  const [dialogItem, setDialogItem] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openCourseFormDialog, setOpenCourseFormDialog] = useState(false);
  const [newCourseData, setNewCourseData] = useState(EMPTY_COURSE_FORM);

  // Function to handle back to courses navigation
  const handleBackToCourses = () => {
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
    setNewCourseData(EMPTY_COURSE_FORM);
  };

  // Handle course form change
  const handleCourseFormChange = (e) => {
    const { name, value } = e.target;
    setNewCourseData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle course form submit
  const handleCourseFormSubmit = () => {
    // Validate form data
    if (!newCourseData.title.trim() || !newCourseData.code.trim()) {
      notify('Please fill in all required fields.', 'warning');
      return;
    }

    // Create a new course with form data
    const newCourse = {
      id: `new-${Date.now()}`, // Generate a unique ID
      title: newCourseData.title.trim(),
      code: newCourseData.code.trim(),
      department: newCourseData.department,
      term: newCourseData.term,
      enrollment: 0,
      assessmentCount: 0,
      description: newCourseData.description,
      students: [],
      assessments: [],
      materials: []
    };
    
    // Save courses to localStorage to persist between page refreshes
    saveCourse(newCourse);
    setCourses(prev => [...prev, newCourse]);
    
    // Close the dialog
    handleCourseFormClose();
    
    // Navigate to the new course (the effect below selects it)
    navigate(`/instructor/courses/${newCourse.id}`);
  };
  
  // Load courses / sync the selected course with the URL.
  // The route element stays mounted between /instructor/courses/:id and
  // /instructor/courses, so the selection must also be cleared here.
  useEffect(() => {
    const allCourses = loadInstructorCourses();
    setCourses(allCourses);
    setSelectedCourse(courseId ? allCourses.find(c => c.id === courseId) || null : null);
    setActiveTab(0);
    setAnchorEl(null);
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
    handleCourseFormOpen();
  };
  
  // Handle menu open
  const handleMenuOpen = (event, course) => {
    setAnchorEl({ element: event.currentTarget, course: course });
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

  // Apply a change to the selected course and keep the course list in sync
  const updateSelectedCourse = (updater) => {
    if (!selectedCourse) return;
    const updated = updater(selectedCourse);
    setSelectedCourse(updated);
    setCourses(prevCourses => prevCourses.map(c => (c.id === updated.id ? updated : c)));
  };
  
  // Handle dialog confirm
  const handleConfirmDialog = () => {
    if (!dialogItem) {
      handleCloseDialog();
      return;
    }
    // Handle different actions based on dialogAction
    switch (dialogAction) {
      case 'delete-course': {
        // Remove course (and its saved assessments) from local state and storage
        deleteCourse(dialogItem.id);
        setCourses(prevCourses => prevCourses.filter(course => course.id !== dialogItem.id));
        setSelectedCourse(null);
        
        // Navigate back to course list
        navigate('/instructor/courses');
        break;
      }
      case 'delete-assessment':
        deleteAssessment(dialogItem.id);
        // Remove assessment from course
        updateSelectedCourse(prevCourse => ({
          ...prevCourse,
          assessments: prevCourse.assessments.filter(a => a.id !== dialogItem.id),
          assessmentCount: Math.max(0, (prevCourse.assessmentCount || 0) - 1)
        }));
        break;
      case 'delete-material':
        // Remove material from course
        updateSelectedCourse(prevCourse => ({
          ...prevCourse,
          materials: prevCourse.materials.filter(m => m.id !== dialogItem.id)
        }));
        break;
      case 'remove-student':
        // Remove student from course
        updateSelectedCourse(prevCourse => ({
          ...prevCourse,
          students: prevCourse.students.filter(s => s.id !== dialogItem.id),
          enrollment: Math.max(0, (prevCourse.enrollment || 0) - 1)
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
    navigate(`/instructor/student-results/${selectedCourse.id}?assessment=${encodeURIComponent(assessmentId)}`);
  };
  
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
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
          {courses.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 6 }}>
                No courses yet. Click "Create New Course" to add one.
              </Typography>
            </Grid>
          )}
        </Grid>

        {/* One shared options menu (previously one open Menu was rendered per course card) */}
        <Menu
          anchorEl={anchorEl?.element}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleOpenDialog('delete-course', anchorEl?.course)}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Course
          </MenuItem>
        </Menu>

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
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AutoGraphIcon />}
            component={RouterLink}
            to={`/instructor/curriculum/${selectedCourse.id}`}
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
            <TableHead>
              <TableRow>
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
                  </TableCell>
                  <TableCell>
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
                  <TableCell>{formatDate(assessment.dueDate)}</TableCell>
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
                  <TableCell colSpan={9} align="center">
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