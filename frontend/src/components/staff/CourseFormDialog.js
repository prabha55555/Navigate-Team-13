import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { createCourse, updateCourse } from '../../api/courses';
import { useNotify } from '../../contexts/NotificationContext';
import { COURSE_COLORS } from './staffUtils';
import usePlanError from './usePlanError';

const EMPTY = { title: '', code: '', term: '', color: COURSE_COLORS[0].value, description: '', topics: [] };

/** Create or edit a course. `course` given → edit mode. `onSaved(course)` after success. */
export default function CourseFormDialog({ open, course, onClose, onSaved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const notify = useNotify();
  const handleError = usePlanError();
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setFieldError(null);
    setForm(
      course
        ? {
            title: course.title || '',
            code: course.code || '',
            term: course.term || '',
            color: course.color || COURSE_COLORS[0].value,
            description: course.description || '',
            topics: course.topics || [],
          }
        : EMPTY
    );
  }, [open, course]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const titleError = touched && !form.title.trim() ? 'Give the course a title' : fieldError?.field === 'title' ? fieldError.message : '';
  const codeError = touched && !form.code.trim() ? 'Add a short course code, e.g. CS201' : fieldError?.field === 'code' ? fieldError.message : '';

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || !form.code.trim()) return;
    setSaving(true);
    setFieldError(null);
    const body = {
      title: form.title.trim(),
      code: form.code.trim(),
      term: form.term.trim(),
      color: form.color,
      description: form.description.trim(),
      topics: form.topics.map((t) => t.trim()).filter(Boolean),
    };
    try {
      const saved = course ? await updateCourse(course.id, body) : await createCourse(body);
      notify(course ? 'Course updated' : `Created “${saved.title}”`, 'success');
      onSaved?.(saved);
    } catch (err) {
      if (err.details?.field) setFieldError({ field: err.details.field, message: err.message });
      handleError(err, course ? 'Could not update the course' : 'Could not create the course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      aria-labelledby="course-form-title"
      PaperProps={{ component: 'form', onSubmit: submit, noValidate: true }}
    >
      <DialogTitle id="course-form-title">{course ? 'Edit course' : 'New course'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '8px !important' }}>
        <TextField
          label="Title"
          required
          autoFocus
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          error={!!titleError}
          helperText={titleError || ' '}
          inputProps={{ maxLength: 200 }}
        />
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mt: -1.5 }}>
          <TextField
            label="Code"
            required
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            error={!!codeError}
            helperText={codeError || ' '}
            inputProps={{ maxLength: 40 }}
          />
          <TextField
            label="Term"
            placeholder="e.g. Fall 2026"
            value={form.term}
            onChange={(e) => set({ term: e.target.value })}
            helperText=" "
            inputProps={{ maxLength: 80 }}
          />
        </Box>
        <Box sx={{ mt: -1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }} id="course-colour-label">
            Colour
          </Typography>
          <Box role="radiogroup" aria-labelledby="course-colour-label" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {COURSE_COLORS.map((c) => {
              const selected = form.color?.toLowerCase() === c.value;
              return (
                <Box
                  key={c.value}
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => set({ color: c.value })}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor: selected ? 'text.primary' : 'transparent',
                    outline: 'none',
                    bgcolor: c.value,
                    color: 'common.white',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: (t) => `inset 0 0 0 2px ${t.palette.background.paper}`,
                    '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                  }}
                >
                  {selected && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
                </Box>
              );
            })}
          </Box>
        </Box>
        <TextField
          label="Description"
          multiline
          minRows={2}
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          inputProps={{ maxLength: 5000 }}
        />
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={form.topics}
          onChange={(_, v) => set({ topics: [...new Set(v.map((t) => String(t).trim()).filter(Boolean))] })}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Topics"
              placeholder={form.topics.length ? 'Add topic' : 'Type a topic and press Enter'}
              helperText="Topics power topic-mastery analytics and students’ learning paths."
            />
          )}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {course ? 'Save changes' : 'Create course'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
