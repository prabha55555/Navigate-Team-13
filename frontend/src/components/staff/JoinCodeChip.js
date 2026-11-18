import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { Box, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useNotify } from '../../contexts/NotificationContext';
import { copyText } from './staffUtils';

/** Monospace join code that copies itself when clicked. */
export default function JoinCodeChip({ code, enabled = true, size = 'small' }) {
  const notify = useNotify();
  if (!code) return null;
  return (
    <Tooltip title={enabled ? 'Copy join code' : 'Join code is turned off'}>
      <Box
        component="button"
        type="button"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const ok = await copyText(code);
          notify(ok ? `Join code ${code} copied` : 'Could not copy — select the code instead', ok ? 'success' : 'warning');
        }}
        aria-label={`Join code ${code}${enabled ? '' : ' (disabled)'}. Copy to clipboard`}
        sx={(t) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          py: size === 'small' ? 0.25 : 0.75,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: 'transparent',
          color: enabled ? 'text.primary' : 'text.disabled',
          textDecoration: enabled ? 'none' : 'line-through',
          font: 'inherit',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: size === 'small' ? 13 : 18,
          fontWeight: 700,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(t.palette.primary.main, 0.06), borderColor: 'primary.main' },
          '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
        })}
      >
        {code}
        <ContentCopyRoundedIcon sx={{ fontSize: size === 'small' ? 14 : 18, color: 'text.secondary' }} />
      </Box>
    </Tooltip>
  );
}
