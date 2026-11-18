import { Alert, Box, Button, CircularProgress, Link } from '@mui/material';
import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth';
import PasswordField from '../../components/common/PasswordField';
import PasswordStrength, { passwordMeetsPolicy } from '../../components/common/PasswordStrength';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

const PANEL = {
  eyebrow: 'Account recovery',
  title: 'Choose a new password and get back to it.',
  bullets: ['Use at least 8 characters with a letter and a number.', 'Your other sessions will be signed out for safety.'],
};

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weak = !passwordMeetsPolicy(password);
  const mismatch = confirm !== password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (weak || mismatch || loading) return;
    try {
      setLoading(true);
      setError('');
      const data = await resetPassword(token, password);
      if (currentUser) await logout();
      navigate('/login', { replace: true, state: { notice: data.message || 'Your password has been reset. You can now sign in.' } });
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      documentTitle="Choose a new password"
      title="Choose a new password"
      subtitle="Make it something you don’t use anywhere else."
      panel={PANEL}
      footer={
        <Link component={RouterLink} to="/forgot-password">
          Need a new reset link?
        </Link>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button component={RouterLink} to="/forgot-password" color="inherit" size="small">New link</Button>}>
          {error}
        </Alert>
      )}
      <Box component="form" noValidate onSubmit={handleSubmit} aria-busy={loading} sx={{ display: 'grid', gap: 2 }}>
        <Box>
          <PasswordField
            id="reset-password"
            label="New password"
            required
            fullWidth
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={submitted && weak}
            helperText={submitted && weak ? 'Use at least 8 characters, including a letter and a number.' : undefined}
          />
          <PasswordStrength password={password} />
        </Box>
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          required
          fullWidth
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={submitted && mismatch}
          helperText={submitted && mismatch ? 'Passwords don’t match.' : ' '}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {loading ? 'Saving…' : 'Set new password'}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;
