import {
    ArrowBack as ArrowBackIcon,
    Assessment as AssessmentIcon,
    Description as DescriptionIcon,
    ManageSearch as ManageSearchIcon,
    Person as PersonIcon,
    PsychologyAlt as PsychologyAltIcon,
    TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button, Card, CardContent,
    Chip, CircularProgress,
    Container,
    Divider,
    Grid,
    List, ListItem, ListItemIcon, ListItemText,
    MenuItem,
    Paper,
    Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
    TableSortLabel,
    Tabs,
    TextField,
    Typography
} from '@mui/material';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { findInstructorAssessment, loadInstructorCourses } from './instructorData';

// Mock data moved to a separate constant at the bottom for clarity

const PASS_THRESHOLD = 50;

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`student-results-tabpanel-${index}`}
      aria-labelledby={`student-results-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const percentOf = (score, maxScore) => (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0);

// GET /api/student/assessment/submissions/:courseId -> row shape used by this page
const toResultRow = (submission) => {
  const score = Number(submission.score) || 0;
  const maxScore = Number(submission.maxScore) || 0;
  const percentage = submission.percentage != null && Number.isFinite(Number(submission.percentage))
    ? Number(submission.percentage)
    : percentOf(score, maxScore);
  // The student flow (AssessmentTake) sends timeSpent in seconds
  const seconds = Number(submission.timeSpent ?? submission.timeTaken) || 0;
  return {
    id: submission.id || submission.submissionId,
    name: submission.studentName || submission.name || 'Unknown Student',
    email: submission.email || '',
    studentId: String(submission.studentId || ''),
    assessmentId: submission.assessmentId != null ? String(submission.assessmentId) : '',
    assessmentTitle: submission.assessmentTitle || 'Assessment',
    courseId: submission.courseId,
    score,
    maxScore,
    percentage,
    isPassed: typeof submission.isPassed === 'boolean' ? submission.isPassed : percentage >= PASS_THRESHOLD,
    submissionDate: submission.submissionDate || submission.submittedAt,
    status: submission.status || 'completed',
    timeSpent: seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0
  };
};

const round1 = (value) => Math.round(value * 10) / 10;

const computeStatistics = (rows) => {
  if (!rows.length) return null;
  const percentages = rows.map(r => r.percentage).sort((a, b) => a - b);
  const count = percentages.length;
  const average = percentages.reduce((sum, p) => sum + p, 0) / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? percentages[middle] : (percentages[middle - 1] + percentages[middle]) / 2;
  const variance = percentages.reduce((sum, p) => sum + (p - average) ** 2, 0) / count;
  return {
    totalSubmissions: count,
    averageScore: round1(average),
    medianScore: round1(median),
    highestScore: percentages[count - 1],
    lowestScore: percentages[0],
    standardDeviation: round1(Math.sqrt(variance)),
    passRate: Math.round((rows.filter(r => r.isPassed).length / count) * 100)
  };
};

const assessmentKey = (row) => row.assessmentId || row.assessmentTitle;

const StudentResults = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('score');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [tabValue, setTabValue] = useState(0);

  // ?assessment=<id> (from Course Management) pre-selects the assessment filter
  useEffect(() => {
    const assessmentParam = new URLSearchParams(location.search).get('assessment');
    setSelectedAssessment(assessmentParam || 'all');
    setPage(0);
  }, [location.search]);

  // Fetch submissions for the course (or for every instructor course when no course is given).
  // GET /api/student/assessment/submissions/:courseId returns what students submitted via
  // /api/student/assessment/submit (the old /api/instructor/course/... URL does not exist).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUsingSampleData(false);
    setSelectedStudentId(null);
    setStudentDetail(null);
    setTabValue(0);
    setPage(0);

    const courseIds = courseId ? [courseId] : loadInstructorCourses().map(c => c.id);

    Promise.allSettled(courseIds.map(id =>
      axios.get(`/api/student/assessment/submissions/${encodeURIComponent(id)}`, { timeout: 30000 })
    )).then(outcomes => {
      if (cancelled) return;
      const succeeded = outcomes.filter(o => o.status === 'fulfilled' && o.value.data?.success);

      if (courseIds.length > 0 && succeeded.length === 0) {
        const firstError = outcomes.find(o => o.status === 'rejected');
        console.error('Error fetching student results:', firstError ? firstError.reason : 'invalid response');
        // Use mock data as fallback so the page is still usable offline
        setResults(mockStudentResults);
        setUsingSampleData(true);
        return;
      }

      const seen = new Set();
      const rows = [];
      succeeded.forEach(o => {
        (Array.isArray(o.value.data.submissions) ? o.value.data.submissions : []).forEach(sub => {
          const row = toResultRow(sub);
          if (row.id && !seen.has(row.id)) {
            seen.add(row.id);
            rows.push(row);
          }
        });
      });
      setResults(rows);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const statistics = useMemo(() => computeStatistics(results), [results]);

  // Assessments available in the filter (from results, plus the one requested in the URL)
  const assessmentOptions = useMemo(() => {
    const options = new Map();
    results.forEach(row => {
      const key = assessmentKey(row);
      if (!options.has(key)) options.set(key, row.assessmentTitle);
    });
    if (selectedAssessment !== 'all' && !options.has(selectedAssessment)) {
      const { assessment } = findInstructorAssessment(selectedAssessment);
      options.set(selectedAssessment, assessment?.title || selectedAssessment);
    }
    return [...options.entries()].map(([value, label]) => ({ value, label }));
  }, [results, selectedAssessment]);

  // Title of the selected assessment, so a local assessment id also matches
  // backend submissions (the backend assigns its own assessment ids on save)
  const selectedAssessmentTitle = useMemo(() => {
    if (selectedAssessment === 'all') return null;
    return assessmentOptions.find(o => o.value === selectedAssessment)?.label || null;
  }, [assessmentOptions, selectedAssessment]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (type, value) => {
    if (type === 'assessment') {
      setSelectedAssessment(value);
    } else if (type === 'status') {
      setSelectedStatus(value);
    }
    setPage(0);
  };

  const handleStudentSelect = (studentId) => {
    setSelectedStudentId(studentId);
    // Always use the actual results array for student details
    const student = results.find(s => s.id === studentId);
    if (student) {
      setStudentDetail(student);
    } else {
      setStudentDetail(null);
    }
  };

  // Filter + sort only when the inputs change (not on every render)
  const sortedResults = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return results
      .filter(result => {
        // Apply assessment filter
        if (selectedAssessment !== 'all' &&
            result.assessmentId !== selectedAssessment &&
            result.assessmentTitle !== selectedAssessment &&
            result.assessmentTitle !== selectedAssessmentTitle) {
          return false;
        }

        // Apply status (pass/fail) filter
        if (selectedStatus === 'passed' && !result.isPassed) return false;
        if (selectedStatus === 'failed' && result.isPassed) return false;

        // Apply search filter
        if (searchLower) {
          return (
            (result.name || '').toLowerCase().includes(searchLower) ||
            (result.email || '').toLowerCase().includes(searchLower) ||
            (result.studentId || '').toLowerCase().includes(searchLower)
          );
        }

        return true;
      })
      .sort((a, b) => {
        // Apply sorting
        if (orderBy === 'submissionDate') {
          return order === 'asc'
            ? new Date(a.submissionDate) - new Date(b.submissionDate)
            : new Date(b.submissionDate) - new Date(a.submissionDate);
        }

        const aValue = a[orderBy];
        const bValue = b[orderBy];

        if (typeof aValue === 'string') {
          return order === 'asc'
            ? aValue.localeCompare(bValue || '')
            : (bValue || '').localeCompare(aValue);
        }

        return order === 'asc' ? aValue - bValue : bValue - aValue;
      });
  }, [results, searchTerm, selectedAssessment, selectedAssessmentTitle, selectedStatus, order, orderBy]);

  const filteredResults = sortedResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(courseId ? `/instructor/courses/${courseId}` : '/instructor/courses')}
          variant="outlined"
          sx={{ mb: 2 }}
        >
          {courseId ? 'Back to Course' : 'Back to Courses'}
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Student Assessment Results
        </Typography>
        {/* Removed upcoming assessments section for instructor view */}
        {usingSampleData && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Could not load submissions from the server. Showing sample data.
          </Alert>
        )}
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab icon={<AssessmentIcon />} label="Assessment Results" iconPosition="start" />
          <Tab icon={<PersonIcon />} label="Student Performance" iconPosition="start" disabled={!selectedStudentId} />
          <Tab icon={<PsychologyAltIcon />} label="AI Evaluation" iconPosition="start" disabled={!selectedStudentId} />
          <Tab icon={<ManageSearchIcon />} label="Integrity Check" iconPosition="start" disabled={!selectedStudentId} />
          <Tab icon={<TrendingUpIcon />} label="Statistics" iconPosition="start" />
          <Tab icon={<DescriptionIcon />} label="Question Analysis" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Assessment Results Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper 
              elevation={3} 
              sx={{ p: 3, borderRadius: 2 }}
            >
              {/* Filters and Search */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <TextField
                  size="small"
                  label="Search students"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  sx={{ minWidth: 220, flex: 1 }}
                />
                <TextField
                  select
                  size="small"
                  label="Assessment"
                  value={selectedAssessment}
                  onChange={(e) => handleFilterChange('assessment', e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="all">All assessments</MenuItem>
                  {assessmentOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Result"
                  value={selectedStatus}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="passed">Passed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </TextField>
              </Box>
              <TableContainer sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Assessment</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} sortDirection={orderBy === 'submissionDate' ? order : false}>
                        <TableSortLabel
                          active={orderBy === 'submissionDate'}
                          direction={orderBy === 'submissionDate' ? order : 'desc'}
                          onClick={() => handleRequestSort('submissionDate')}
                        >
                          Submission Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }} sortDirection={orderBy === 'percentage' ? order : false}>
                        <TableSortLabel
                          active={orderBy === 'percentage'}
                          direction={orderBy === 'percentage' ? order : 'desc'}
                          onClick={() => handleRequestSort('percentage')}
                        >
                          Score
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Time Spent</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredResults.map((result) => (
                      <TableRow
                        key={result.id}
                        hover
                        selected={result.id === selectedStudentId}
                        onClick={() => handleStudentSelect(result.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {result.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {result.email || (/^[a-f0-9]{24}$/i.test(result.studentId) ? '' : result.studentId)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{result.assessmentTitle}</TableCell>
                        <TableCell>
                          {result.submissionDate && !Number.isNaN(new Date(result.submissionDate).getTime())
                            ? new Date(result.submissionDate).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <Chip
                              label={`${result.score}/${result.maxScore} (${result.percentage}%)`}
                              color={
                                result.percentage >= 90 ? 'success' :
                                result.percentage >= 70 ? 'primary' :
                                result.percentage >= 60 ? 'warning' : 'error'
                              }
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            <Chip 
                              label="Completed" 
                              color="info"
                              size="small"
                            />
                            <Chip
                              label={result.isPassed ? 'Passed' : 'Failed'}
                              color={result.isPassed ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {result.timeSpent ? `${result.timeSpent} min` : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Button 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/results/${result.id}`);
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {filteredResults.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          <Typography color="text.secondary">
                            {results.length === 0 ? 'No submissions yet' : 'No results matching your filters'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={sortedResults.length}
                page={Math.min(page, Math.max(0, Math.ceil(sortedResults.length / rowsPerPage) - 1))}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Student Performance Tab */}
      <TabPanel value={tabValue} index={1}>
        {studentDetail ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h5" gutterBottom>
                  {studentDetail.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {[studentDetail.studentId, studentDetail.email].filter(Boolean).join(' • ')}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Performance Summary
                </Typography>
                {/* Student summary card */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  <Paper elevation={1} sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Result: {(() => {
                        const percent = studentDetail.percentage || Math.round((studentDetail.score / studentDetail.maxScore) * 100);
                        const passed = studentDetail.isPassed !== undefined
                          ? studentDetail.isPassed
                          : percent >= 50;
                        return passed ? 'Passed' : 'Failed';
                      })()}
                    </Typography>
                    <Typography variant="body2">
                      Score: {studentDetail.score} / {studentDetail.maxScore} ({studentDetail.percentage || Math.round((studentDetail.score / studentDetail.maxScore) * 100)}%)
                    </Typography>
                  </Paper>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            Select a student from the results tab to view detailed performance
          </Alert>
        )}
      </TabPanel>
      
      {/* AI Evaluation Tab */}
      <TabPanel value={tabValue} index={2}>
        {studentDetail ? (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <PsychologyAltIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
              <Typography variant="h5">
                AI-Powered Evaluation Report
              </Typography>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                This student's submission was automatically evaluated using multiple AI-based techniques including LLM-based scoring, semantic analysis, and expert panel evaluation.
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Expert Panel Evaluation
                    </Typography>
                    <Typography variant="body2" paragraph>
                      The AI Expert Panel evaluated this submission using multiple specialized perspectives.
                    </Typography>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Fact Checker
                      </Typography>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          The student demonstrated good factual knowledge with only minor inaccuracies.
                        </Typography>
                      </Alert>
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Concept Analyzer
                      </Typography>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          Good conceptual understanding with some gaps in advanced topics.
                        </Typography>
                      </Alert>
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Clarity Checker
                      </Typography>
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                          Clear and well-organized responses with logical structure.
                        </Typography>
                      </Alert>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Learning Gaps Analysis
                    </Typography>
                    
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUpIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Binary Search Tree Traversal" 
                          secondary="The student lacks comprehensive understanding of BST traversal algorithms"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUpIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Algorithm Complexity Analysis" 
                          secondary="There's a gap in understanding time complexity for non-standard operations"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUpIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Implementation Details" 
                          secondary="Responses lack implementation-specific details of data structures"
                        />
                      </ListItem>
                    </List>
                    
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recommended Interventions
                      </Typography>
                      <List dense>
                        <ListItem>
                          <ListItemText 
                            primary="Share additional resources on tree traversal algorithms" 
                            secondary="Focus on level-order traversal which was specifically missed"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText 
                            primary="Assign practical exercises" 
                            secondary="Hands-on implementation of various data structures"
                          />
                        </ListItem>
                      </List>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Question-by-Question Analysis
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Question</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Evaluation Method</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>Key Findings</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Q1: Data Structure LIFO Principle</TableCell>
                            <TableCell>Multiple Choice</TableCell>
                            <TableCell>Exact Match</TableCell>
                            <TableCell>5/5 pts</TableCell>
                            <TableCell>Correct answer provided</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q2: Binary Search Time Complexity</TableCell>
                            <TableCell>Multiple Choice</TableCell>
                            <TableCell>Exact Match</TableCell>
                            <TableCell>5/5 pts</TableCell>
                            <TableCell>Correct answer provided</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q3: Stack vs. Queue Explanation</TableCell>
                            <TableCell>Short Answer</TableCell>
                            <TableCell>AI Expert Panel</TableCell>
                            <TableCell>8/10 pts</TableCell>
                            <TableCell>Good explanation but lacks implementation details</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q4: BST Operations</TableCell>
                            <TableCell>Multiple Select</TableCell>
                            <TableCell>Partial Match</TableCell>
                            <TableCell>7/10 pts</TableCell>
                            <TableCell>Missed "Level order traversal" option</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        ) : (
          <Alert severity="info">
            Select a student from the results tab to view AI evaluation details
          </Alert>
        )}
      </TabPanel>
      
      {/* Integrity Check Tab */}
      <TabPanel value={tabValue} index={3}>
        {studentDetail ? (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <ManageSearchIcon color="primary" sx={{ fontSize: 32, mr: 2 }} />
              <Typography variant="h5">
                Submission Integrity Analysis
              </Typography>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                This submission was analyzed for potential plagiarism and AI-generated content using multiple detection methods.
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Plagiarism Detection Results
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="body1">Overall Similarity Score:</Typography>
                      <Typography variant="h5" color="success.main">12%</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                      Threshold for review: 30%
                    </Typography>
                    
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        No significant similarity to external sources or other student submissions detected.
                      </Typography>
                    </Alert>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Detection Methods Used:
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText primary="Turnitin API" secondary="Compare against academic sources" />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Cross-submission analysis" secondary="Internal comparison with other students" />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Semantic similarity" secondary="Meaning-based matching regardless of wording" />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      AI-Generated Content Detection
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="body1">AI Probability Score:</Typography>
                      <Typography variant="h5" color="success.main">5%</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                      Threshold for review: 65%
                    </Typography>
                    
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        Analysis indicates this is likely human-written content with no significant AI generation patterns.
                      </Typography>
                    </Alert>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Detection Methods Used:
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText primary="GPTZero" secondary="AI text pattern detection" />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="Linguistic variance analysis" secondary="Statistical patterns in human vs. AI writing" />
                      </ListItem>
                      <ListItem>
                        <ListItemText primary="AWS Comprehend" secondary="Machine learning-based text analysis" />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Academic Integrity Status: Passed
                  </Typography>
                  <Typography variant="body2">
                    This submission meets all academic integrity requirements with no indication of plagiarism or AI-generated content. The work appears to be the student's original effort.
                  </Typography>
                </Alert>
              </Grid>
              
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Answer-Level Integrity Analysis
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Question</TableCell>
                            <TableCell>Plagiarism Score</TableCell>
                            <TableCell>AI Generation Score</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>Q1: Data Structure LIFO Principle</TableCell>
                            <TableCell>0%</TableCell>
                            <TableCell>1%</TableCell>
                            <TableCell>
                              <Chip label="Clear" color="success" size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q2: Binary Search Time Complexity</TableCell>
                            <TableCell>5%</TableCell>
                            <TableCell>2%</TableCell>
                            <TableCell>
                              <Chip label="Clear" color="success" size="small" />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q3: Stack vs. Queue Explanation</TableCell>
                            <TableCell>18%</TableCell>
                            <TableCell>12%</TableCell>

                            <TableCell>

                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Q4: BST Operations</TableCell>
                            <TableCell>8%</TableCell>
                            <TableCell>3%</TableCell>
                            <TableCell>
                              <Chip label="Clear" color="success" size="small" />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        ) : (
          <Alert severity="info">
            Select a student from the results tab to view integrity analysis
          </Alert>
        )}
      </TabPanel>
      
      {/* Statistics Tab */}
      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Score Distribution
                </Typography>
                <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body1" color="text.secondary">
                    Score distribution chart would appear here
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assessment Statistics
                </Typography>
                {statistics ? (
                  <Box>
                    <Typography variant="body1">
                      Average Score: {statistics.averageScore}%
                    </Typography>
                    <Typography variant="body1">
                      Median Score: {statistics.medianScore}%
                    </Typography>
                    <Typography variant="body1">
                      Highest Score: {statistics.highestScore}%
                    </Typography>
                    <Typography variant="body1">
                      Lowest Score: {statistics.lowestScore}%
                    </Typography>
                    <Typography variant="body1">
                      Standard Deviation: {statistics.standardDeviation}
                    </Typography>
                    <Typography variant="body1">
                      Pass Rate: {statistics.passRate}% ({statistics.totalSubmissions} submissions)
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body1" color="text.secondary">
                    No statistics available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      {/* Question Analysis Tab */}
      <TabPanel value={tabValue} index={5}>
        <Alert severity="info" sx={{ mb: 3 }}>
          This section shows analysis of student performance on individual questions.
        </Alert>
        <Typography variant="body1" color="text.secondary" align="center">
          Question analysis interface would be shown here
        </Typography>
      </TabPanel>
    </Container>
  );
};

// Mock data (already in the row shape produced by toResultRow; timeSpent in minutes)
const mockStudentResults = [
  {
    id: '1',
    name: 'Emma Johnson',
    email: 'emma.j@example.edu',
    studentId: 'S1001',
    assessmentId: '1',
    assessmentTitle: 'Java Data Structures Assessment',
    courseCode: 'CS301',
    score: 92,
    maxScore: 100,
    percentage: 92,
    isPassed: true,
    submissionDate: '2025-10-12T14:30:00',
    status: 'Completed',
    feedbackProvided: true,
    attempts: 1,
    timeSpent: 75, // minutes
    improvement: 10
  },
  {
    id: '2',
    name: 'Liam Williams',
    email: 'l.williams@example.edu',
    studentId: 'S1002',
    assessmentId: '1',
    assessmentTitle: 'Java Data Structures Assessment',
    courseCode: 'CS301',
    score: 78,
    maxScore: 100,
    percentage: 78,
    isPassed: true,
    submissionDate: '2025-10-12T13:45:00',
    status: 'Completed',
    feedbackProvided: true,
    attempts: 1,
    timeSpent: 90, // minutes
    improvement: -5
  },
  {
    id: '3',
    name: 'Olivia Smith',
    email: 'o.smith@example.edu',
    studentId: 'S1003',
    assessmentId: '1',
    assessmentTitle: 'Java Data Structures Assessment',
    courseCode: 'CS301',
    score: 85,
    maxScore: 100,
    percentage: 85,
    isPassed: true,
    submissionDate: '2025-10-12T15:20:00',
    status: 'Completed',
    feedbackProvided: true,
    attempts: 1,
    timeSpent: 65, // minutes
    improvement: 5
  }
];

export default StudentResults;