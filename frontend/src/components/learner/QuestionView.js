import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { memo } from 'react';
import InlineCode from '../common/InlineCode';
import { pluralize } from './format';

export const TYPE_LABEL = {
  'multiple-choice': 'Multiple choice',
  'multiple-select': 'Select all that apply',
  'true-false': 'True or false',
  'short-answer': 'Short answer',
  essay: 'Essay',
};

const MAX_TEXT = 20000;
const letter = (i) => String.fromCharCode(65 + i);

const OptionLabel = ({ index, text, showKeyHint }) => (
  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, py: 0.25 }}>
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        flex: 'none',
        fontWeight: 700,
        fontSize: '0.8rem',
        color: 'text.secondary',
        minWidth: 16,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {showKeyHint && index < 9 ? index + 1 : letter(index)}
    </Box>
    <Box component="span" sx={{ fontSize: { xs: '1rem', sm: '1.0625rem' }, lineHeight: 1.55 }}>
      <InlineCode text={String(text)} />
    </Box>
  </Box>
);

const useOptionSx = () => {
  const theme = useTheme();
  return (selected) => ({
    m: 0,
    mb: 1.25,
    width: '100%',
    alignItems: 'flex-start',
    px: { xs: 1, sm: 1.5 },
    py: 0.75,
    borderRadius: 3,
    border: '1px solid',
    borderColor: selected ? 'primary.main' : 'divider',
    bgcolor: selected ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.06) : 'background.paper',
    boxShadow: selected ? `inset 0 0 0 1px ${theme.palette.primary.main}` : 'none',
    transition: 'border-color .15s ease, background-color .15s ease',
    '&:hover': { borderColor: selected ? 'primary.main' : 'text.secondary' },
    '&:focus-within': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
    '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0, pt: 0.75 },
  });
};

/**
 * One question of the exam: large, calm typography, card-style options.
 * value/onChange are the raw answer (string, string[] for multiple-select).
 */
const QuestionView = ({
  question,
  index,
  total,
  value,
  onChange,
  onTextBlur,
  flagged,
  onToggleFlag,
  blockPaste = false,
  onPasteBlocked,
  showKeyHints = true,
  headingRef,
}) => {
  const optionSx = useOptionSx();
  const type = question.type;
  const options = Array.isArray(question.options) ? question.options : [];
  const words = typeof value === 'string' && value.trim() ? value.trim().split(/\s+/).length : 0;

  const handlePaste = (e) => {
    if (!blockPaste) return;
    e.preventDefault();
    if (onPasteBlocked) onPasteBlocked();
  };

  let body;
  if (type === 'multiple-choice' || type === 'true-false') {
    const opts = options.length ? options : type === 'true-false' ? ['True', 'False'] : [];
    body = (
      <RadioGroup
        aria-labelledby={`q-${question.id}-text`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {opts.map((option, i) => (
          <FormControlLabel
            key={`${i}-${option}`}
            value={String(option)}
            control={<Radio sx={{ mt: 0.25 }} />}
            label={<OptionLabel index={i} text={option} showKeyHint={showKeyHints} />}
            sx={optionSx(value === String(option))}
          />
        ))}
      </RadioGroup>
    );
  } else if (type === 'multiple-select') {
    const selections = Array.isArray(value) ? value : [];
    const toggle = (option, checked) => {
      const next = checked
        ? selections.includes(option)
          ? selections
          : [...selections, option]
        : selections.filter((s) => s !== option);
      onChange(next);
    };
    body = (
      <Box role="group" aria-labelledby={`q-${question.id}-text`}>
        {options.map((option, i) => {
          const checked = selections.includes(String(option));
          return (
            <FormControlLabel
              key={`${i}-${option}`}
              control={<Checkbox sx={{ mt: 0.25 }} checked={checked} onChange={(e) => toggle(String(option), e.target.checked)} />}
              label={<OptionLabel index={i} text={option} showKeyHint={showKeyHints} />}
              sx={optionSx(checked)}
            />
          );
        })}
      </Box>
    );
  } else {
    const essay = type === 'essay';
    body = (
      <Box>
        <TextField
          fullWidth
          multiline
          minRows={essay ? 10 : 4}
          maxRows={essay ? 30 : 12}
          placeholder={essay ? 'Write your answer…' : 'Type your answer…'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onTextBlur}
          onPaste={handlePaste}
          onDrop={blockPaste ? (e) => e.preventDefault() : undefined}
          inputProps={{
            maxLength: MAX_TEXT,
            'aria-labelledby': `q-${question.id}-text`,
            spellCheck: true,
          }}
          sx={{ '& .MuiInputBase-root': { fontSize: { xs: '1rem', sm: '1.0625rem' }, lineHeight: 1.6, borderRadius: 3 } }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, color: 'text.secondary' }}>
          <Typography variant="caption">{blockPaste ? 'Pasting is disabled for this assessment.' : ' '}</Typography>
          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {pluralize(words, 'word')}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="article" aria-label={`Question ${index + 1} of ${total}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography
          variant="overline"
          component="h2"
          ref={headingRef}
          tabIndex={-1}
          sx={{ color: 'text.secondary', outline: 'none', lineHeight: 1.6 }}
        >
          Question {index + 1} of {total}
          <Box component="span" sx={{ mx: 1 }} aria-hidden="true">
            ·
          </Box>
          {TYPE_LABEL[type] || 'Question'}
          <Box component="span" sx={{ mx: 1 }} aria-hidden="true">
            ·
          </Box>
          {pluralize(Number(question.points) || 0, 'point')}
        </Typography>
        <Button
          size="small"
          color={flagged ? 'secondary' : 'inherit'}
          variant={flagged ? 'contained' : 'text'}
          startIcon={flagged ? <FlagRoundedIcon /> : <FlagOutlinedIcon />}
          onClick={onToggleFlag}
          aria-pressed={Boolean(flagged)}
          sx={{ color: flagged ? undefined : 'text.secondary', fontWeight: 600 }}
        >
          {flagged ? 'Flagged' : 'Flag for review'}
        </Button>
      </Box>
      <Typography
        id={`q-${question.id}-text`}
        component="p"
        sx={{
          fontSize: { xs: '1.15rem', sm: '1.3rem' },
          lineHeight: 1.55,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          mb: 3,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        <InlineCode text={question.text} />
      </Typography>
      {body}
    </Box>
  );
};

export default memo(QuestionView);
