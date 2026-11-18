import { Box } from '@mui/material';
import { memo } from 'react';

// Renders `backtick` spans from AI-generated text as inline code instead of
// showing the raw backticks. Plain strings pass through untouched.
const InlineCode = ({ text }) => {
  if (typeof text !== 'string' || !text.includes('`')) return text ?? null;
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts.map((part, index) =>
    part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
      <Box
        key={index}
        component="code"
        sx={{
          fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
          fontSize: '0.9em',
          px: 0.6,
          py: 0.1,
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.primary',
        }}
      >
        {part.slice(1, -1)}
      </Box>
    ) : (
      part
    )
  );
};

export default memo(InlineCode);
