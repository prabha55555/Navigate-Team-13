import { Avatar, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { initialsOf, roleLabel } from '../../auth/roles';
import PasswordField from '../../components/common/PasswordField';
import PasswordStrength, { passwordMeetsPolicy } from '../../components/common/PasswordStrength';
import { ThemeModeSwitch } from '../../components/layout/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';
import SettingsSection from './SettingsSection';

const ProfileTab = () => {
  const { currentUser, workspace, updateProfile, changePassword } = useAuth();
  const notify = useNotify();
  const [name, setName] = useState(currentUser?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSubmitted, setPwSubmitted] = useState(false);
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => setName(currentUser?.name || ''), [currentUser?.name]);

  const nameDirty = name.trim() !== (currentUser?.name || '');
  const nameInvalid = name.trim().length < 2;

  const saveName = async (e) => {
    e.preventDefault();
    if (!nameDirty || nameInvalid) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      notify('Profile updated', 'success');
    } catch (err) {
      notify(err.message || 'Couldn’t update your profile', 'error');
    } finally {
      setSavingName(false);
    }
  };

  const pwErrors = {
    current: !pw.current ? 'Enter your current password.' : '',
    next: !passwordMeetsPolicy(pw.next) ? 'Use at least 8 characters, including a letter and a number.' : pw.next === pw.current ? 'Choose a password you haven’t used here.' : '',
    confirm: pw.confirm !== pw.next ? 'Passwords don’t match.' : '',
  };
  const showPw = (f) => pwSubmitted && pwErrors[f];

  const savePassword = async (e) => {
    e.preventDefault();
    setPwSubmitted(true);
    setPwError('');
    if (Object.values(pwErrors).some(Boolean)) return;
    setSavingPw(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwSubmitted(false);
      notify('Password changed. Your other sessions have been signed out.', 'success');
    } catch (err) {
      setPwError(err.message || 'Couldn’t change your password');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <Box>
      <SettingsSection
        title="Profile"
        description="How you appear to others in your workspace."
        actions={
          <Button
            type="submit"
            form="profile-form"
            variant="contained"
            disabled={!nameDirty || nameInvalid || savingName}
            startIcon={savingName ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Save changes
          </Button>
        }
      >
        <Box component="form" id="profile-form" onSubmit={saveName} noValidate>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: currentUser?.avatarColor || 'primary.main', color: '#fff', fontSize: '1.1rem' }}>
              {initialsOf(currentUser?.name)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {currentUser?.name}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                {roleLabel(currentUser?.role)} · {workspace?.name}
              </Typography>
            </Box>
          </Stack>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <TextField
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameInvalid}
              helperText={nameInvalid ? 'Enter at least 2 characters.' : ' '}
              autoComplete="name"
              inputProps={{ maxLength: 120 }}
            />
            <TextField label="Email" value={currentUser?.email || ''} disabled helperText="Contact a workspace admin to change your sign-in email." />
          </Stack>
        </Box>
      </SettingsSection>

      <SettingsSection title="Appearance" description="Choose light, dark, or follow your device. Saved to your account.">
        <Box sx={{ maxWidth: 420 }}>
          <ThemeModeSwitch size="medium" />
        </Box>
      </SettingsSection>

      <SettingsSection
        title="Password"
        description="Changing your password signs you out everywhere else."
        actions={
          <Button
            type="submit"
            form="password-form"
            variant="contained"
            disabled={savingPw}
            startIcon={savingPw ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Change password
          </Button>
        }
      >
        <Box component="form" id="password-form" onSubmit={savePassword} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            {pwError && (
              <Typography role="alert" variant="body2" sx={(t) => ({ color: t.nv.inkFor.error, fontWeight: 600 })}>
                {pwError}
              </Typography>
            )}
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              error={Boolean(showPw('current'))}
              helperText={showPw('current') || ' '}
            />
            <Box>
              <PasswordField
                label="New password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                error={Boolean(showPw('next'))}
                helperText={showPw('next') || undefined}
                fullWidth
              />
              <PasswordStrength password={pw.next} />
            </Box>
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              error={Boolean(showPw('confirm'))}
              helperText={showPw('confirm') || ' '}
            />
          </Stack>
        </Box>
      </SettingsSection>
    </Box>
  );
};

export default ProfileTab;
