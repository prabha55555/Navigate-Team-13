import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import { Alert, AlertTitle, Box, Button, CircularProgress, Link, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';
import AuthLayout from '../../components/layout/AuthLayout';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PANEL = {
  eyebrow: 'Account recovery',
  title: 'Lost the trail? We’ll get you back on route.',
  bullets: [
    'Reset links expire after one hour and work once.',
    'Changing your password signs out your other sessions.',
    'We never tell anyone whether an email has an account.',
  ],
};

const ForgotPassword = () => {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);

  const invalid = !EMAIL_PATTERN.test(email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || loading) return;
    try {
      setLoading(true);
      setError('');
      const data = await forgotPassword(email.trim());
      setSent(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      documentTitle="Reset your password"
      title={sent ? 'Check your inbox' : 'Reset your password'}
      subtitle={sent ? undefined : 'Enter the email you sign in with and we’ll send you a reset link.'}
      panel={PANEL}
      footer={
        <>
          Remembered it?{' '}
          <Link component={RouterLink} to="/login">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
            <MarkEmailReadOutlinedIcon sx={{ color: 'success.main', mt: 0.25 }} />
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {sent.message || 'If an account exists for that email, a password reset link has been sent.'} The link is valid for one hour.
            </Typography>
          </Box>
          {sent.devResetUrl && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>Development only</AlertTitle>
              Email isn’t configured on this server, so here’s the reset link:{' '}
              <Link component={RouterLink} to={new URL(sent.devResetUrl, window.location.origin).pathname}>
                open reset page
              </Link>
            </Alert>
          )}
          <Button component={RouterLink} to="/login" variant="outlined" fullWidth size="large">
            Back to sign in
          </Button>
          <Button onClick={() => setSent(null)} fullWidth sx={{ mt: 1 }}>
            Use a different email
          </Button>
        </Box>
      ) : (
        <Box component="form" noValidate onSubmit={handleSubmit} aria-busy={loading}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            id="forgot-email"
            type="email"
            label="Email address"
            required
            fullWidth
            autoFocus
            autoComplete="email"
            inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched && invalid}
            helperText={touched && invalid ? 'Enter a valid email address.' : ' '}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 1.5 }}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </Box>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
