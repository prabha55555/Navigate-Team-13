import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Alert, Box, Button, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { previewInvite } from '../../api/auth';
import { joinCourse } from '../../api/courses';
import { isStudentRole, roleLabel } from '../../auth/roles';
import AuthLayout from '../../components/layout/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';
import { CodePreview } from '../auth/Register';

const PANEL = {
  eyebrow: 'You’re invited',
  title: 'Someone saved you a seat on the route.',
  bullets: [
    'Course codes enrol you straight into the class.',
    'Invite links set your role in the workspace automatically.',
    'Already have an account? Sign in and we’ll take it from there.',
  ],
};

/** /join/:code — preview an invite or course code, then sign up, sign in, or join directly. */
const JoinLanding = () => {
  const { code } = useParams();
  const { currentUser, workspace, logout } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [state, setState] = useState({ loading: true, preview: null, error: '' });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, preview: null, error: '' });
    previewInvite(code)
      .then((preview) => !cancelled && setState({ loading: false, preview, error: '' }))
      .catch((err) =>
        !cancelled &&
        setState({ loading: false, preview: null, error: err.status === 404 ? 'This invite or join code is not valid.' : err.message })
      );
    return () => {
      cancelled = true;
    };
  }, [code]);

  const preview = state.preview;
  const signedInStudent = currentUser && isStudentRole(currentUser.role);
  const canJoinDirectly = signedInStudent && preview?.kind === 'course';

  const doJoin = async () => {
    setJoining(true);
    setJoinError('');
    try {
      const { course, alreadyEnrolled } = await joinCourse(code);
      notify(alreadyEnrolled ? `You're already enrolled in ${course.title}` : `You joined ${course.title}`, 'success');
      navigate(`/app/courses/${course.id}`, { replace: true });
    } catch (err) {
      setJoinError(err.status === 404 ? 'This course code belongs to a different workspace or is no longer active.' : err.message);
      setJoining(false);
    }
  };

  // Signed-in students with a course code are enrolled straight away.
  useEffect(() => {
    if (canJoinDirectly && !attempted.current) {
      attempted.current = true;
      doJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canJoinDirectly]);

  const signOutAndContinue = async () => {
    await logout();
    navigate(`/register?code=${encodeURIComponent(code)}`);
  };

  let body;
  if (state.loading) {
    body = (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={64} />
        <Skeleton variant="rounded" height={48} />
      </Stack>
    );
  } else if (state.error) {
    body = (
      <Box sx={{ textAlign: 'center' }}>
        <ErrorOutlineRoundedIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {state.error}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Links can expire or be revoked. Ask whoever sent it for a new one, or enter a code manually.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
          <Button component={RouterLink} to={currentUser ? '/app' : '/register?mode=join'} variant="contained">
            {currentUser ? 'Go to dashboard' : 'Enter a code'}
          </Button>
          <Button component={RouterLink} to="/">
            Back to home
          </Button>
        </Stack>
      </Box>
    );
  } else if (canJoinDirectly) {
    body = (
      <Box>
        <CodePreview preview={preview} />
        {joinError ? (
          <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={doJoin}>Retry</Button>}>
            {joinError}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2.5, color: 'text.secondary' }}>
            <CircularProgress size={18} />
            <Typography variant="body2">{joining ? 'Enrolling you…' : 'Getting ready…'}</Typography>
          </Box>
        )}
      </Box>
    );
  } else if (currentUser) {
    body = (
      <Box>
        <CodePreview preview={preview} />
        <Alert severity="info" sx={{ mt: 2 }}>
          You’re signed in as <strong>{currentUser.email}</strong> ({roleLabel(currentUser.role).toLowerCase()} at {workspace?.name || 'your workspace'}).{' '}
          {preview?.kind === 'course'
            ? 'Course codes are for student accounts.'
            : 'This invite creates a new account — sign out first to use it.'}
        </Alert>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2.5 }}>
          <Button component={RouterLink} to="/app" variant="contained">
            Go to dashboard
          </Button>
          <Button onClick={signOutAndContinue}>Sign out and continue</Button>
        </Stack>
      </Box>
    );
  } else {
    body = (
      <Box>
        <CodePreview preview={preview} />
        <Stack spacing={1.25} sx={{ mt: 3 }}>
          <Button component={RouterLink} to={`/register?code=${encodeURIComponent(code)}`} variant="contained" size="large" fullWidth>
            Create my account
          </Button>
          {preview?.kind === 'course' && (
            <Button
              component={RouterLink}
              to="/login"
              state={{ from: { pathname: `/join/${code}` } }}
              variant="outlined"
              size="large"
              fullWidth
            >
              I already have a student account
            </Button>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <AuthLayout
      documentTitle="Join Navigate"
      title={preview ? `Join ${preview.kind === 'course' ? preview.course?.title || 'this course' : preview.workspace?.name}` : 'Join Navigate'}
      subtitle={preview && preview.kind === 'course' ? `A course at ${preview.workspace?.name}` : undefined}
      panel={PANEL}
    >
      {body}
    </AuthLayout>
  );
};

export default JoinLanding;
