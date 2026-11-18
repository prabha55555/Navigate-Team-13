import { Box, Paper, Typography } from '@mui/material';
import React from 'react';

/** Two-column settings block: heading + description on the left, controls on the right. */
const SettingsSection = ({ title, description, children, actions, sx }) => (
  <Paper variant="outlined" component="section" sx={{ borderRadius: 4, overflow: 'hidden', mb: 3, ...sx }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' },
        gap: { xs: 2, md: 4 },
        p: { xs: 2.5, sm: 3 },
      }}
    >
      <Box>
        <Typography variant="subtitle1" component="h2">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
    {actions && (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          px: { xs: 2.5, sm: 3 },
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        {actions}
      </Box>
    )}
  </Paper>
);

export default SettingsSection;
