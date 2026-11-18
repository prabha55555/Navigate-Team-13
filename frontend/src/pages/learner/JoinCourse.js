import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { Alert, Box, Button, CircularProgress, Container, Paper, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinCourse } from '../../api/courses';
import { PageHeader } from '../../components/common';
import { useNotify } from '../../contexts/NotificationContext';

const CODE_LENGTH = 6;
// Join codes use A–Z and 2–9 without the look-alikes 0/O/1/I. Accept anything alphanumeric
// while typing (so a typo shows a clear message instead of being silently dropped).
const clean = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

const describeError = (err) => {
  if (err?.status === 404) {
    return {
      title: "That code didn't work",
      body: 'Check the code with your instructor. It may be mistyped, switched off, or replaced by a new code.',
    };
  }
  if (err?.status === 403) {
    return {
      title: 'You were removed from this course',
      body: err.message || 'Ask your instructor to add you again.',
    };
  }
  if (err?.status === 400) return { title: 'Check the code', body: err.message };
  return { title: "We couldn't join the course", body: err?.message || 'Please try again.' };
};

export default function JoinCourse() {
  const theme = useTheme();
  const navigate = useNavigate();
  const notify = useNotify();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => clean(params.get('code')));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);


  const lookalikes = /[01OI]/.test(code);
  const complete = code.length === CODE_LENGTH;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { course, alreadyEnrolled } = await joinCourse(code);
      notify(alreadyEnrolled ? `You're already in ${course.title}.` : `Welcome to ${course.title}!`, 'success');
      navigate(`/app/courses/${course.id}`, { replace: true });
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  return (
    <Container maxWidth="sm">
      <PageHeader eyebrow="Courses" title="Join a course" description="Enter the 6-character code your instructor shared with you." />
      <Paper variant="outlined" component="form" onSubmit={handleSubmit} noValidate sx={{ borderRadius: 5, p: { xs: 3, sm: 5 } }}>
        <Box
          aria-hidden="true"
          sx={{ width: 56, height: 56, borderRadius: 3, display: 'grid', placeItems: 'center', mb: 3, color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) }}
        >
          <KeyRoundedIcon />
        </Box>
        <TextField
          inputRef={inputRef}
          autoFocus
          fullWidth
          label="Course code"
          value={code}
          onChange={(e) => {
            setCode(clean(e.target.value));
            if (error) setError(null);
          }}
          onPaste={(e) => {
            // Codes are often pasted with spaces or a trailing newline.
            e.preventDefault();
            setCode(clean(e.clipboardData.getData('text')));
            if (error) setError(null);
          }}
          placeholder="ABC234"
          error={Boolean(error)}
          helperText={
            lookalikes
              ? 'Codes never contain 0, O, 1 or I — check for look-alike characters.'
              : `${code.length}/${CODE_LENGTH} characters`
          }
          inputProps={{
            autoCapitalize: 'characters',
            autoComplete: 'off',
            autoCorrect: 'off',
            spellCheck: false,
            inputMode: 'text',
            'aria-describedby': error ? 'join-error' : undefined,
            style: {
              fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
              fontSize: '1.75rem',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              fontWeight: 600,
            },
          }}
          sx={{ mb: 3 }}
        />
        {error && (
          <Alert severity="error" id="join-error" sx={{ mb: 3 }}>
            <strong>{error.title}.</strong> {error.body}
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={!complete || submitting}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {submitting ? 'Joining…' : 'Join course'}
        </Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 3, textAlign: 'center' }}>
          Don't have a code? Ask your instructor — they can find it on the course page.
        </Typography>
      </Paper>
    </Container>
  );
}
