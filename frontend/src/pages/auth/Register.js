import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CoPresentOutlinedIcon from '@mui/icons-material/CoPresentOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { Alert, Box, Button, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { homePathFor } from '../../auth/roles';
import PasswordField from '../../components/common/PasswordField';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

const ROLES = [
  {
    value: 'student',
    title: 'Student',
    description: 'Take assessments and follow your adaptive path.',
    Icon: SchoolOutlinedIcon,
  },
  {
    value: 'instructor',
    title: 'Instructor',
    description: 'Build courses, AI assessments and insights.',
    Icon: CoPresentOutlinedIcon,
  },
];

const PANELS = {
  student: {
    eyebrow: 'For students',
    title: 'Every subject becomes a route you can follow.',
    bullets: [
      'Assessments generated from your actual course syllabus.',
      'Instant auto-grading with clear pass / fail criteria.',
      'A personalised path to your next checkpoint.',
    ],
  },
  instructor: {
    eyebrow: 'For instructors',
    title: 'From syllabus to assessment in minutes, not evenings.',
    bullets: [
      'Upload a PDF or DOCX — AI extracts topics and outcomes.',
      'Mix multiple choice, multi-select, true/false and short answer.',
      'Results, integrity flags and curriculum maps in one place.',
    ],
  },
};

const validate = ({ name, email, password, confirmPassword }) => ({
  name: name.trim().length < 2 ? 'Enter your full name.' : '',
  email: !email.trim()
    ? 'Enter your email address.'
    : !EMAIL_PATTERN.test(email.trim())
      ? 'That doesn’t look like a valid email address.'
      : '',
  password: password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : '',
  confirmPassword: !confirmPassword ? 'Confirm your password.' : confirmPassword !== password ? 'Passwords don’t match.' : '',
});

const FIELD_ORDER = ['name', 'email', 'password', 'confirmPassword'];

const RoleOption = ({ role, checked, onChange }) => {
  const { Icon } = role;
  return (
    <Box
      component="label"
      sx={(theme) => ({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 1.75,
        borderRadius: '14px',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: checked ? 'primary.main' : 'divider',
        bgcolor: checked ? alpha(theme.palette.primary.main, 0.045) : 'background.paper',
        boxShadow: checked ? `inset 0 0 0 1px ${theme.palette.primary.main}` : '0 1px 1px rgba(14,22,48,0.04)',
        transition: 'border-color .16s ease, background-color .16s ease, box-shadow .16s ease',
        '&:hover': { borderColor: checked ? 'primary.main' : 'grey.400' },
        '&:has(input:focus-visible)': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <input
        type="radio"
        name="role"
        value={role.value}
        checked={checked}
        onChange={onChange}
        className="nv-sr-only"
      />
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          width: 36,
          height: 36,
          mb: 0.75,
          borderRadius: '10px',
          display: 'grid',
          placeItems: 'center',
          color: checked ? '#fff' : 'primary.main',
          bgcolor: checked ? 'primary.main' : alpha(theme.palette.primary.main, 0.08),
          transition: 'background-color .16s ease, color .16s ease',
        })}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>
        {role.title}
      </Typography>
      <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.45 }}>
        {role.description}
      </Typography>
      {checked && (
        <CheckCircleRoundedIcon
          aria-hidden="true"
          sx={{ position: 'absolute', top: 12, right: 12, fontSize: 20, color: 'primary.main' }}
        />
      )}
    </Box>
  );
};

const Register = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: searchParams.get('role') === 'instructor' ? 'instructor' : 'student',
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const refs = { name: useRef(null), email: useRef(null), password: useRef(null), confirmPassword: useRef(null) };

  const { register } = useAuth();
  const navigate = useNavigate();

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

    const firstInvalid = FIELD_ORDER.find((field) => errors[field]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    const { name, email, password, role } = formData;
    try {
      setError('');
      setLoading(true);
      const user = await register(name.trim(), email.trim(), password, role);
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Confirm-password feedback is live once the user has started typing it.
  const confirmError =
    (touched.confirmPassword || submitted || (formData.confirmPassword && formData.confirmPassword.length >= formData.password.length)) &&
    errors.confirmPassword;
  const passwordsMatch = formData.confirmPassword && !errors.confirmPassword && !errors.password;

  return (
    <AuthLayout
      documentTitle="Create account"
      title="Create your account"
      subtitle="Choose how you’ll use Navigate — you can start right away."
      panel={PANELS[formData.role]}
      footer={
        <>
          Already have an account?{' '}
          <Link component={RouterLink} to="/login">
            Sign in
          </Link>
        </>
      }
    >
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
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, mb: 2.5, minWidth: 0 }}>
          <Typography component="legend" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1.25, p: 0 }}>
            I’m joining as
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
            {ROLES.map((role) => (
              <RoleOption key={role.value} role={role} checked={formData.role === role.value} onChange={handleChange} />
            ))}
          </Box>
        </Box>

        <TextField
          inputRef={refs.name}
          required
          fullWidth
          id="name"
          name="name"
          label="Full name"
          autoComplete="name"
          autoFocus
          margin="dense"
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(showError('name'))}
          helperText={showError('name') || ' '}
        />
        <TextField
          inputRef={refs.email}
          required
          fullWidth
          id="email"
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          inputProps={{ inputMode: 'email', autoCapitalize: 'none', spellCheck: false }}
          margin="dense"
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(showError('email'))}
          helperText={showError('email') || ' '}
        />
        <PasswordField
          ref={refs.password}
          required
          fullWidth
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          margin="dense"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(showError('password'))}
          helperText={showError('password') || `At least ${MIN_PASSWORD} characters.`}
        />
        <PasswordField
          ref={refs.confirmPassword}
          required
          fullWidth
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          margin="dense"
          value={formData.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={Boolean(confirmError)}
          helperText={confirmError || (passwordsMatch ? 'Passwords match.' : ' ')}
          FormHelperTextProps={{ sx: passwordsMatch && !confirmError ? { color: 'success.dark' } : undefined }}
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
          {loading
            ? 'Creating your account…'
            : `Create ${formData.role === 'instructor' ? 'instructor' : 'student'} account`}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default Register;
