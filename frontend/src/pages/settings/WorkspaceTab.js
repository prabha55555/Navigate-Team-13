import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { updateWorkspace } from '../../api/workspace';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';
import SettingsSection from './SettingsSection';

const HEX = /^#[0-9a-f]{6}$/i;

// Brand colour presets offered to customers (stored as data on the workspace, not UI colours).
const PRESETS = [
  { name: 'Compass blue', value: '#3346e8' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Crimson', value: '#be123c' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Slate', value: '#334155' },
];

const WorkspaceTab = () => {
  const { workspace, setWorkspace } = useAuth();
  const notify = useNotify();
  const initial = useMemo(
    () => ({
      name: workspace?.name || '',
      primaryColor: (workspace?.branding?.primaryColor || '#3346e8').toLowerCase(),
      allowStudentSelfSignup: Boolean(workspace?.settings?.allowStudentSelfSignup),
    }),
    [workspace]
  );
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  const dirty = form.name.trim() !== initial.name || form.primaryColor !== initial.primaryColor || form.allowStudentSelfSignup !== initial.allowStudentSelfSignup;
  const nameInvalid = form.name.trim().length < 2;
  const colorInvalid = !HEX.test(form.primaryColor);

  const save = async (e) => {
    e?.preventDefault();
    if (!dirty || nameInvalid || colorInvalid) return;
    setSaving(true);
    try {
      const body = {};
      if (form.name.trim() !== initial.name) body.name = form.name.trim();
      if (form.primaryColor !== initial.primaryColor) body.branding = { primaryColor: form.primaryColor };
      if (form.allowStudentSelfSignup !== initial.allowStudentSelfSignup) body.settings = { allowStudentSelfSignup: form.allowStudentSelfSignup };
      const { workspace: updated } = await updateWorkspace(body);
      setWorkspace((prev) => ({ ...prev, ...updated }));
      notify('Workspace settings saved', 'success');
    } catch (err) {
      notify(err.message || 'Couldn’t save workspace settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <>
      <Button onClick={() => setForm(initial)} disabled={!dirty || saving}>
        Discard
      </Button>
      <Button
        type="submit"
        form="workspace-form"
        variant="contained"
        disabled={!dirty || nameInvalid || colorInvalid || saving}
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
      >
        Save changes
      </Button>
    </>
  );

  return (
    <Box component="form" id="workspace-form" onSubmit={save} noValidate>
      <SettingsSection title="General" description="Your institution or team name is shown to everyone you invite.">
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <TextField
            label="Workspace name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={nameInvalid}
            helperText={nameInvalid ? 'Enter at least 2 characters.' : ' '}
            inputProps={{ maxLength: 120 }}
          />
          <TextField label="Workspace URL id" value={workspace?.slug || ''} disabled helperText="Used internally; it can’t be changed." />
        </Stack>
      </SettingsSection>

      <SettingsSection title="Brand colour" description="Used for your workspace badge. Pick a preset or enter a hex value.">
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }} role="radiogroup" aria-label="Brand colour presets">
          {PRESETS.map((p) => {
            const selected = form.primaryColor === p.value;
            return (
              <Tooltip key={p.value} title={p.name}>
                <Box
                  component="button"
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={p.name}
                  onClick={() => setForm((f) => ({ ...f, primaryColor: p.value }))}
                  sx={(t) => ({
                    width: 36,
                    height: 36,
                    m: '0 !important',
                    borderRadius: '10px',
                    border: `2px solid ${selected ? t.palette.text.primary : 'transparent'}`,
                    outlineOffset: 2,
                    bgcolor: p.value,
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: `inset 0 0 0 2px ${t.palette.background.paper}`,
                  })}
                >
                  {selected && <CheckRoundedIcon fontSize="small" />}
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-start' }} sx={{ maxWidth: 480 }}>
          <TextField
            label="Hex colour"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.trim().toLowerCase() }))}
            error={colorInvalid}
            helperText={colorInvalid ? 'Use a 6-digit hex value like #3346e8.' : ' '}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    component="input"
                    type="color"
                    aria-label="Pick a colour"
                    value={HEX.test(form.primaryColor) ? form.primaryColor : '#000000'}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value.toLowerCase() }))}
                    sx={{ width: 28, height: 28, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
                  />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
            <Box
              aria-hidden="true"
              sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, bgcolor: colorInvalid ? 'action.disabledBackground' : form.primaryColor }}
            >
              {(form.name || 'W').trim().charAt(0).toUpperCase()}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Preview
            </Typography>
          </Box>
        </Stack>
      </SettingsSection>

      <SettingsSection title="Joining" description="Control how students get into your workspace." actions={actions}>
        <FormControlLabel
          control={
            <Switch
              checked={form.allowStudentSelfSignup}
              onChange={(e) => setForm((f) => ({ ...f, allowStudentSelfSignup: e.target.checked }))}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontWeight: 600 }}>Allow students to sign up with a course code</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                When off, new students can only join through an invite link from an admin. Existing students can still join more courses.
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', m: 0, gap: 1, '& .MuiSwitch-root': { mt: -0.5 } }}
        />
      </SettingsSection>
    </Box>
  );
};

export default WorkspaceTab;
