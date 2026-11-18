import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import React from 'react';
import { MetaItem, SectionCard } from '../StaffUI';
import { RESULTS_POLICIES, formatDateTime, pluralize, questionIssues, totalPoints } from '../staffUtils';

/**
 * Pre-publish checklist mirroring the backend's publish rules (≥1 question, every
 * objective question has a valid key) plus advice that doesn't block publishing.
 */
export function buildChecklist(form) {
  const items = [];
  const qs = form.questions || [];
  items.push({ key: 'title', ok: !!form.title?.trim(), label: 'Title', problem: 'Add a title', step: 0 });
  items.push({ key: 'course', ok: !!form.courseId, label: 'Course', problem: 'Choose a course', step: 0 });
  items.push({
    key: 'questions',
    ok: qs.length > 0,
    label: qs.length ? `${pluralize(qs.length, 'question')}, ${totalPoints(qs)} points` : 'Questions',
    problem: 'Add at least one question',
    step: 1,
  });
  qs.forEach((q, i) => {
    const { errors } = questionIssues(q);
    if (errors.length) items.push({ key: `q-${q.id}`, ok: false, label: `Question ${i + 1}`, problem: `Question ${i + 1}: ${errors.join(', ').toLowerCase()}`, step: 1, questionId: q.id });
  });
  if (form.availableFrom && form.dueDate && new Date(form.availableFrom) >= new Date(form.dueDate)) {
    items.push({ key: 'dates', ok: false, label: 'Dates', problem: 'The due date must be after the opening date', step: 2 });
  }
  const warnings = [];
  if (!form.dueDate) warnings.push({ key: 'due', label: 'No due date — students can take it any time while it’s published', step: 2 });
  else if (new Date(form.dueDate) < new Date()) warnings.push({ key: 'past', label: 'The due date is in the past — students won’t be able to start', step: 2 });
  if (form.resultsPolicy === 'after-due' && !form.dueDate) warnings.push({ key: 'policy', label: 'Results are shown after the due date, but there is no due date', step: 2 });
  const review = qs.filter((q) => q.type === 'essay' || (q.type === 'short-answer' && !q.correctAnswer)).length;
  if (review) warnings.push({ key: 'review', label: `${pluralize(review, 'answer')} per student will need your review (essays / short answers without accepted answers)`, step: 1 });
  const noTopic = qs.filter((q) => !q.topic).length;
  if (noTopic) warnings.push({ key: 'topic', label: `${pluralize(noTopic, 'question')} without a topic won’t count towards topic mastery`, step: 1 });
  return { items, warnings, blocking: items.filter((i) => !i.ok) };
}

export default function ReviewStep({ form, courseTitle, checklist, onJump }) {
  const { items, warnings } = checklist;
  const policy = RESULTS_POLICIES.find((r) => r.value === form.resultsPolicy);
  const p = form.proctoring || {};

  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'start' }}>
      <SectionCard title="Checklist" subtitle="Everything in red must be fixed before publishing.">
        <List dense disablePadding>
          {items.map((i) => (
            <ListItem
              key={i.key}
              disableGutters
              secondaryAction={
                !i.ok ? (
                  <Button size="small" onClick={() => onJump(i.step, i.questionId)}>
                    Fix
                  </Button>
                ) : null
              }
            >
              <ListItemIcon sx={{ minWidth: 34 }}>
                {i.ok ? <CheckCircleRoundedIcon color="success" fontSize="small" /> : <ErrorRoundedIcon color="error" fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={i.ok ? i.label : i.problem}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, color: i.ok ? 'text.primary' : 'error.main', sx: { pr: 6 } }}
              />
            </ListItem>
          ))}
          {warnings.map((w) => (
            <ListItem
              key={w.key}
              disableGutters
              secondaryAction={
                <Button size="small" color="inherit" onClick={() => onJump(w.step)}>
                  Review
                </Button>
              }
            >
              <ListItemIcon sx={{ minWidth: 34 }}>
                <WarningAmberRoundedIcon color="warning" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={w.label} primaryTypographyProps={{ variant: 'body2', sx: { pr: 8 } }} />
            </ListItem>
          ))}
        </List>
      </SectionCard>
      <SectionCard title="Summary">
        <Typography variant="h6" component="p" sx={{ fontWeight: 700, mb: 0.5 }}>
          {form.title || 'Untitled assessment'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {courseTitle || 'No course selected'}
        </Typography>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
          <MetaItem label="Opens" value={form.availableFrom ? formatDateTime(form.availableFrom) : 'When published'} />
          <MetaItem label="Due" value={form.dueDate ? formatDateTime(form.dueDate) : 'No due date'} />
          <MetaItem label="Time limit" value={form.timeLimit ? `${form.timeLimit} minutes` : 'None'} />
          <MetaItem label="Attempts" value={form.maxAttempts || 1} />
          <MetaItem label="Pass mark" value={`${form.passingScore ?? 50}%`} />
          <MetaItem label="Shuffle" value={[form.shuffleQuestions && 'Questions', form.shuffleOptions && 'Options'].filter(Boolean).join(' & ') || 'Off'} />
          <MetaItem label="Results" value={policy?.label || '—'} />
          <MetaItem label="Answer key" value={form.showCorrectAnswers ? 'Shown with results' : 'Hidden'} />
          <MetaItem
            label="Proctoring"
            value={
              p.enabled
                ? [p.fullscreen && 'Full screen', p.blockShortcuts && 'Shortcuts blocked', p.webcam && 'Webcam', `max ${p.maxViolations || 5} violations`]
                    .filter(Boolean)
                    .join(' · ')
                : 'Off'
            }
            sx={{ gridColumn: '1 / -1' }}
          />
        </Box>
      </SectionCard>
    </Box>
  );
}
