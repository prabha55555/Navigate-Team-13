import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { addStudents } from '../../api/courses';
import { useNotify } from '../../contexts/NotificationContext';
import JoinCodeChip from './JoinCodeChip';
import { copyText, joinUrl, parseEmails, pluralize } from './staffUtils';
import usePlanError from './usePlanError';

/**
 * Two ways to bring students into a course: share the join code / link, or
 * enrol existing workspace students by email.
 */
export default function InviteStudentsDialog({ open, course, onClose, onAdded, initialTab = 'share' }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const notify = useNotify();
  const handleError = usePlanError();
  const [tab, setTab] = useState(initialTab);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setText('');
      setResult(null);
    }
  }, [open, initialTab]);

  const { valid, invalid } = useMemo(() => parseEmails(text), [text]);
  const link = course?.joinCode ? joinUrl(course.joinCode) : '';

  const copy = async (value, label) => {
    const ok = await copyText(value);
    notify(ok ? `${label} copied` : 'Could not copy — select the text instead', ok ? 'success' : 'warning');
  };

  const submit = async () => {
    if (!valid.length) return;
    setBusy(true);
    try {
      const res = await addStudents(course.id, valid);
      setResult(res);
      if (res.added?.length) {
        notify(`Added ${pluralize(res.added.length, 'student')}`, 'success');
        onAdded?.(res);
      }
      setText([...(res.notFound || [])].join('\n'));
    } catch (err) {
      handleError(err, 'Could not add students');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="invite-title">
      <DialogTitle id="invite-title">Invite students</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }} aria-label="Invite method">
        <Tab value="share" label="Share code or link" />
        <Tab value="email" label="Add by email" />
      </Tabs>
      <DialogContent sx={{ pt: 3 }}>
        {tab === 'share' ? (
          !course?.joinCodeEnabled ? (
            <Alert severity="warning">
              The join code for this course is turned off. Turn it on from the course header to let students join themselves.
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gap: 3 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Join code
                </Typography>
                <JoinCodeChip code={course.joinCode} size="large" />
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  Students in your workspace enter this code on their “Join a course” page.
                </Typography>
              </Box>
              <TextField
                label="Invite link"
                value={link}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton aria-label="Copy invite link" onClick={() => copy(link, 'Invite link')} edge="end">
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="New students can sign up with this link and are enrolled automatically."
                onFocus={(e) => e.target.select()}
              />
            </Box>
          )
        ) : (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Student emails"
              placeholder={'ada@school.edu\nalan@school.edu'}
              multiline
              minRows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              helperText={
                text.trim()
                  ? `${pluralize(valid.length, 'valid email')}${invalid.length ? ` · ${invalid.length} not recognised: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}` : ''}`
                  : 'Paste emails separated by commas, spaces or new lines. They must already belong to students in this workspace.'
              }
              error={invalid.length > 0}
            />
            {result && (
              <Box sx={{ display: 'grid', gap: 1 }} role="status">
                {result.added?.length > 0 && <Alert severity="success">Added {pluralize(result.added.length, 'student')}.</Alert>}
                {result.alreadyEnrolled?.length > 0 && (
                  <Alert severity="info">{pluralize(result.alreadyEnrolled.length, 'student')} already enrolled.</Alert>
                )}
                {result.notFound?.length > 0 && (
                  <Alert severity="warning">
                    {pluralize(result.notFound.length, 'email')} {result.notFound.length === 1 ? "isn't" : "aren't"} a student in this workspace (left in the box
                    above). Share the invite link with them instead.
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          {tab === 'share' ? 'Done' : 'Close'}
        </Button>
        {tab === 'share' ? (
          course?.joinCodeEnabled && (
            <Button variant="contained" startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(link, 'Invite link')}>
              Copy link
            </Button>
          )
        ) : (
          <Button
            variant="contained"
            onClick={submit}
            disabled={busy || !valid.length}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {valid.length ? `Add ${pluralize(valid.length, 'student')}` : 'Add students'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
