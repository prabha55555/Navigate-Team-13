import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { listAssessments } from '../../api/assessments';
import { listCourses } from '../../api/courses';
import { createQuestion, deleteQuestion, importToAssessment, listQuestions, updateQuestion } from '../../api/questionBank';
import { EmptyState, PageHeader } from '../../components/common';
import ConfirmDialog from '../../components/staff/ConfirmDialog';
import QuestionEditor from '../../components/staff/QuestionEditor';
import { ErrorState, MobileList, MobileRow, TableSkeleton, ToneChip, useIsMobile } from '../../components/staff/StaffUI';
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  answerKeyText,
  blankQuestion,
  normalizeQuestion,
  pluralize,
  questionIssues,
  questionTypeLabel,
  toApiQuestion,
} from '../../components/staff/staffUtils';
import useApiData, { useDebouncedValue } from '../../components/staff/useApiData';
import usePlanError from '../../components/staff/usePlanError';
import { useNotify } from '../../contexts/NotificationContext';

const PAGE_SIZE = 20;

function QuestionDialog({ open, item, courses, topics, onClose, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const notify = useNotify();
  const handleError = usePlanError();
  const [q, setQ] = useState(blankQuestion());
  const [courseId, setCourseId] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(item ? normalizeQuestion(item, { keepId: false }) : blankQuestion());
    setCourseId(item?.course || '');
    setTags(item?.tags || []);
    setShowIssues(false);
  }, [open, item]);

  const courseTopics = useMemo(() => {
    const c = courses.find((x) => x.id === courseId);
    return [...new Set([...(c?.topics || []), ...topics])];
  }, [courses, courseId, topics]);

  const save = async () => {
    setShowIssues(true);
    if (questionIssues(q).errors.length) return;
    setSaving(true);
    const { id, ...body } = toApiQuestion(q); // eslint-disable-line no-unused-vars
    const payload = { ...body, courseId: courseId || null, tags };
    try {
      const saved = item ? await updateQuestion(item.id, payload) : await createQuestion(payload);
      notify(item ? 'Question updated' : 'Question added to the bank', 'success');
      onSaved(saved);
    } catch (err) {
      handleError(err, 'Could not save the question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullScreen={fullScreen} maxWidth="md" fullWidth aria-labelledby="qb-dialog-title">
      <DialogTitle id="qb-dialog-title">{item ? 'Edit question' : 'New question'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 2.5 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <FormControl size="small">
            <InputLabel id="qb-course">Course</InputLabel>
            <Select labelId="qb-course" label="Course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <MenuItem value="">Whole workspace (shared)</MenuItem>
              {courses.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code ? `${c.code} — ` : ''}
                  {c.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={[]}
            value={tags}
            onChange={(_, v) => setTags([...new Set(v.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 20))}
            renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)}
            renderInput={(params) => <TextField {...params} label="Tags" placeholder={tags.length ? '' : 'Type and press Enter'} />}
          />
        </Box>
        <QuestionEditor value={q} onChange={setQ} topics={courseTopics} showIssues={showIssues} autoFocus={!item} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
          {item ? 'Save changes' : 'Add to bank'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AddToAssessmentDialog({ open, items, onClose }) {
  const notify = useNotify();
  const handleError = usePlanError();
  const [busy, setBusy] = useState(null);
  const drafts = useApiData(() => listAssessments({ status: 'draft', pageSize: 100 }), [], { enabled: open });
  const list = drafts.data?.items || [];

  const add = async (a) => {
    setBusy(a.id);
    try {
      const res = await importToAssessment(a.id, items.map((i) => i.id));
      notify(`Added ${pluralize(res.added ?? items.length, 'question')} to “${a.title}”`, 'success');
      onClose(true);
    } catch (err) {
      handleError(err, 'Could not add to the assessment');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose(false)} maxWidth="sm" fullWidth aria-labelledby="add-to-title">
      <DialogTitle id="add-to-title">Add {pluralize(items.length, 'question')} to an assessment</DialogTitle>
      <DialogContent dividers sx={{ px: 1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 1.5, mb: 1 }}>
          Questions are copied to the end of a draft assessment. Published assessments can’t take new questions once students start.
        </Typography>
        {drafts.error ? (
          <ErrorState error={drafts.error} onRetry={drafts.reload} />
        ) : drafts.loading ? (
          <Box sx={{ px: 1.5 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={52} />
            ))}
          </Box>
        ) : !list.length ? (
          <EmptyState
            compact
            title="No draft assessments"
            description="Create a new assessment first, then import these questions from its editor."
            action={
              <Button component={RouterLink} to="/app/assessments/new" variant="contained">
                New assessment
              </Button>
            }
          />
        ) : (
          <List>
            {list.map((a) => (
              <ListItemButton key={a.id} onClick={() => add(a)} disabled={!!busy} sx={{ borderRadius: 2 }}>
                <ListItemText
                  primary={a.title}
                  secondary={`${a.courseTitle} · ${pluralize(a.questionCount || 0, 'question')}`}
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                {busy === a.id && <CircularProgress size={18} />}
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={() => onClose(false)} disabled={!!busy}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function QuestionBank() {
  const notify = useNotify();
  const handleError = usePlanError();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ courseId: '', topic: '', type: '', difficulty: '', tag: '' });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]);
  const [dialog, setDialog] = useState({ open: false, item: null });
  const [deleting, setDeleting] = useState(null);
  const [addTo, setAddTo] = useState(null);
  const q = useDebouncedValue(search.trim(), 300);
  const isMobile = useIsMobile();
  const tag = useDebouncedValue(filters.tag.trim().toLowerCase(), 300);

  const courses = useApiData(() => listCourses({ pageSize: 100 }), []);
  const { data, error, loading, reload } = useApiData(
    () =>
      listQuestions({
        q: q || undefined,
        courseId: filters.courseId || undefined,
        topic: filters.topic || undefined,
        type: filters.type || undefined,
        difficulty: filters.difficulty || undefined,
        tag: tag || undefined,
        page: page + 1,
        pageSize: PAGE_SIZE,
      }),
    [q, filters.courseId, filters.topic, filters.type, filters.difficulty, tag, page]
  );
  useEffect(() => setPage(0), [q, filters.courseId, filters.topic, filters.type, filters.difficulty, tag]);

  const items = data?.items || [];
  const courseList = courses.data?.items || [];
  const courseName = (id) => courseList.find((c) => c.id === id)?.code || courseList.find((c) => c.id === id)?.title || 'Course';
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const filtered = !!(q || filters.courseId || filters.topic || filters.type || filters.difficulty || tag);
  const isSel = (id) => selected.some((s) => s.id === id);
  const toggle = (item) => setSelected((list) => (isSel(item.id) ? list.filter((s) => s.id !== item.id) : [...list, item]));

  const remove = async () => {
    try {
      await deleteQuestion(deleting.id);
      notify('Question deleted', 'success');
      setSelected((list) => list.filter((s) => s.id !== deleting.id));
      setDeleting(null);
      reload({ silent: true });
    } catch (err) {
      handleError(err, 'Could not delete the question');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Question bank"
        description="Reusable questions for every course. Save questions from any assessment, or write them here."
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({ open: true, item: null })}>
            New question
          </Button>
        }
      >
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: '2fr repeat(5, 1fr)' } }}>
          <TextField
            size="small"
            placeholder="Search question text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ 'aria-label': 'Search questions' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
          />
          <FormControl size="small">
            <InputLabel id="qb-f-course">Course</InputLabel>
            <Select labelId="qb-f-course" label="Course" value={filters.courseId} onChange={setFilter('courseId')}>
              <MenuItem value="">All courses</MenuItem>
              {courseList.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code || c.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="qb-f-topic">Topic</InputLabel>
            <Select labelId="qb-f-topic" label="Topic" value={filters.topic} onChange={setFilter('topic')}>
              <MenuItem value="">All topics</MenuItem>
              {(data?.topics || []).map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="qb-f-type">Type</InputLabel>
            <Select labelId="qb-f-type" label="Type" value={filters.type} onChange={setFilter('type')}>
              <MenuItem value="">All types</MenuItem>
              {QUESTION_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="qb-f-diff">Difficulty</InputLabel>
            <Select labelId="qb-f-diff" label="Difficulty" value={filters.difficulty} onChange={setFilter('difficulty')}>
              <MenuItem value="">Any</MenuItem>
              {DIFFICULTIES.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="Tag" value={filters.tag} onChange={setFilter('tag')} />
        </Box>
      </PageHeader>

      {selected.length > 0 && (
        <Paper elevation={4} sx={{ position: 'sticky', top: 72, zIndex: 4, p: 1.5, borderRadius: 3, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mr: 'auto' }}>
            {selected.length} selected
          </Typography>
          <Button variant="contained" size="small" startIcon={<LibraryAddOutlinedIcon />} onClick={() => setAddTo(selected)}>
            Add to assessment
          </Button>
          <Button size="small" color="inherit" onClick={() => setSelected([])}>
            Clear
          </Button>
        </Paper>
      )}

      {error ? (
        <ErrorState error={error} onRetry={reload} title="We couldn’t load the question bank" />
      ) : loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <TableSkeleton rows={8} columns={6} />
        </Paper>
      ) : !items.length ? (
        filtered ? (
          <EmptyState
            icon={<SearchRoundedIcon />}
            title="No matching questions"
            description="Try a different search or clear the filters."
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  setFilters({ courseId: '', topic: '', type: '', difficulty: '', tag: '' });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<LibraryBooksOutlinedIcon />}
            title="Build your question bank"
            description="Good questions are worth reusing. Add them here, or use “Save to question bank” on any question in the assessment editor."
            action={
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({ open: true, item: null })}>
                New question
              </Button>
            }
          />
        )
      ) : isMobile ? (
        <Box>
          <MobileList label="Question bank">
            {items.map((item) => (
              <MobileRow
                key={item.id}
                selected={isSel(item.id)}
                title={item.text}
                subtitle={`Answer: ${answerKeyText(item)}`}
                leading={<Checkbox checked={isSel(item.id)} onChange={() => toggle(item)} inputProps={{ 'aria-label': 'Select question' }} sx={{ m: -1, mr: 0 }} />}
                chips={
                  <>
                    <ToneChip label={questionTypeLabel(item.type)} />
                    {item.topic && <ToneChip label={item.topic} tone="primary" />}
                    <ToneChip label={item.difficulty} tone={item.difficulty === 'Hard' ? 'error' : item.difficulty === 'Easy' ? 'success' : 'default'} />
                  </>
                }
                meta={[
                  { label: 'Points', value: item.points },
                  { label: 'Course', value: item.course ? courseName(item.course) : 'Shared' },
                ]}
                action={
                  <Box sx={{ display: 'flex' }}>
                    <IconButton size="small" aria-label="Add to assessment" onClick={() => setAddTo([item])}>
                      <LibraryAddOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Edit question" onClick={() => setDialog({ open: true, item })}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete question" onClick={() => setDeleting(item)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            ))}
          </MobileList>
          <TablePagination
            component="div"
            count={data?.total || 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 900 }} aria-label="Question bank">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={items.every((i) => isSel(i.id))}
                      indeterminate={items.some((i) => isSel(i.id)) && !items.every((i) => isSel(i.id))}
                      onChange={(e) =>
                        setSelected((list) =>
                          e.target.checked ? [...list, ...items.filter((i) => !list.some((s) => s.id === i.id))] : list.filter((s) => !items.some((i) => i.id === s.id))
                        )
                      }
                      inputProps={{ 'aria-label': 'Select all on this page' }}
                    />
                  </TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Topic</TableCell>
                  <TableCell>Difficulty</TableCell>
                  <TableCell align="right">Points</TableCell>
                  <TableCell>Course</TableCell>
                  <TableCell align="right">Used</TableCell>
                  <TableCell align="right">
                    <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      Actions
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover selected={isSel(item.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSel(item.id)} onChange={() => toggle(item)} inputProps={{ 'aria-label': 'Select question' }} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.text}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="p">
                        Answer: {answerKeyText(item)}
                      </Typography>
                      {item.tags?.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {item.tags.map((t) => (
                            <Chip key={t} size="small" label={`#${t}`} variant="outlined" sx={{ height: 20, fontSize: 11 }} onClick={() => setFilters((f) => ({ ...f, tag: t }))} />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{questionTypeLabel(item.type)}</Typography>
                    </TableCell>
                    <TableCell>{item.topic ? <ToneChip label={item.topic} tone="primary" /> : '—'}</TableCell>
                    <TableCell>
                      <ToneChip label={item.difficulty} tone={item.difficulty === 'Hard' ? 'error' : item.difficulty === 'Easy' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">{item.points}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: item.course ? 'text.primary' : 'text.secondary' }}>
                        {item.course ? courseName(item.course) : 'Shared'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{item.usageCount || 0}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Add to assessment">
                        <IconButton size="small" aria-label="Add to assessment" onClick={() => setAddTo([item])}>
                          <LibraryAddOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit question" onClick={() => setDialog({ open: true, item })}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" aria-label="Delete question" onClick={() => setDeleting(item)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.total || 0}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        </Paper>
      )}

      <QuestionDialog
        open={dialog.open}
        item={dialog.item}
        courses={courseList}
        topics={data?.topics || []}
        onClose={() => setDialog({ open: false, item: null })}
        onSaved={() => {
          setDialog({ open: false, item: null });
          reload({ silent: true });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete this question?"
        description="It is removed from the bank. Assessments that already use a copy of it are not affected."
        confirmLabel="Delete"
        tone="error"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
      <AddToAssessmentDialog
        open={!!addTo}
        items={addTo || []}
        onClose={(done) => {
          setAddTo(null);
          if (done) {
            setSelected([]);
            reload({ silent: true });
          }
        }}
      />
    </Box>
  );
}
