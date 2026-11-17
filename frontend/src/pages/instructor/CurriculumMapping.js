import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SaveIcon from '@mui/icons-material/Save';
import SchoolIcon from '@mui/icons-material/School';
// Import all Material UI icons that might be used for topics
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AppsIcon from '@mui/icons-material/Apps';
import BarChartIcon from '@mui/icons-material/BarChart';
import BiotechIcon from '@mui/icons-material/Biotech';
import BrushIcon from '@mui/icons-material/Brush';
import BuildIcon from '@mui/icons-material/Build';
import BusinessIcon from '@mui/icons-material/Business';
import CalculateIcon from '@mui/icons-material/Calculate';
import CampaignIcon from '@mui/icons-material/Campaign';
import CodeIcon from '@mui/icons-material/Code';
import ConstructionIcon from '@mui/icons-material/Construction';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
// EditIcon is already imported above
import FindInPageIcon from '@mui/icons-material/FindInPage';
import FunctionsIcon from '@mui/icons-material/Functions';
import GradingIcon from '@mui/icons-material/Grading';
import HistoryIcon from '@mui/icons-material/History';
import ImportContactsIcon from '@mui/icons-material/ImportContacts';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PaidIcon from '@mui/icons-material/Paid';
import PaletteIcon from '@mui/icons-material/Palette';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import TranslateIcon from '@mui/icons-material/Translate';
import WebIcon from '@mui/icons-material/Web';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemButton,
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
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Import curriculum service
import curriculumService from '../../services/curriculumService';
import {
    getInstructorCourse,
    loadCurriculumMap,
    loadInstructorCourses,
    saveCurriculumMap
} from './instructorData';
import { useNotify } from '../../contexts/NotificationContext';

// Topic icon names returned by the backend (see backend/services/curriculumService.js)
const TOPIC_ICONS = {
  AccountTree: AccountTreeIcon,
  Analytics: AnalyticsIcon,
  Apps: AppsIcon,
  BarChart: BarChartIcon,
  Biotech: BiotechIcon,
  Brush: BrushIcon,
  Build: BuildIcon,
  Business: BusinessIcon,
  Calculate: CalculateIcon,
  Campaign: CampaignIcon,
  Code: CodeIcon,
  Construction: ConstructionIcon,
  DataObject: DataObjectIcon,
  Design: DesignServicesIcon,
  DeveloperMode: DeveloperModeIcon,
  Edit: EditIcon,
  FindInPage: FindInPageIcon,
  Functions: FunctionsIcon,
  Grading: GradingIcon,
  History: HistoryIcon,
  ImportContacts: ImportContactsIcon,
  Lightbulb: LightbulbIcon,
  ManageAccounts: ManageAccountsIcon,
  MenuBook: MenuBookIcon,
  Paid: PaidIcon,
  Palette: PaletteIcon,
  Psychology: PsychologyIcon,
  School: SchoolIcon,
  Science: ScienceIcon,
  Search: SearchIcon,
  Storage: StorageIcon,
  Translate: TranslateIcon,
  Web: WebIcon
};

const DEFAULT_PROGRAM_OUTCOMES = [
  { id: '1', text: 'Apply knowledge appropriate to the discipline', mappedOutcomes: [] },
  { id: '2', text: 'Analyze problems and identify requirements appropriate to its solution', mappedOutcomes: [] },
  { id: '3', text: 'Design, implement, and evaluate solutions to meet desired needs', mappedOutcomes: [] },
  { id: '4', text: 'Use current techniques, skills, and tools necessary for professional practice', mappedOutcomes: [] }
];

// Course data from the course store (or the currentCourse hand-off from Course
// Management) merged with any curriculum map previously saved for this course.
const buildCourseState = (courseId, baseCourse, savedMap) => {
  const assessments = (baseCourse?.assessments || []).map(a => ({
    id: a.id,
    title: a.title,
    type: a.type || 'Quiz',
    totalPoints: a.totalPoints
  }));

  return {
    id: courseId,
    title: baseCourse?.title || savedMap?.title || '',
    code: baseCourse?.code || savedMap?.code || '',
    description: baseCourse?.description || savedMap?.description || '',
    topics: savedMap?.topics?.length ? savedMap.topics : (baseCourse?.topics || []),
    learningOutcomes: (savedMap?.learningOutcomes || []).map(o => ({ ...o, assessments: o.assessments || [] })),
    assessments: assessments.length ? assessments : (savedMap?.assessments || []),
    programOutcomes: (savedMap?.programOutcomes || DEFAULT_PROGRAM_OUTCOMES).map(po => ({
      ...po,
      mappedOutcomes: po.mappedOutcomes || []
    }))
  };
};

const readCurrentCourseHandOff = (courseId) => {
  try {
    const stored = JSON.parse(localStorage.getItem('currentCourse') || 'null');
    return stored && stored.id === courseId ? stored : null;
  } catch (e) {
    return null;
  }
};

// Bloom's Taxonomy Levels
const bloomLevels = [
  { value: 'Remember', color: '#e3f2fd' },
  { value: 'Understand', color: '#bbdefb' },
  { value: 'Apply', color: '#90caf9' },
  { value: 'Analyze', color: '#64b5f6' },
  { value: 'Evaluate', color: '#42a5f5' },
  { value: 'Create', color: '#2196f3' }
];

// Competency Levels
const competencyLevels = [
  { value: 'Introductory', color: '#c8e6c9' },
  { value: 'Core', color: '#81c784' },
  { value: 'Advanced', color: '#4caf50' }
];

const CurriculumMapping = () => {
  const notify = useNotify();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [course, setCourse] = useState(() => buildCourseState(courseId, null, null));
  const [courseNotFound, setCourseNotFound] = useState(false);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [editingOutcome, setEditingOutcome] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Helper function to render the correct icon based on icon name
  const renderTopicIcon = (iconName) => {
    const Icon = TOPIC_ICONS[iconName] || SchoolIcon;
    return <Icon />;
  };

  // Load course data
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setCourseNotFound(false);
    setOpenDialog(false);
    setEditingOutcome(null);

    // No course in the URL: show a course picker instead of an empty map
    if (!courseId) {
      setAvailableCourses(loadInstructorCourses());
      setLoading(false);
      return undefined;
    }

    const baseCourse = getInstructorCourse(courseId) || readCurrentCourseHandOff(courseId);
    const savedMap = loadCurriculumMap(courseId);

    if (baseCourse || savedMap) {
      setCourse(buildCourseState(courseId, baseCourse, savedMap));
      setLoading(false);
      return undefined;
    }

    // Unknown locally - fall back to the backend curriculum map (GET /api/curriculum/map/:courseId)
    setLoading(true);
    curriculumService.getCurriculumMap(courseId)
      .then(response => {
        if (cancelled) return;
        const map = response?.curriculumMap;
        if (map) {
          setCourse(buildCourseState(courseId, {
            title: map.courseTitle,
            topics: map.topics || []
          }, null));
        } else {
          setCourseNotFound(true);
        }
      })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setCourseNotFound(true);
        } else {
          console.error('Error loading course data:', err);
          setError('Failed to load course data: ' + (err.response?.data?.message || err.message));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Open edit dialog
  const handleOpenEditDialog = (outcome) => {
    setEditingOutcome({ ...outcome });
    setOpenDialog(true);
  };
  
  // Close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingOutcome(null);
  };
  
  const isExistingOutcome = Boolean(
    editingOutcome && course.learningOutcomes.some(outcome => outcome.id === editingOutcome.id)
  );

  // Save outcome changes - updates an existing outcome or appends a new one
  const handleSaveOutcome = () => {
    if (!editingOutcome) return;
    const text = (editingOutcome.text || '').trim();
    if (!text) return;
    const savedOutcome = { ...editingOutcome, text, assessments: editingOutcome.assessments || [] };

    setCourse(prevCourse => {
      const exists = prevCourse.learningOutcomes.some(outcome => outcome.id === savedOutcome.id);
      return {
        ...prevCourse,
        learningOutcomes: exists
          ? prevCourse.learningOutcomes.map(outcome => (outcome.id === savedOutcome.id ? savedOutcome : outcome))
          : [...prevCourse.learningOutcomes, savedOutcome]
      };
    });

    handleCloseDialog();
  };

  // Add a new empty outcome (it is appended by handleSaveOutcome when saved)
  const handleAddOutcome = () => {
    setEditingOutcome({
      id: `lo-${Date.now()}`,
      text: '',
      bloom: 'Apply',
      competency: 'Core',
      assessments: []
    });
    setOpenDialog(true);
  };

  // Toggle whether an assessment measures a learning outcome
  const handleToggleAssessmentMapping = (outcomeId, assessmentId) => {
    setCourse(prevCourse => ({
      ...prevCourse,
      learningOutcomes: prevCourse.learningOutcomes.map(outcome => {
        if (outcome.id !== outcomeId) return outcome;
        const mapped = outcome.assessments || [];
        return {
          ...outcome,
          assessments: mapped.includes(assessmentId)
            ? mapped.filter(id => id !== assessmentId)
            : [...mapped, assessmentId]
        };
      })
    }));
  };

  // Toggle whether a learning outcome supports a program outcome
  const handleToggleProgramMapping = (programOutcomeId, learningOutcomeId) => {
    setCourse(prevCourse => ({
      ...prevCourse,
      programOutcomes: prevCourse.programOutcomes.map(po => {
        if (po.id !== programOutcomeId) return po;
        const mapped = po.mappedOutcomes || [];
        return {
          ...po,
          mappedOutcomes: mapped.includes(learningOutcomeId)
            ? mapped.filter(id => id !== learningOutcomeId)
            : [...mapped, learningOutcomeId]
        };
      })
    }));
  };
  
  // Generate learning outcomes from course description
  const handleGenerateLearningOutcomes = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const courseTitle = course?.title || 'New Course';
      const courseDescription = course?.description || '';
      
      if (!courseDescription) {
        setError('Please provide a course description with clearly defined topics before generating learning outcomes');
        setGenerating(false);
        return;
      }
      
      // Check if user is authenticated before making the request
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to generate learning outcomes. Please log in and try again.');
        setGenerating(false);
        return;
      }
      
      // Call the service method to generate outcomes from the course description
      // (POST /api/curriculum/generate-outcomes-from-description only takes title + description)
      const result = await curriculumService.generateLearningOutcomesFromDescription(
        courseTitle,
        courseDescription
      );
      
      if (result.success && result.data?.outcomes?.length) {
        const batchId = Date.now();
        // Update the course with the AI-generated learning outcomes
        setCourse(prevCourse => {
          // Generate IDs for new outcomes
          const newOutcomes = result.data.outcomes.map((outcome, index) => ({
            id: `lo-${batchId}-${index + 1}`,
            text: outcome.text,
            bloom: outcome.bloom,
            competency: outcome.competency,
            assessments: []
          }));
          
          return {
            ...prevCourse,
            // Add new outcomes to existing ones
            learningOutcomes: [...prevCourse.learningOutcomes, ...newOutcomes]
          };
        });
      } else {
        // Display a more user-friendly error message for auth issues
        if (result.error && result.error.includes('401')) {
          setError('Authentication error: Your session may have expired. Please try logging out and back in.');
        } else {
          setError('Failed to generate learning outcomes: ' + (result.error || 'No learning outcomes were returned'));
        }
      }
    } catch (error) {
      // Handle authentication errors specifically
      if (error.response && error.response.status === 401) {
        setError('Authentication error: Your session may have expired. Please try logging out and back in.');
      } else {
        setError('Error generating learning outcomes: ' + (error.message || 'Unknown error'));
      }
      console.error('Error generating learning outcomes:', error);
    } finally {
      setGenerating(false);
    }
  };
  
  // Generate curriculum topics using AI
  const handleGenerateCurriculumTopics = async () => {
    setGeneratingTopics(true);
    setError(null);
    
    try {
      const courseTitle = course?.title || 'New Course';
      const courseDescription = course?.description || '';
      
      if (!courseTitle) {
        setError('Please provide a course title before generating topics');
        setGeneratingTopics(false);
        return;
      }
      
      // Call the service to generate curriculum map with topics
      const result = await curriculumService.generateCurriculumMap(
        courseTitle,
        courseDescription
      );
      
      if (result.success && result.data?.topics?.length) {
        // Update the course with the AI-generated topics
        setCourse(prevCourse => ({
          ...prevCourse,
          topics: result.data.topics
        }));
      } else {
        setError('Failed to generate curriculum topics: ' + (result.error || 'No topics were returned'));
      }
    } catch (error) {
      setError('Error generating curriculum topics: ' + (error.message || 'Unknown error'));
      console.error('Error generating curriculum topics:', error);
    } finally {
      setGeneratingTopics(false);
    }
  };
  
  // Save the curriculum map
  const handleSaveCurriculumMap = () => {
    try {
      // There is no backend endpoint for saving curriculum maps, so they are
      // stored per course in localStorage and reloaded when this page opens.
      saveCurriculumMap(course.id, course);

      // Also update the currentCourse in localStorage to keep data consistent
      localStorage.setItem('currentCourse', JSON.stringify({
        id: course.id,
        title: course.title,
        code: course.code,
        description: course.description,
        topics: course.topics || []
      }));

      // Show success message
      notify('Curriculum map saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving curriculum map:', error);
      setError('Failed to save curriculum map: ' + error.message);
    }
  };

  const backPath = courseId ? `/instructor/courses/${courseId}` : '/instructor/courses';

  // Render loading state
  if (loading) {
    return (
      <Container sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // No course selected (/instructor/curriculum) or unknown course id: let the instructor pick one
  if (!courseId || courseNotFound) {
    const pickerCourses = courseId ? loadInstructorCourses() : availableCourses;
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/instructor/courses')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Curriculum Mapping
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          {courseNotFound && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Course "{courseId}" was not found. Select one of your courses below.
            </Alert>
          )}
          <Typography variant="h6" component="h2" gutterBottom>
            Select a course to map
          </Typography>
          {pickerCourses.length > 0 ? (
            <List>
              {pickerCourses.map(c => (
                <ListItem key={c.id} disablePadding divider>
                  <ListItemButton onClick={() => navigate(`/instructor/curriculum/${c.id}`)}>
                    <ListItemText primary={c.title} secondary={[c.code, c.term].filter(Boolean).join(' • ')} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No courses yet. Create a course in Course Management first.
            </Typography>
          )}
        </Paper>
      </Container>
    );
  }

  // Render main content
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header section */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate(backPath)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Curriculum Mapping
          </Typography>
        </Box>

        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveCurriculumMap}
        >
          Save Curriculum Map
        </Button>
      </Box>
      
      {/* Course info */}
      <Paper sx={{ p: 3, mb: 4 }}>
        {/* Show error alert if there's an error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                {course.title}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                {course.code}
              </Typography>
              <Typography variant="body1">
                {course.description}
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Course Topics
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={generatingTopics ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                onClick={handleGenerateCurriculumTopics}
                disabled={generatingTopics}
              >
                {generatingTopics ? 'Generating...' : 'Generate Topics'}
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(course.topics || []).map((topic, index) => {
                const name = typeof topic === 'string' ? topic : topic?.name;
                if (!name) return null;
                return (
                  <Chip
                    key={`${name}-${index}`}
                    icon={renderTopicIcon(typeof topic === 'string' ? null : topic.icon)}
                    label={name}
                    variant="outlined"
                  />
                );
              })}
              {(!course.topics || course.topics.length === 0) && (
                <Typography variant="body2" color="text.secondary">
                  No topics yet.
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Main tabs */}
      <Paper sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<SchoolIcon />} label="Learning Outcomes" />
          <Tab icon={<AssessmentIcon />} label="Assessment Mapping" />
          <Tab icon={<AutoGraphIcon />} label="Program Outcomes" />
        </Tabs>
        
        {/* Learning Outcomes Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" component="h3" fontWeight="bold">
                Learning Outcomes
              </Typography>
              
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleGenerateLearningOutcomes}
                  disabled={generating}
                  sx={{ mr: 2 }}
                >
                  {generating ? 'Generating...' : 'Generate Learning Outcomes'}
                  {generating && <CircularProgress size={24} sx={{ ml: 1 }} />}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleAddOutcome}
                >
                  Add Outcome
                </Button>
              </Box>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width="60%">Learning Outcome</TableCell>
                    <TableCell align="center" width="15%">
                      <Tooltip title="Bloom's Taxonomy Level">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          Bloom's Level <HelpOutlineIcon fontSize="small" sx={{ ml: 0.5 }} />
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center" width="15%">
                      <Tooltip title="Competency Level">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          Competency <HelpOutlineIcon fontSize="small" sx={{ ml: 0.5 }} />
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center" width="10%">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {course?.learningOutcomes.map((outcome) => {
                    const bloomColor = bloomLevels.find(l => l.value === outcome.bloom)?.color || '#e0e0e0';
                    const competencyColor = competencyLevels.find(l => l.value === outcome.competency)?.color || '#e0e0e0';
                    
                    return (
                      <TableRow key={outcome.id}>
                        <TableCell>{outcome.text}</TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={outcome.bloom} 
                            sx={{ bgcolor: bloomColor, fontWeight: 'medium' }} 
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={outcome.competency} 
                            sx={{ bgcolor: competencyColor, fontWeight: 'medium' }} 
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton onClick={() => handleOpenEditDialog(outcome)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {course.learningOutcomes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No learning outcomes yet. Generate them with AI or add one manually.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        
        {/* Assessment Mapping Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" fontWeight="bold" sx={{ mb: 3 }}>
              Assessment-Outcome Mapping
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell width="30%">Assessment</TableCell>
                    {course?.learningOutcomes.map((outcome, index) => (
                      <TableCell
                        key={outcome.id}
                        align="center"
                        onMouseEnter={() => setHoveredCell(outcome.id)}
                        onMouseLeave={() => setHoveredCell(null)}
                        sx={{
                          bgcolor: hoveredCell === outcome.id ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                          minWidth: '100px',
                          p: 1
                        }}
                      >
                        <Tooltip title={outcome.text}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            LO {index + 1}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {course?.assessments.map((assessment) => (
                    <TableRow key={assessment.id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {assessment.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {assessment.type}{assessment.totalPoints != null ? ` • ${assessment.totalPoints} pts` : ''}
                        </Typography>
                      </TableCell>

                      {course?.learningOutcomes.map((outcome) => {
                        const isAssessed = (outcome.assessments || []).includes(assessment.id);
                        return (
                          <TableCell
                            key={`${assessment.id}-${outcome.id}`}
                            align="center"
                            onMouseEnter={() => setHoveredCell(outcome.id)}
                            onMouseLeave={() => setHoveredCell(null)}
                            sx={{
                              bgcolor: hoveredCell === outcome.id ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleToggleAssessmentMapping(outcome.id, assessment.id)}
                          >
                            {isAssessed && <CheckCircleIcon color="success" />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {course.assessments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={course.learningOutcomes.length + 1} align="center">
                        <Typography variant="body2" color="text.secondary">
                          This course has no assessments yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        
        {/* Program Outcomes Tab */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" component="h3" fontWeight="bold" sx={{ mb: 3 }}>
              Program Outcome Alignment
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Program Outcomes
                  </Typography>
                  
                  <List>
                    {course?.programOutcomes.map((outcome) => (
                      <ListItem key={outcome.id} divider>
                        <ListItemText
                          primary={`PO ${outcome.id}`}
                          secondary={outcome.text}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Mapping Matrix
                  </Typography>
                  
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Program Outcome</TableCell>
                          {course?.learningOutcomes.map((outcome, index) => (
                            <TableCell key={outcome.id} align="center">
                              <Tooltip title={outcome.text}>
                                <span>LO {index + 1}</span>
                              </Tooltip>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {course?.programOutcomes.map((programOutcome) => (
                          <TableRow key={programOutcome.id}>
                            <TableCell>PO {programOutcome.id}</TableCell>
                            {course?.learningOutcomes.map((learningOutcome) => {
                              const isMapped = (programOutcome.mappedOutcomes || []).includes(learningOutcome.id);
                              return (
                                <TableCell
                                  key={`${programOutcome.id}-${learningOutcome.id}`}
                                  align="center"
                                  sx={{ cursor: 'pointer' }}
                                  onClick={() => handleToggleProgramMapping(programOutcome.id, learningOutcome.id)}
                                >
                                  {isMapped && <CheckCircleIcon color="success" fontSize="small" />}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>
      
      {/* Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{isExistingOutcome ? 'Edit Learning Outcome' : 'Add Learning Outcome'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Learning Outcome"
            fullWidth
            multiline
            rows={3}
            value={editingOutcome?.text || ''}
            onChange={(e) => setEditingOutcome({...editingOutcome, text: e.target.value})}
            sx={{ mb: 3 }}
          />
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Bloom's Taxonomy Level
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {bloomLevels.map((level) => (
                  <Button
                    key={level.value}
                    variant={editingOutcome?.bloom === level.value ? "contained" : "outlined"}
                    sx={{ 
                      bgcolor: editingOutcome?.bloom === level.value ? level.color : 'transparent',
                      borderColor: level.color,
                      color: editingOutcome?.bloom === level.value ? 'rgba(0, 0, 0, 0.7)' : 'inherit',
                      '&:hover': {
                        bgcolor: editingOutcome?.bloom === level.value 
                          ? level.color 
                          : `${level.color}33`
                      }
                    }}
                    onClick={() => setEditingOutcome({...editingOutcome, bloom: level.value})}
                  >
                    {level.value}
                  </Button>
                ))}
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Competency Level
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {competencyLevels.map((level) => (
                  <Button
                    key={level.value}
                    variant={editingOutcome?.competency === level.value ? "contained" : "outlined"}
                    sx={{ 
                      bgcolor: editingOutcome?.competency === level.value ? level.color : 'transparent',
                      borderColor: level.color,
                      color: editingOutcome?.competency === level.value ? 'rgba(0, 0, 0, 0.7)' : 'inherit',
                      '&:hover': {
                        bgcolor: editingOutcome?.competency === level.value 
                          ? level.color 
                          : `${level.color}33`
                      }
                    }}
                    onClick={() => setEditingOutcome({...editingOutcome, competency: level.value})}
                  >
                    {level.value}
                  </Button>
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveOutcome}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!editingOutcome?.text?.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CurriculumMapping;

