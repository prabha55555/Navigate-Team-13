import { Alert, Box, Button, CircularProgress, Link, TextField } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor } from '../../auth/roles';
import PasswordField from '../../components/common/PasswordField';
import AuthLayout from '../../components/layout/AuthLayout';
import { DEACTIVATED_MESSAGE, useAuth } from '../../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ email, password }) => ({
  email: !email.trim() ? 'Enter your email address.' : !EMAIL_PATTERN.test(email.trim()) ? 'That doesn’t look like a valid email address.' : '',
  password: !password ? 'Enter your password.' : '',
});

const PANEL = {
  eyebrow: 'Welcome back',
  title: 'Pick up the route right where you left off.',
  bullets: [
    'Adaptive learning paths update after every graded attempt.',
    'Proctored tests with fullscreen, keyboard and webcam checks.',
    'Analytics, item analysis and a gradebook for every course.',
  ],
};

const loginErrorMessage = (err) => {
  if (err?.code === 'RATE_LIMITED') {
    const secs = err.details?.retryAfterSeconds;
    return secs
      ? `Too many attempts. For your security, sign-in is paused for about ${Math.ceil(secs / 60)} minute${secs > 60 ? 's' : ''}.`
      : err.message;
  }
  if (err?.code === 'ACCOUNT_DEACTIVATED') return DEACTIVATED_MESSAGE;
  if (err?.status === 401) return err.message || 'That email and password don’t match. Try again or reset your password.';
  return err?.message || 'Sign-in failed. Please try again.';
};

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  // Shown once: session expired, password reset done, or a protected page bounced the visitor here.
  const [notice] = useState(() => {
    if (sessionNotice) return { severity: 'warning', text: sessionNotice };
    if (location.state?.notice) return { severity: 'success', text: location.state.notice };
    if (from?.pathname) return { severity: 'info', text: 'Sign in to continue to that page.' };
    return null;
  });

  useEffect(() => {
    if (sessionNotice) clearSessionNotice();
  }, [sessionNotice, clearSessionNotice]);

  const errors = validate(formData);
  const showError = (field) => (touched[field] || submitted) && errors[field];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleBlur = (e) => setTouched((prev) => ({ ...prev, [e.target.name]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    try {
      setError('');
      setLoading(true);
      const user = await login(formData.email.trim(), formData.password);
      const returnTo =
        from?.pathname && !['/login', '/register'].includes(from.pathname)
          ? `${from.pathname}${from.search || ''}${from.hash || ''}`
          : homePathFor(user);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      documentTitle="Sign in"
      title="Welcome back"
      subtitle="Sign in to your Navigate workspace."
      panel={PANEL}
      footer={
        <>
          New to Navigate?{' '}
          <Link component={RouterLink} to="/register">
            Create a workspace or join with a code
          </Link>
        </>
      }
    >
      {notice && !error && (
        <Alert severity={notice.severity} sx={{ mb: 2 }}>
          {notice.text}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      <Box component="form" noValidate onSubmit={handleSubmit} aria-busy={loading} sx={{ '& .MuiTextField-root + .MuiTextField-root': { mt: 1.5 } }}>
        <TextField
          inputRef={emailRef}
          required
          fullWidth
          id="email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
          autoFocus
          margin="normal"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(showError('email'))}
          helperText={showError('email') || ' '}
          sx={{ mt: 0 }}
        />
        <PasswordField
          ref={passwordRef}
          required
          fullWidth
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          margin="dense"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(showError('password'))}
          helperText={showError('password') || ' '}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
          <Link component={RouterLink} to="/forgot-password" variant="body2" state={{ email: formData.email.trim() }}>
            Forgot password?
          </Link>
        </Box>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mt: 2.5 }}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default Login;
