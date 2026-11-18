import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { Alert, Box, Button, CircularProgress, InputAdornment, Link, Tab, Tabs, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { previewInvite } from '../../api/auth';
import { roleLabel } from '../../auth/roles';
import PasswordField from '../../components/common/PasswordField';
import PasswordStrength, { passwordMeetsPolicy } from '../../components/common/PasswordStrength';
import { useDebouncedValue } from '../../components/common/hooks';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PANELS = {
  create: {
    eyebrow: 'Start free',
    title: 'Your institution’s assessment home, set up in a minute.',
    bullets: [
      'Free plan: 2 staff seats, 50 students and 25 AI generations a month.',
      'Invite instructors with a link; students join courses with a 6-letter code.',
      'Every workspace is isolated — your data is never visible to another institution.',
    ],
  },
  join: {
    eyebrow: 'Join your class',
    title: 'Got a code from your instructor? You’re one step away.',
    bullets: [
      'Course codes enrol you straight into the right course.',
      'Invite links set up staff accounts with the right role.',
      'Your results and learning path follow you across courses.',
    ],
  },
};

/** Live preview of an invite or course code: "You're joining X as Y". */
export const CodePreview = ({ preview, loading, error }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', py: 1 }}>
        <CircularProgress size={14} /> <Typography variant="body2">Checking code…</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 1 }}>
        {error}
      </Alert>
    );
  }
  if (!preview) return null;
  return (
    <Box
      role="status"
      sx={(t) => ({
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        mt: 1,
        p: 1.5,
        borderRadius: 3,
        border: `1px solid ${alpha(t.palette.success.main, 0.35)}`,
        bgcolor: alpha(t.palette.success.main, 0.08),
      })}
    >
      <CheckCircleRoundedIcon sx={{ color: 'success.main', mt: 0.25 }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {preview.kind === 'course'
            ? `You're joining ${preview.course?.title || 'a course'}`
            : `You're joining ${preview.workspace?.name} as ${/^[aeiou]/i.test(roleLabel(preview.role)) ? 'an' : 'a'} ${roleLabel(preview.role).toLowerCase()}`}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {preview.kind === 'course' ? `at ${preview.workspace?.name} · as a student` : 'Your account will be added to this workspace.'}
        </Typography>
      </Box>
    </Box>
  );
};

/** Debounced invite/course-code preview. */
export const useCodePreview = (rawCode) => {
  const code = useDebouncedValue(rawCode.trim(), 350);
  const [state, setState] = useState({ preview: null, loading: false, error: '' });
  useEffect(() => {
    if (code.length < 6) {
      setState({ preview: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState({ preview: null, loading: true, error: '' });
    previewInvite(code)
      .then((preview) => !cancelled && setState({ preview, loading: false, error: '' }))
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err.status === 404
            ? 'We couldn’t find that code. Double-check it with whoever sent it to you.'
            : err.message || 'Couldn’t check that code.';
        setState({ preview: null, loading: false, error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);
  return { ...state, code };
};

const Register = () => {
  const [params] = useSearchParams();
  const initialCode = params.get('code') || '';
  const [mode, setMode] = useState(initialCode || params.get('mode') === 'join' ? 'join' : 'create');
  const [form, setForm] = useState({ name: '', email: params.get('email') || '', password: '', workspaceName: '', code: initialCode });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const firstFieldRef = useRef(null);

  const { register } = useAuth();
  const navigate = useNavigate();
  const codeState = useCodePreview(mode === 'join' ? form.code : '');

  const errors = useMemo(() => {
    const e = {
      name: form.name.trim().length < 2 ? 'Enter your full name.' : '',
      email: !form.email.trim() ? 'Enter your email address.' : !EMAIL_PATTERN.test(form.email.trim()) ? 'That doesn’t look like a valid email address.' : '',
      password: !passwordMeetsPolicy(form.password) ? 'Use at least 8 characters, including a letter and a number.' : '',
    };
    if (mode === 'create') e.workspaceName = form.workspaceName.trim().length < 2 ? 'Enter your institution or team name.' : '';
    if (mode === 'join') e.code = !form.code.trim() ? 'Enter the invite or course code you were given.' : '';
    return e;
  }, [form, mode]);

  const show = (field) => (touched[field] || submitted) && errors[field];

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'code' ? value.replace(/\s/g, '') : value }));
    if (error) setError('');
  };
  const onBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const switchMode = (_e, next) => {
    setMode(next);
    setSubmitted(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    const firstError = Object.keys(errors).find((k) => errors[k]);
    if (firstError) {
      document.getElementById(`reg-${firstError}`)?.focus();
      return;
    }
    const base = { name: form.name.trim(), email: form.email.trim(), password: form.password };
    const body =
      mode === 'create'
        ? { ...base, mode: 'create-workspace', workspaceName: form.workspaceName.trim() }
        : { ...base, mode: 'join', code: form.code.trim() };
    try {
      setError('');
      setLoading(true);
      await register(body);
      navigate('/app', { replace: true });
    } catch (err) {
      setLoading(false);
      if (err.code === 'PLAN_LIMIT') {
        setError('This workspace has reached its plan’s seat limit. Ask your instructor or workspace admin to upgrade, then try again.');
      } else if (err.status === 409) {
        setError(
          <>
            An account with that email already exists.{' '}
            <Link component={RouterLink} to="/login">
              Sign in instead
            </Link>
            .
          </>
        );
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      documentTitle={mode === 'create' ? 'Create a workspace' : 'Join with a code'}
      title={mode === 'create' ? 'Create your workspace' : 'Join with a code'}
      subtitle={mode === 'create' ? 'Free to start. No credit card required.' : 'Use the invite link or course code you received.'}
      panel={PANELS[mode]}
      footer={
        <>
          Already have an account?{' '}
          <Link component={RouterLink} to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <Tabs
        value={mode}
        onChange={switchMode}
        variant="fullWidth"
        aria-label="How do you want to get started?"
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="create" label="Create a workspace" icon={<ApartmentRoundedIcon fontSize="small" />} iconPosition="start" />
        <Tab value="join" label="Join with a code" icon={<KeyRoundedIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      <Box component="form" noValidate onSubmit={handleSubmit} aria-busy={loading} sx={{ display: 'grid', gap: 1 }}>
        {mode === 'join' && (
          <Box sx={{ mb: 1 }}>
            <TextField
              id="reg-code"
              name="code"
              label="Invite or course code"
              required
              fullWidth
              autoFocus={!initialCode}
              value={form.code}
              onChange={onChange}
              onBlur={onBlur}
              error={Boolean(show('code'))}
              helperText={show('code') || 'e.g. a 6-letter course code like RWTCCG'}
              inputProps={{ autoCapitalize: 'characters', spellCheck: false, autoComplete: 'off' }}
              InputProps={{ startAdornment: <InputAdornment position="start"><KeyRoundedIcon fontSize="small" /></InputAdornment> }}
            />
            <CodePreview preview={codeState.preview} loading={codeState.loading} error={codeState.error} />
          </Box>
        )}
        <TextField
          inputRef={firstFieldRef}
          id="reg-name"
          name="name"
          label="Full name"
          required
          fullWidth
          autoComplete="name"
          autoFocus={mode === 'create' || Boolean(initialCode)}
          value={form.name}
          onChange={onChange}
          onBlur={onBlur}
          error={Boolean(show('name'))}
          helperText={show('name') || ' '}
        />
        <TextField
          id="reg-email"
          name="email"
          type="email"
          label={mode === 'create' ? 'Work email' : 'Email'}
          required
          fullWidth
          autoComplete="email"
          inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
          value={form.email}
          onChange={onChange}
          onBlur={onBlur}
          error={Boolean(show('email'))}
          helperText={show('email') || ' '}
        />
        {mode === 'create' && (
          <TextField
            id="reg-workspaceName"
            name="workspaceName"
            label="Institution or team name"
            required
            fullWidth
            autoComplete="organization"
            value={form.workspaceName}
            onChange={onChange}
            onBlur={onBlur}
            error={Boolean(show('workspaceName'))}
            helperText={show('workspaceName') || 'Shown to everyone you invite. You can change it later.'}
          />
        )}
        <Box>
          <PasswordField
            id="reg-password"
            name="password"
            label="Password"
            required
            fullWidth
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            onBlur={onBlur}
            error={Boolean(show('password'))}
            helperText={show('password') || undefined}
          />
          <PasswordStrength password={form.password} />
        </Box>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mt: 2 }}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {loading ? 'Setting things up…' : mode === 'create' ? 'Create workspace' : 'Join and create account'}
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center', mt: 1 }}>
          By continuing you agree to use Navigate in line with your institution’s policies.
        </Typography>
      </Box>
    </AuthLayout>
  );
};

export default Register;
