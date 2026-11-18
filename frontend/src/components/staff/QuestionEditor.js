import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useId } from 'react';
import { BLOOM_LEVELS, DIFFICULTIES, QUESTION_TYPES, questionIssues, withTypeDefaults } from './staffUtils';

const MAX_OPTIONS = 10;

/**
 * Inline editor for one question (shared by the assessment editor and the question bank).
 * Controlled: `value` is the question, `onChange(next)` receives the whole updated question.
 * `locked` (students already started) leaves only the wording and explanation editable.
 */
export default function QuestionEditor({ value: q, onChange, topics = [], locked = false, showIssues = true, autoFocus = false }) {
  const uid = useId();
  const set = (patch) => onChange({ ...q, ...patch });
  const issues = showIssues ? questionIssues(q) : { errors: [], warnings: [] };
  const choice = q.type === 'multiple-choice' || q.type === 'multiple-select';
  const multi = q.type === 'multiple-select';
  const keys = Array.isArray(q.correctAnswer) ? q.correctAnswer : q.correctAnswer ? [q.correctAnswer] : [];

  const setOption = (index, text) => {
    const prev = q.options[index];
    const options = q.options.map((o, i) => (i === index ? text : o));
    let correctAnswer = q.correctAnswer;
    if (multi && Array.isArray(correctAnswer)) correctAnswer = correctAnswer.map((k) => (k === prev ? text : k));
    else if (!multi && correctAnswer === prev && prev !== '') correctAnswer = text;
    set({ options, correctAnswer });
  };

  const removeOption = (index) => {
    const removed = q.options[index];
    const options = q.options.filter((_, i) => i !== index);
    let correctAnswer = q.correctAnswer;
    if (multi && Array.isArray(correctAnswer)) {
      const next = correctAnswer.filter((k) => k !== removed);
      correctAnswer = next.length ? next : null;
    } else if (correctAnswer === removed) correctAnswer = null;
    set({ options, correctAnswer });
  };

  const toggleCorrect = (index) => {
    const text = q.options[index];
    if (!String(text || '').trim()) return;
    if (multi) {
      const next = keys.includes(text) ? keys.filter((k) => k !== text) : [...keys, text];
      set({ correctAnswer: next.length ? next : null });
    } else set({ correctAnswer: text });
  };

  const accepted = q.type === 'short-answer' ? keys : [];

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr 1fr', md: '1.4fr 0.7fr 0.9fr 1fr 1.5fr' },
        }}
      >
        <FormControl size="small" disabled={locked} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
          <InputLabel id={`${uid}-type`}>Type</InputLabel>
          <Select
            labelId={`${uid}-type`}
            label="Type"
            value={q.type}
            onChange={(e) => onChange(withTypeDefaults(q, e.target.value))}
          >
            {QUESTION_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Points"
          type="number"
          disabled={locked}
          value={q.points}
          onChange={(e) => set({ points: e.target.value === '' ? '' : Number(e.target.value) })}
          inputProps={{ min: 0, max: 1000, step: 0.5 }}
          error={!Number.isFinite(Number(q.points)) || Number(q.points) < 0}
        />
        <FormControl size="small" disabled={locked}>
          <InputLabel id={`${uid}-diff`}>Difficulty</InputLabel>
          <Select labelId={`${uid}-diff`} label="Difficulty" value={q.difficulty || 'Medium'} onChange={(e) => set({ difficulty: e.target.value })}>
            {DIFFICULTIES.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" disabled={locked}>
          <InputLabel id={`${uid}-bloom`}>Bloom level</InputLabel>
          <Select labelId={`${uid}-bloom`} label="Bloom level" value={q.bloomLevel || ''} onChange={(e) => set({ bloomLevel: e.target.value })}>
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {BLOOM_LEVELS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          freeSolo
          size="small"
          disabled={locked}
          options={topics}
          value={q.topic || ''}
          onChange={(_, v) => set({ topic: v || '' })}
          onInputChange={(_, v, reason) => reason === 'input' && set({ topic: v })}
          sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
          renderInput={(params) => <TextField {...params} label="Topic" placeholder="e.g. Sorting" />}
        />
      </Box>

      <TextField
        label="Question"
        multiline
        minRows={2}
        value={q.text}
        onChange={(e) => set({ text: e.target.value })}
        autoFocus={autoFocus}
        error={showIssues && !String(q.text || '').trim()}
        helperText={locked ? 'Students have started this assessment: you can fix wording, not the answer key or options.' : undefined}
        fullWidth
      />

      {choice && (
        <Box role="group" aria-label={multi ? 'Options — tick every correct option' : 'Options — choose the correct option'}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Options{' '}
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              — {multi ? 'tick every correct option' : 'select the correct option'}
            </Typography>
          </Typography>
          <Box sx={{ display: 'grid', gap: 1 }}>
            {q.options.map((opt, i) => {
              const correct = String(opt || '').trim() !== '' && keys.includes(opt);
              const letter = String.fromCharCode(65 + i);
              const Control = multi ? Checkbox : Radio;
              return (
                <Box
                  key={i}
                  sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pl: 0.5,
                    pr: 0.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: correct ? alpha(theme.palette.success.main, 0.5) : 'divider',
                    bgcolor: correct ? alpha(theme.palette.success.main, 0.06) : 'transparent',
                  })}
                >
                  <Tooltip title={correct ? 'Correct answer' : 'Mark as correct'}>
                    <span>
                      <Control
                        checked={correct}
                        onChange={() => toggleCorrect(i)}
                        disabled={locked || !String(opt || '').trim()}
                        color="success"
                        inputProps={{ 'aria-label': `Option ${letter} is correct` }}
                      />
                    </span>
                  </Tooltip>
                  <TextField
                    variant="standard"
                    fullWidth
                    value={opt}
                    disabled={locked}
                    placeholder={`Option ${letter}`}
                    onChange={(e) => setOption(i, e.target.value)}
                    InputProps={{
                      disableUnderline: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            {letter}
                          </Typography>
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{ 'aria-label': `Option ${letter}` }}
                    sx={{ py: 0.75 }}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Remove option ${letter}`}
                    onClick={() => removeOption(i)}
                    disabled={locked || q.options.length <= 2}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
          {!locked && q.options.length < MAX_OPTIONS && (
            <Button size="small" startIcon={<AddRoundedIcon />} sx={{ mt: 1 }} onClick={() => set({ options: [...q.options, ''] })}>
              Add option
            </Button>
          )}
        </Box>
      )}

      {q.type === 'true-false' && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }} id={`${uid}-tf`}>
            Correct answer
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="success"
            value={q.correctAnswer}
            disabled={locked}
            onChange={(_, v) => v && set({ correctAnswer: v })}
            aria-labelledby={`${uid}-tf`}
          >
            <ToggleButton value="True" sx={{ px: 3 }}>
              True
            </ToggleButton>
            <ToggleButton value="False" sx={{ px: 3 }}>
              False
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {q.type === 'short-answer' && (
        <Autocomplete
          multiple
          freeSolo
          disabled={locked}
          options={[]}
          value={accepted}
          onChange={(_, v) => {
            const list = v.map((s) => String(s).trim()).filter(Boolean);
            set({ correctAnswer: list.length > 1 ? list : list[0] || null });
          }}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} key={option} />)
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Accepted answers"
              placeholder={accepted.length ? 'Add another' : 'Type an answer and press Enter'}
              helperText="Exact matches (ignoring case) are marked correct; anything else is flagged for your review."
            />
          )}
        />
      )}

      {q.type === 'essay' && (
        <TextField
          label="Model answer or marking guide (optional)"
          multiline
          minRows={2}
          disabled={locked}
          value={typeof q.correctAnswer === 'string' ? q.correctAnswer : ''}
          onChange={(e) => set({ correctAnswer: e.target.value || null })}
          helperText="Shown to you while reviewing. Essays are scored provisionally and flagged for review."
        />
      )}

      <TextField
        label="Explanation (optional)"
        multiline
        minRows={1}
        value={q.explanation || ''}
        onChange={(e) => set({ explanation: e.target.value })}
        helperText="Shown to students with their results when correct answers are visible."
      />

      {showIssues && issues.errors.length > 0 && (
        <FormHelperText error component="div" role="status">
          {issues.errors.join(' · ')}
        </FormHelperText>
      )}
    </Box>
  );
}
