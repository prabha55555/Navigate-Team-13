import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPracticeQuiz } from '../../api/learningPath';
import { usePlanLimitHandler } from '../common';
import { useNotify } from '../../contexts/NotificationContext';
import { pluralize } from './format';

const PRACTICE_STAGES = [
  { after: 0, label: 'Choosing questions for your topics…' },
  { after: 4, label: 'Writing fresh practice questions…' },
  { after: 12, label: 'Checking answers and explanations…' },
  { after: 22, label: 'Almost there — AI can take up to a minute…' },
];

/**
 * Creates a private practice quiz (POST /learning-path/:courseId/practice) and starts it.
 * mode 'weak' (default) targets weak topics; 'mixed' is a review set for students with nothing weak.
 */
const PracticeDialog = ({ open, onClose, courseId, topics, initialTopics, mode = 'weak' }) => {
  const navigate = useNavigate();
  const notify = useNotify();
  const planLimit = usePlanLimitHandler();
  const [selected, setSelected] = useState(initialTopics);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true; // StrictMode re-runs effects; mark mounted again after the simulated unmount.
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(initialTopics);
      setError(null);
    }
  }, [open, initialTopics]);

  useEffect(() => {
    if (!busy) return undefined;
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  const toggle = (topic) =>
    setSelected((cur) => (cur.includes(topic) ? cur.filter((t) => t !== topic) : cur.length >= 5 ? cur : [...cur, topic]));

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createPracticeQuiz(courseId, { topics: selected.length ? selected : undefined, questionCount: count });
      if (!mounted.current) return;
      notify(
        res.generatedBy === 'ai'
          ? `Your practice quiz is ready — ${pluralize(res.questionCount, 'question')}.`
          : `AI was busy, so we built your quiz from past course questions (${pluralize(res.questionCount, 'question')}).`,
        'success'
      );
      navigate(`/app/take/${res.assessmentId}`);
    } catch (err) {
      if (!mounted.current) return;
      setBusy(false);
      if (!planLimit.handle(err)) setError(err);
    }
  };

  const stage = [...PRACTICE_STAGES].reverse().find((s) => elapsed >= s.after) || PRACTICE_STAGES[0];
  const sorted = useMemo(
    () => [...topics].sort((a, b) => (a.mastery ?? 101) - (b.mastery ?? 101)),
    [topics]
  );

  return (
    <>
      <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="practice-title">
        <DialogTitle id="practice-title">{mode === 'mixed' ? 'Challenge yourself' : 'Practice my weak topics'}</DialogTitle>
        <DialogContent>
          {busy ? (
            <Box sx={{ py: 3, textAlign: 'center' }} role="status" aria-live="polite">
              <Box sx={{ position: 'relative', width: 72, height: 72, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={72} thickness={3} />
                <AutoAwesomeOutlinedIcon sx={{ position: 'absolute', color: 'primary.main' }} aria-hidden="true" />
              </Box>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{stage.label}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {pluralize(count, 'question')} on {selected.length ? selected.join(', ') : mode === 'mixed' ? 'a mix of topics' : 'your weakest topics'} · {elapsed}s
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {mode === 'mixed'
                  ? "You've no weak topics right now. Pick topics for a mixed review, or leave them all unticked and we'll choose. "
                  : "We'll create a private quiz on the topics you pick. "}
                It shows answers right away and never counts towards your grade.
              </Typography>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                Topics <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>(up to 5)</Typography>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }} role="group" aria-label="Topics to practise">
                {sorted.map((t) => {
                  const on = selected.includes(t.topic);
                  return (
                    <Chip
                      key={t.topic}
                      label={`${t.topic}${t.mastery == null ? '' : ` · ${Math.round(t.mastery)}%`}`}
                      onClick={() => toggle(t.topic)}
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      icon={<Checkbox checked={on} size="small" sx={{ p: 0, color: 'inherit !important' }} tabIndex={-1} disableRipple inputProps={{ 'aria-hidden': true }} />}
                      aria-pressed={on}
                      disabled={!on && selected.length >= 5}
                    />
                  );
                })}
              </Box>
              <Typography variant="subtitle2" component="h3" id="count-label">
                Number of questions: {count}
              </Typography>
              <Slider
                value={count}
                onChange={(_e, v) => setCount(v)}
                min={5}
                max={15}
                step={1}
                marks={[{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 15, label: '15' }]}
                aria-labelledby="count-label"
                valueLabelDisplay="auto"
                sx={{ mx: 1, width: 'calc(100% - 16px)' }}
              />
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error.message || "We couldn't create the quiz."} Please try again.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        {!busy && (
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={generate} startIcon={<AutoAwesomeOutlinedIcon />}>
              {error ? 'Try again' : 'Create quiz'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
      {planLimit.dialog}
    </>
  );
};

export default PracticeDialog;
