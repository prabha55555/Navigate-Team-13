import { Box, Typography } from '@mui/material';
import React from 'react';

/**
 * Editorial page heading: optional eyebrow, Fraunces title, description and actions.
 * Pass `children` for content that belongs under the heading (tabs, filters).
 */
const PageHeader = ({ eyebrow, title, description, actions, children, sx }) => (
  <Box component="header" sx={{ mb: { xs: 3, md: 4 }, ...sx }}>
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: { xs: 'flex-start', sm: 'flex-end' },
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
        {eyebrow && (
          <Typography variant="overline" component="p" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h3" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1, maxWidth: 680 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flex: 'none' }}>{actions}</Box>}
    </Box>
    {children && <Box sx={{ mt: 3 }}>{children}</Box>}
  </Box>
);

export default PageHeader;
