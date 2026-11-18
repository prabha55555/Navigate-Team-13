import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../common';
import ConfirmDialog from '../ConfirmDialog';
import QuestionEditor from '../QuestionEditor';
import { ToneChip } from '../StaffUI';
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  blankQuestion,
  newQuestionId,
  pluralize,
  questionIssues,
  questionTypeLabel,
  totalPoints,
} from '../staffUtils';

function AddQuestionButton({ onAdd, disabled, variant = 'contained' }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Button variant={variant} startIcon={<AddRoundedIcon />} onClick={(e) => setAnchor(e.currentTarget)} disabled={disabled} aria-haspopup="menu">
        Add question
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {QUESTION_TYPES.map((t) => (
          <MenuItem
            key={t.value}
            onClick={() => {
              setAnchor(null);
              onAdd(t.value);
            }}
          >
            {t.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function QuestionCard({
  q,
  index,
  count,
  expanded,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  onSaveToBank,
  selected,
  onSelect,
  topics,
  locked,
  drag,
}) {
  const [anchor, setAnchor] = useState(null);
  const { errors } = questionIssues(q);
  const cardRef = useRef(null);

  useEffect(() => {
    if (expanded && q.__focus && cardRef.current) cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [expanded, q.__focus]);

  return (
    <Paper
      ref={cardRef}
      variant="outlined"
      draggable={!locked && drag.armed === q.id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        drag.start(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        drag.over(index);
      }}
      onDragEnd={drag.end}
      sx={(t) => ({
        borderRadius: 3,
        overflow: 'hidden',
        borderColor: errors.length ? alpha(t.palette.error.main, 0.5) : expanded ? 'primary.main' : 'divider',
        opacity: drag.dragging === index ? 0.5 : 1,
        transition: 'border-color .15s ease',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, minHeight: 56 }}>
        {!locked && (
          <Tooltip title="Drag to reorder">
            <Box
              onPointerDown={() => drag.arm(q.id)}
              onPointerUp={() => drag.arm(null)}
              aria-hidden="true"
              sx={{ cursor: 'grab', color: 'text.disabled', display: { xs: 'none', sm: 'flex' }, '&:active': { cursor: 'grabbing' } }}
            >
              <DragIndicatorRoundedIcon fontSize="small" />
            </Box>
          </Tooltip>
        )}
        <Checkbox size="small" checked={selected} onChange={onSelect} inputProps={{ 'aria-label': `Select question ${index + 1}` }} />
        <Box
          component="button"
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`q-${q.id}-panel`}
          sx={(t) => ({
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textAlign: 'left',
            border: 0,
            bgcolor: 'transparent',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            py: 0.75,
            borderRadius: 1,
            '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}` },
          })}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 24 }}>
            {index + 1}.
          </Typography>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: q.text ? 'text.primary' : 'text.disabled' }} noWrap>
              {q.text || 'Untitled question'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              <ToneChip label={questionTypeLabel(q.type)} sx={{ height: 20, fontSize: 11 }} />
              <ToneChip label={`${q.points || 0} pt${Number(q.points) === 1 ? '' : 's'}`} sx={{ height: 20, fontSize: 11 }} />
              {q.topic && <ToneChip label={q.topic} tone="primary" sx={{ height: 20, fontSize: 11, display: { xs: 'none', sm: 'inline-flex' } }} />}
            </Box>
          </Box>
          {errors.length > 0 && (
            <Tooltip title={errors.join(' · ')}>
              <ErrorOutlineRoundedIcon color="error" fontSize="small" aria-label={`Problems: ${errors.join(', ')}`} />
            </Tooltip>
          )}
          <ExpandMoreRoundedIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'text.secondary' }} />
        </Box>
        <IconButton size="small" aria-label={`More actions for question ${index + 1}`} onClick={(e) => setAnchor(e.currentTarget)}>
          <MoreVertRoundedIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <MenuItem disabled={locked || index === 0} onClick={() => { setAnchor(null); onMove(-1); }}>
            <ListItemIcon><ArrowUpwardRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Move up</ListItemText>
          </MenuItem>
          <MenuItem disabled={locked || index === count - 1} onClick={() => { setAnchor(null); onMove(1); }}>
            <ListItemIcon><ArrowDownwardRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Move down</ListItemText>
          </MenuItem>
          <MenuItem disabled={locked} onClick={() => { setAnchor(null); onDuplicate(); }}>
            <ListItemIcon><ContentCopyRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          <MenuItem disabled={errors.length > 0} onClick={() => { setAnchor(null); onSaveToBank(); }}>
            <ListItemIcon><BookmarkAddOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Save to question bank</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem disabled={locked} onClick={() => { setAnchor(null); onDelete(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
      <Collapse in={expanded} unmountOnExit>
        <Box id={`q-${q.id}-panel`} sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 2.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <QuestionEditor value={q} onChange={onChange} topics={topics} locked={locked} autoFocus={!q.text && !locked} />
        </Box>
      </Collapse>
    </Paper>
  );
}

function BulkBar({ count, onClear, onApply, onDelete, onSaveToBank, locked, topics }) {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [points, setPoints] = useState('');
  return (
    <Paper
      elevation={4}
      role="region"
      aria-label="Bulk actions"
      sx={{ position: 'sticky', top: 72, zIndex: 4, p: 1.5, borderRadius: 3, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, mr: 1 }}>
        {count} selected
      </Typography>
      {!locked && (
        <>
          <TextField
            size="small"
            label="Topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            sx={{ width: 140 }}
            inputProps={{ list: 'bulk-topics' }}
          />
          <datalist id="bulk-topics">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <FormControl size="small" sx={{ width: 130 }}>
            <InputLabel id="bulk-diff">Difficulty</InputLabel>
            <Select labelId="bulk-diff" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {DIFFICULTIES.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label="Points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} sx={{ width: 90 }} inputProps={{ min: 0 }} />
          <Button
            variant="outlined"
            size="small"
            disabled={!topic && !difficulty && points === ''}
            onClick={() => {
              const patch = {};
              if (topic) patch.topic = topic.trim();
              if (difficulty) patch.difficulty = difficulty;
              if (points !== '' && Number(points) >= 0) patch.points = Number(points);
              onApply(patch);
              setTopic('');
              setDifficulty('');
              setPoints('');
            }}
          >
            Apply
          </Button>
        </>
      )}
      <Box sx={{ flex: 1 }} />
      <Button size="small" startIcon={<BookmarkAddOutlinedIcon />} onClick={onSaveToBank}>
        Save to bank
      </Button>
      {!locked && (
        <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={onDelete}>
          Delete
        </Button>
      )}
      <Button size="small" color="inherit" onClick={onClear}>
        Clear
      </Button>
    </Paper>
  );
}

/**
 * The "Questions" section of the assessment editor.
 */
export default function QuestionsStep({
  questions,
  setQuestions,
  topics,
  locked,
  focusId,
  onGenerateAi,
  onImportBank,
  onSaveToBank,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [armed, setArmed] = useState(null);
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    if (focusId) setExpanded((s) => new Set(s).add(focusId));
  }, [focusId]);

  const update = (id, next) => setQuestions((list) => list.map((q) => (q.id === id ? next : q)));
  const move = (from, to) =>
    setQuestions((list) => {
      if (to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const add = (type) => {
    const last = questions[questions.length - 1];
    const q = blankQuestion(type, { topic: last?.topic || '', difficulty: last?.difficulty || 'Medium' });
    setQuestions((list) => [...list, q]);
    setExpanded((s) => new Set(s).add(q.id));
  };
  const duplicate = (q, index) => {
    const copy = { ...q, id: newQuestionId(), options: [...(q.options || [])] };
    setQuestions((list) => [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
    setExpanded((s) => new Set(s).add(copy.id));
  };
  const removeIds = (ids) => {
    setQuestions((list) => list.filter((q) => !ids.includes(q.id)));
    setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
  };

  const drag = {
    armed,
    dragging,
    arm: setArmed,
    start: (i) => setDragging(i),
    over: (i) => {
      if (dragging === null || dragging === i) return;
      move(dragging, i);
      setDragging(i);
    },
    end: () => {
      setDragging(null);
      setArmed(null);
    },
  };

  const errorsCount = questions.filter((q) => questionIssues(q).errors.length).length;
  const allSelected = questions.length > 0 && selected.size === questions.length;

  return (
    <Box>
      {locked && (
        <Alert severity="info" icon={<LockOutlinedIcon />} sx={{ mb: 2 }}>
          Students have already started this assessment, so its questions are locked to keep grading fair. You can still fix typos in question
          wording and explanations — changes to options, answer keys or points are not possible.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        {questions.length > 0 && (
          <Checkbox
            checked={allSelected}
            indeterminate={selected.size > 0 && !allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(questions.map((q) => q.id)) : new Set())}
            inputProps={{ 'aria-label': 'Select all questions' }}
          />
        )}
        <Box sx={{ mr: 'auto' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {pluralize(questions.length, 'question')} · {pluralize(totalPoints(questions), 'point')}
          </Typography>
          {errorsCount > 0 && (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              {pluralize(errorsCount, 'question')} need{errorsCount === 1 ? 's' : ''} attention
            </Typography>
          )}
        </Box>
        {!locked && (
          <>
            <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={onGenerateAi}>
              Generate with AI
            </Button>
            <Button variant="outlined" startIcon={<LibraryBooksOutlinedIcon />} onClick={onImportBank}>
              From question bank
            </Button>
            <AddQuestionButton onAdd={add} />
          </>
        )}
      </Box>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          locked={locked}
          topics={topics}
          onClear={() => setSelected(new Set())}
          onApply={(patch) => setQuestions((list) => list.map((q) => (selected.has(q.id) ? { ...q, ...patch } : q)))}
          onDelete={() => setConfirmDelete([...selected])}
          onSaveToBank={() => onSaveToBank(questions.filter((q) => selected.has(q.id)))}
        />
      )}

      {questions.length === 0 ? (
        <EmptyState
          icon={<QuizOutlinedIcon />}
          title="Add your first question"
          description="Write questions yourself, let AI draft them from your syllabus, or reuse questions from your bank."
          action={
            <>
              <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={onGenerateAi}>
                Generate with AI
              </Button>
              <Button variant="outlined" startIcon={<LibraryBooksOutlinedIcon />} onClick={onImportBank}>
                From question bank
              </Button>
              <AddQuestionButton onAdd={add} />
            </>
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={{ ...q, __focus: focusId === q.id }}
              index={i}
              count={questions.length}
              expanded={expanded.has(q.id)}
              onToggle={() =>
                setExpanded((s) => {
                  const n = new Set(s);
                  if (n.has(q.id)) n.delete(q.id);
                  else n.add(q.id);
                  return n;
                })
              }
              onChange={(next) => {
                const { __focus, ...clean } = next; // eslint-disable-line no-unused-vars
                update(q.id, clean);
              }}
              onMove={(d) => move(i, i + d)}
              onDuplicate={() => duplicate(q, i)}
              onDelete={() => setConfirmDelete([q.id])}
              onSaveToBank={() => onSaveToBank([q])}
              selected={selected.has(q.id)}
              onSelect={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(q.id)) n.delete(q.id);
                  else n.add(q.id);
                  return n;
                })
              }
              topics={topics}
              locked={locked}
              drag={drag}
            />
          ))}
          {!locked && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <AddQuestionButton onAdd={add} variant="text" />
            </Box>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.length > 1 ? `Delete ${confirmDelete.length} questions?` : 'Delete this question?'}
        description="This removes it from the assessment. Copies saved in your question bank are not affected."
        confirmLabel="Delete"
        tone="error"
        onConfirm={() => {
          removeIds(confirmDelete);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </Box>
  );
}
