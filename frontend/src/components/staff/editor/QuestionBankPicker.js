import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { listQuestions } from '../../../api/questionBank';
import { EmptyState } from '../../common';
import { ErrorState, ToneChip } from '../StaffUI';
import { DIFFICULTIES, QUESTION_TYPES, answerKeyText, questionTypeLabel } from '../staffUtils';
import useApiData, { useDebouncedValue } from '../useApiData';

const PAGE_SIZE = 10;

/**
 * Searchable question-bank picker. `onAdd(items)` receives the selected bank items
 * (in the order they were ticked). `busy` shows progress on the add button.
 */
export default function QuestionBankPicker({ open, onClose, onAdd, courseId, busy = false, excludeTexts = [] }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState(courseId ? 'course' : 'all');
  const [type, setType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [topic, setTopic] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const q = useDebouncedValue(search.trim(), 300);

  useEffect(() => {
    if (open) {
      setPicked([]);
      setPage(1);
    }
  }, [open]);
  useEffect(() => setPage(1), [q, scope, type, difficulty, topic]);

  const { data, error, loading, reload } = useApiData(
    () =>
      listQuestions({
        q: q || undefined,
        courseId: scope === 'course' ? courseId : undefined,
        type: type || undefined,
        difficulty: difficulty || undefined,
        topic: topic || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [q, scope, type, difficulty, topic, page, courseId],
    { enabled: open }
  );
  const items = data?.items || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const existing = new Set(excludeTexts.map((t) => t.trim().toLowerCase()));

  const toggle = (item) =>
    setPicked((list) => (list.some((p) => p.id === item.id) ? list.filter((p) => p.id !== item.id) : [...list, item]));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullScreen={fullScreen} maxWidth="md" fullWidth aria-labelledby="bank-picker-title">
      <DialogTitle id="bank-picker-title" sx={{ pr: 6 }}>
        Import from question bank
        <IconButton aria-label="Close" onClick={onClose} disabled={busy} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 2, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: '2fr 1fr 1fr 1fr' } }}>
        <TextField
          size="small"
          placeholder="Search questions"
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
        {courseId && (
          <FormControl size="small">
            <InputLabel id="bp-scope">Scope</InputLabel>
            <Select labelId="bp-scope" label="Scope" value={scope} onChange={(e) => setScope(e.target.value)}>
              <MenuItem value="course">This course</MenuItem>
              <MenuItem value="all">All I can see</MenuItem>
            </Select>
          </FormControl>
        )}
        <FormControl size="small">
          <InputLabel id="bp-type">Type</InputLabel>
          <Select labelId="bp-type" label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="">Any type</MenuItem>
            {QUESTION_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="bp-diff">Difficulty</InputLabel>
          <Select labelId="bp-diff" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            {DIFFICULTIES.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {(data?.topics || []).length > 0 && (
          <FormControl size="small" sx={{ gridColumn: { md: '1 / 2' } }}>
            <InputLabel id="bp-topic">Topic</InputLabel>
            <Select labelId="bp-topic" label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <MenuItem value="">Any topic</MenuItem>
              {data.topics.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
      <DialogContent dividers sx={{ minHeight: 320 }}>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={64} />
            ))}
          </Box>
        ) : !items.length ? (
          <EmptyState
            compact
            icon={<LibraryBooksOutlinedIcon />}
            title={q || type || difficulty || topic ? 'No matching questions' : 'Your question bank is empty'}
            description={
              q || type || difficulty || topic
                ? 'Try different filters, or widen the scope.'
                : 'Save questions to the bank from any assessment to reuse them here.'
            }
          />
        ) : (
          <Box sx={{ display: 'grid', gap: 1 }}>
            {items.map((item) => {
              const on = picked.some((p) => p.id === item.id);
              const dup = existing.has(String(item.text).trim().toLowerCase());
              return (
                <Box
                  key={item.id}
                  component="label"
                  sx={(t) => ({
                    display: 'flex',
                    gap: 1,
                    p: 1.25,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: on ? 'primary.main' : 'divider',
                    bgcolor: on ? alpha(t.palette.primary.main, 0.04) : 'transparent',
                    cursor: 'pointer',
                  })}
                >
                  <Checkbox checked={on} onChange={() => toggle(item)} sx={{ alignSelf: 'flex-start' }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.text}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75, alignItems: 'center' }}>
                      <ToneChip label={questionTypeLabel(item.type)} />
                      <ToneChip label={`${item.points} pt${item.points === 1 ? '' : 's'}`} />
                      {item.topic && <ToneChip label={item.topic} tone="primary" />}
                      <ToneChip label={item.difficulty} />
                      {dup && <ToneChip label="Already in this assessment" tone="warning" />}
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }} noWrap>
                        Answer: {answerKeyText(item)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        {pages > 1 && <Pagination count={pages} page={page} onChange={(_, p) => setPage(p)} size="small" sx={{ mr: 'auto' }} />}
        <Button color="inherit" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!picked.length || busy}
          onClick={() => onAdd(picked)}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Add {picked.length || ''} question{picked.length === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
