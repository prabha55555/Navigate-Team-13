import { Alert, Box, Button, CircularProgress, Link, TextField } from '@mui/material';
import React, { useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor } from '../../auth/roles';
import PasswordField from '../../components/common/PasswordField';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

const validate = ({ email, password }) => ({
  email: !email.trim()
    ? 'Enter your email address.'
    : !EMAIL_PATTERN.test(email.trim())
      ? 'That doesn’t look like a valid email address.'
      : '',
  password: !password
    ? 'Enter your password.'
    : password.length < MIN_PASSWORD
      ? `Passwords are at least ${MIN_PASSWORD} characters.`
      : '',
});

const PANEL = {
  eyebrow: 'Welcome back',
  title: 'Pick up the route right where you left off.',
  bullets: [
    'Your adaptive path updates after every attempt.',
    'Proctored tests with fullscreen, keyboard and webcam checks.',
    'Feedback from an AI expert panel — not just a score.',
  ],
};

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { login, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  // Shown once, e.g. after a session expired or a protected page bounced the visitor here.
  const [notice] = useState(() => {
    if (authError && /session/i.test(authError)) return authError;
    if (from?.pathname) return 'Sign in to continue to that page.';
    return '';
  });

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
        from?.pathname && from.pathname !== '/login'
          ? `${from.pathname}${from.search || ''}${from.hash || ''}`
          : homePathFor(user);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      documentTitle="Sign in"
      title="Welcome back"
      subtitle="Sign in to continue your learning route."
      panel={PANEL}
      footer={
        <>
          New to Navigate?{' '}
          <Link component={RouterLink} to="/register">
            Create an account
          </Link>
        </>
      }
    >
      {notice && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit}
        aria-busy={loading}
        // Room between one field's helper/error line and the next field's floating label.
        sx={{ '& .MuiTextField-root + .MuiTextField-root': { mt: 1.5 } }}
      >
        <TextField
          inputRef={emailRef}
          required
          fullWidth
          id="email"
          name="email"
          type="email"
          label="Email address"
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
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mt: 2, '&.Mui-disabled': loading ? { bgcolor: 'primary.main', color: '#fff', opacity: 0.85 } : {} }}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default Login;
