import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReportGmailerrorredRoundedIcon from '@mui/icons-material/ReportGmailerrorredRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

const newReportId = () =>
  `NV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Friendly crash screen shown when a page throws while rendering. */
export const CrashScreen = ({ reportId, onRetry }) => (
  <Box
    role="alert"
    sx={{
      minHeight: '70vh',
      display: 'grid',
      placeItems: 'center',
      px: 2,
      py: 6,
      bgcolor: 'background.default',
      color: 'text.primary',
    }}
  >
    <Box sx={{ maxWidth: 460, textAlign: 'center' }}>
      <Box
        aria-hidden="true"
        sx={(t) => ({
          width: 64,
          height: 64,
          mx: 'auto',
          mb: 2.5,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'error.main',
          bgcolor: alpha(t.palette.error.main, 0.1),
          '& svg': { fontSize: 30 },
        })}
      >
        <ReportGmailerrorredRoundedIcon />
      </Box>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Something went off course
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        This page hit an unexpected error. Your work that was already saved is safe. Reload to try again — if it keeps
        happening, send us the report ID below.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mb: 3 }}>
        <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => window.location.reload()}>
          Reload page
        </Button>
        {onRetry && (
          <Button variant="outlined" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant="text" href="/app">
          Go to dashboard
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Report ID:{' '}
        <Box component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600, color: 'text.primary' }}>
          {reportId}
        </Box>
      </Typography>
    </Box>
  </Box>
);

/**
 * Catches render errors below it. Pass `resetKey` (e.g. the pathname) so navigating away clears the error.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reportId: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error, reportId: newReportId() };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey, error: null, reportId: null };
    }
    return null;
  }

  componentDidCatch(error, info) {
    // Keep a breadcrumb for support; no third-party reporter is wired in yet.
    try {
      sessionStorage.setItem(
        'nv-last-crash',
        JSON.stringify({ id: this.state.reportId, message: String(error?.message || error), stack: info?.componentStack?.slice(0, 2000), at: new Date().toISOString(), path: window.location.pathname })
      );
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || <CrashScreen reportId={this.state.reportId} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
