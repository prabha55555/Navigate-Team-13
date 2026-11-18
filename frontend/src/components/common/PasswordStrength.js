import { Box, Typography } from '@mui/material';
import React from 'react';

/** Server policy: ≥ 8 characters with at least one letter and one digit. */
export const passwordMeetsPolicy = (pw = '') => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

/** 0–4 score from length and character variety. */
export const scorePassword = (pw = '') => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 0.5;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|qwerty)/i.test(pw)) score = 0.5;
  if (!passwordMeetsPolicy(pw)) score = Math.min(score, 1);
  return Math.max(0, Math.min(4, Math.round(score)));
};

const LEVELS = [
  { label: 'Too weak', color: 'error' },
  { label: 'Weak', color: 'error' },
  { label: 'Fair', color: 'warning' },
  { label: 'Good', color: 'success' },
  { label: 'Strong', color: 'success' },
];

/** Four-segment strength meter with the policy hint. */
const PasswordStrength = ({ password = '', sx }) => {
  const score = scorePassword(password);
  const level = LEVELS[score];
  const meets = passwordMeetsPolicy(password);

  return (
    <Box sx={{ mt: 1, ...sx }} aria-live="polite">
      <Box sx={{ display: 'flex', gap: 0.5 }} aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <Box
            key={step}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              bgcolor: password && score >= step ? `${level.color}.main` : 'action.disabledBackground',
              transition: 'background-color .2s ease',
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
        {password ? (
          <>
            <Box
              component="span"
              sx={(t) => ({ fontWeight: 700, color: t.palette[level.color][t.palette.mode === 'dark' ? 'light' : 'dark'] })}
            >
              {level.label}
            </Box>
            {!meets && ' · use 8+ characters with a letter and a number'}
          </>
        ) : (
          'At least 8 characters, including a letter and a number.'
        )}
      </Typography>
    </Box>
  );
};

export default PasswordStrength;
