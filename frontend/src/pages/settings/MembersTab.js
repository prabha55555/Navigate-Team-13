import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { createInvite, listInvites, listMembers, removeMember, revokeInvite, updateMember } from '../../api/workspace';
import { initialsOf, isOwnerRole, roleLabel } from '../../auth/roles';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { usePlanLimitHandler } from '../../components/common/UpgradePrompt';
import { copyToClipboard, timeAgo, useAsync, useDebouncedValue } from '../../components/common/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: 'owner', label: 'Owners' },
  { value: 'admin', label: 'Admins' },
  { value: 'instructor', label: 'Instructors' },
  { value: 'student', label: 'Students' },
];

const INVITE_STATUS = {
  active: { label: 'Active', color: 'success' },
  expired: { label: 'Expired', color: 'default' },
  revoked: { label: 'Revoked', color: 'error' },
};

/** Join link for an invite, built for the origin the admin is using (server `url` as fallback). */
export const inviteLink = (invite, serverUrl) =>
  invite?.code ? `${window.location.origin}/join/${invite.code}` : serverUrl || invite?.url || '';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/* ------------------------------------------------------------------ Members */

const MemberActions = ({ member, onDeactivate, onRemove, disabled }) => {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton aria-label={`Actions for ${member.name}`} onClick={(e) => setAnchor(e.currentTarget)} disabled={disabled} size="small">
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDeactivate();
          }}
        >
          <ListItemIcon>{member.deactivated ? <RestartAltRoundedIcon fontSize="small" /> : <BlockRoundedIcon fontSize="small" />}</ListItemIcon>
          {member.deactivated ? 'Reactivate' : 'Deactivate'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onRemove();
          }}
          sx={(t) => ({ color: t.nv.inkFor.error, '& .MuiListItemIcon-root': { color: t.nv.inkFor.error } })}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          Remove from workspace
        </MenuItem>
      </Menu>
    </>
  );
};

const MembersTable = () => {
  const { currentUser } = useAuth();
  const notify = useNotify();
  const planLimit = usePlanLimitHandler();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const query = useDebouncedValue(q.trim(), 300);
  const compact = useMediaQuery((t) => t.breakpoints.down('sm'));

  const { data, error, loading, reload, setData } = useAsync(
    () => listMembers({ q: query || undefined, role: role || undefined, page: page + 1, pageSize }),
    [query, role, page, pageSize]
  );

  const viewerIsOwner = isOwnerRole(currentUser?.role);
  const roleOptions = viewerIsOwner ? ['owner', 'admin', 'instructor', 'student'] : ['admin', 'instructor', 'student'];

  const replaceMember = (member) =>
    setData((d) => (d ? { ...d, items: d.items.map((m) => (m.id === member.id ? { ...m, ...member } : m)) } : d));

  const changeRole = async (member, nextRole) => {
    if (nextRole === member.role) return;
    setBusyId(member.id);
    try {
      const { member: updated } = await updateMember(member.id, { role: nextRole });
      replaceMember(updated);
      notify(`${member.name} is now ${/^[aeiou]/i.test(nextRole) ? 'an' : 'a'} ${roleLabel(nextRole).toLowerCase()}`, 'success');
    } catch (err) {
      if (!planLimit.handle(err)) notify(err.message || 'Couldn’t change role', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (member) => {
    try {
      const { member: updated } = await updateMember(member.id, { deactivated: !member.deactivated });
      replaceMember(updated);
      notify(updated.deactivated ? `${member.name} was deactivated` : `${member.name} was reactivated`, 'success');
    } catch (err) {
      if (!planLimit.handle(err)) notify(err.message || 'Couldn’t update member', 'error');
      throw err;
    }
  };

  const remove = async (member) => {
    try {
      await removeMember(member.id);
      notify(`${member.name} was removed from the workspace`, 'success');
      reload();
    } catch (err) {
      notify(err.message || 'Couldn’t remove member', 'error');
      throw err;
    }
  };

  const items = data?.items || [];

  const memberIdentity = (m, isSelf) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
      <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', color: '#fff', bgcolor: m.avatarColor || 'primary.main' }}>{initialsOf(m.name)}</Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {m.name}
          {isSelf && (
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {' '}
              (you)
            </Box>
          )}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflowWrap: 'anywhere' }} component="p">
          {m.email}
        </Typography>
      </Box>
    </Box>
  );

  const roleControl = (m, locked, fullWidth = false) =>
    locked ? (
      <Typography variant="body2">{roleLabel(m.role)}</Typography>
    ) : (
      <Select
        size="small"
        value={m.role}
        fullWidth={fullWidth}
        onChange={(e) => changeRole(m, e.target.value)}
        disabled={busyId === m.id}
        inputProps={{ 'aria-label': `Role for ${m.name}` }}
        sx={{ minWidth: 130, '& .MuiSelect-select': { py: 0.75 } }}
      >
        {roleOptions.map((r) => (
          <MenuItem key={r} value={r}>
            {roleLabel(r)}
          </MenuItem>
        ))}
      </Select>
    );

  const memberActions = (m, locked) =>
    busyId === m.id ? (
      <CircularProgress size={18} />
    ) : (
      <MemberActions
        member={m}
        disabled={locked}
        onDeactivate={() =>
          setConfirm({
            title: m.deactivated ? `Reactivate ${m.name}?` : `Deactivate ${m.name}?`,
            description: m.deactivated
              ? 'They will be able to sign in again with their existing password.'
              : 'They will be signed out and can’t sign in until reactivated. Their work and results are kept.',
            confirmLabel: m.deactivated ? 'Reactivate' : 'Deactivate',
            tone: m.deactivated ? 'primary' : 'error',
            run: () => toggleActive(m),
          })
        }
        onRemove={() =>
          setConfirm({
            title: `Remove ${m.name}?`,
            description: 'They lose access to this workspace and are removed from all courses. Past submissions stay in your gradebooks. This can’t be undone from here.',
            confirmLabel: 'Remove member',
            tone: 'error',
            run: () => remove(m),
          })
        }
      />
    );

  return (
    <Paper variant="outlined" component="section" aria-labelledby="members-heading" sx={{ borderRadius: 4, overflow: 'hidden', mb: 3 }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Box sx={{ flex: '1 1 200px' }}>
          <Typography id="members-heading" variant="subtitle1" component="h2">
            Members
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {data ? `${data.total} ${data.total === 1 ? 'person' : 'people'}${role || query ? ' match' : ' in this workspace'}` : ' '}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search name or email"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          inputProps={{ 'aria-label': 'Search members' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          sx={{ flex: '1 1 220px', maxWidth: { sm: 280 } }}
        />
        <Select
          size="small"
          value={role}
          displayEmpty
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
          inputProps={{ 'aria-label': 'Filter by role' }}
          sx={{ minWidth: 140 }}
        >
          {ROLE_FILTERS.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {error ? (
        <Box sx={{ p: 2 }}>
          <EmptyState tone="error" compact title="Couldn’t load members" description={error.message} action={<Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={reload}>Retry</Button>} />
        </Box>
      ) : compact ? (
        /* Phones: one stacked card per member so role, status and actions stay visible. */
        <Box component="ul" aria-label="Workspace members" sx={{ listStyle: 'none', m: 0, p: 0, borderTop: 1, borderColor: 'divider' }}>
          {loading && !data
            ? [0, 1, 2, 3].map((i) => (
                <Box component="li" key={i} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Skeleton height={64} />
                </Box>
              ))
            : items.map((m) => {
                const isSelf = m.id === currentUser?.id;
                const locked = isSelf || (!viewerIsOwner && m.role === 'owner');
                return (
                  <Box component="li" key={m.id} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', opacity: m.deactivated ? 0.7 : 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      {memberIdentity(m, isSelf)}
                      <Box sx={{ ml: 'auto', flex: 'none' }}>{memberActions(m, locked)}</Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: '1 1 140px' }}>{roleControl(m, locked, true)}</Box>
                      <Chip size="small" label={m.deactivated ? 'Deactivated' : 'Active'} color={m.deactivated ? 'default' : 'success'} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', width: '100%' }}>
                        Last sign-in: {m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'never'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
          {data && items.length === 0 && (
            <Box component="li" sx={{ p: 2 }}>
              <EmptyState compact icon={<GroupOutlinedIcon />} title="No members found" description={query || role ? 'Try a different search or role filter.' : 'Invite colleagues and students with an invite link below.'} sx={{ border: 0 }} />
            </Box>
          )}
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 0 }}>
          <Table size="small" aria-label="Workspace members">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Role</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Last sign-in</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">
                  <span className="nv-sr-only">Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && !data
                ? [0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton height={36} />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((m) => {
                    const isSelf = m.id === currentUser?.id;
                    const locked = isSelf || (!viewerIsOwner && m.role === 'owner');
                    return (
                      <TableRow key={m.id} sx={{ opacity: m.deactivated ? 0.65 : 1 }}>
                        <TableCell sx={{ minWidth: 220 }}>{memberIdentity(m, isSelf)}</TableCell>
                        <TableCell>{roleControl(m, locked)}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={m.deactivated ? 'Deactivated' : 'Active'} color={m.deactivated ? 'default' : 'success'} />
                        </TableCell>
                        <TableCell align="right">{memberActions(m, locked)}</TableCell>
                      </TableRow>
                    );
                  })}
              {data && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState compact icon={<GroupOutlinedIcon />} title="No members found" description={query || role ? 'Try a different search or role filter.' : 'Invite colleagues and students with an invite link below.'} sx={{ border: 0 }} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data && data.total > 0 && (
        <TablePagination
          component="div"
          count={data.total}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={compact ? [] : [10, 25, 50, 100]}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        onConfirm={confirm?.run}
        onClose={() => setConfirm(null)}
      />
      {planLimit.dialog}
    </Paper>
  );
};

/* ------------------------------------------------------------------ Invites */

const CreateInviteDialog = ({ open, onClose, onCreated }) => {
  const notify = useNotify();
  const [form, setForm] = useState({ role: 'instructor', expiresInDays: 14, maxUses: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  // Invites can't create owners (ownership is granted from the members table).
  const roles = ['admin', 'instructor', 'student'];
  const maxUsesInvalid = form.maxUses !== '' && (!/^\d+$/.test(String(form.maxUses)) || Number(form.maxUses) < 1);

  const reset = () => {
    setForm({ role: 'instructor', expiresInDays: 14, maxUses: '' });
    setCreated(null);
    setError('');
  };

  const close = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (maxUsesInvalid) return;
    setSaving(true);
    setError('');
    try {
      const data = await createInvite({
        role: form.role,
        expiresInDays: Number(form.expiresInDays),
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
      });
      setCreated(data);
      onCreated?.(data);
    } catch (err) {
      setError(err.message || 'Couldn’t create the invite');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    const ok = await copyToClipboard(inviteLink(created.invite, created.url));
    notify(ok ? 'Invite link copied' : 'Copy failed — select the link and copy it manually', ok ? 'success' : 'warning');
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth aria-labelledby="invite-title">
      <DialogTitle id="invite-title">{created ? 'Invite link ready' : 'Create an invite link'}</DialogTitle>
      {created ? (
        <>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Anyone with this link can join as {/^[aeiou]/i.test(created.invite.role) ? 'an' : 'a'} <strong>{roleLabel(created.invite.role).toLowerCase()}</strong> until{' '}
              {fmtDate(created.invite.expiresAt)}
              {created.invite.maxUses ? ` (up to ${created.invite.maxUses} ${created.invite.maxUses === 1 ? 'person' : 'people'})` : ''}.
            </Typography>
            <TextField
              fullWidth
              value={inviteLink(created.invite, created.url)}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy link">
                      <IconButton aria-label="Copy invite link" onClick={copy} edge="end">
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              inputProps={{ 'aria-label': 'Invite link', onFocus: (e) => e.target.select() }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={reset} sx={{ mr: 'auto' }}>
              Create another
            </Button>
            <Button variant="outlined" onClick={copy} startIcon={<ContentCopyRoundedIcon />}>
              Copy link
            </Button>
            <Button variant="contained" onClick={close}>
              Done
            </Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={submit} noValidate>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={2}>
              <TextField select label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} helperText="People who use the link join with this role.">
                {roles.map((r) => (
                  <MenuItem key={r} value={r}>
                    {roleLabel(r)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Expires after" value={form.expiresInDays} onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}>
                {[1, 7, 14, 30, 90, 365].map((d) => (
                  <MenuItem key={d} value={d}>
                    {d === 1 ? '1 day' : d === 365 ? '1 year' : `${d} days`}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Maximum uses"
                placeholder="Unlimited"
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value.replace(/[^\d]/g, '') }))}
                error={maxUsesInvalid}
                helperText={maxUsesInvalid ? 'Enter a whole number, or leave empty for unlimited.' : 'Leave empty for unlimited.'}
                inputProps={{ inputMode: 'numeric' }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving || maxUsesInvalid} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddLinkRoundedIcon />}>
              Create link
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
};

const InvitesSection = () => {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const { data, error, loading, reload, setData } = useAsync(() => listInvites(), []);

  const all = useMemo(() => data?.items || [], [data]);
  const visible = useMemo(() => (showInactive ? all : all.filter((i) => i.status === 'active')), [all, showInactive]);
  const inactiveCount = all.length - all.filter((i) => i.status === 'active').length;

  const copy = useCallback(
    async (invite) => {
      const ok = await copyToClipboard(inviteLink(invite));
      notify(ok ? 'Invite link copied' : `Invite code: ${invite.code}`, ok ? 'success' : 'info');
    },
    [notify]
  );

  const revoke = async (invite) => {
    try {
      const { invite: updated } = await revokeInvite(invite.id);
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === invite.id ? { ...i, ...updated, status: 'revoked' } : i)) } : d));
      notify('Invite link revoked', 'success');
    } catch (err) {
      notify(err.message || 'Couldn’t revoke the invite', 'error');
      throw err;
    }
  };

  return (
    <Paper variant="outlined" component="section" aria-labelledby="invites-heading" sx={{ borderRadius: 4, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Box sx={{ flex: '1 1 240px' }}>
          <Typography id="invites-heading" variant="subtitle1" component="h2">
            Invite links
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Share a link to add instructors, admins or students. Students can also join a course with its code.
          </Typography>
        </Box>
        {inactiveCount > 0 && (
          <Button size="small" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? 'Hide expired & revoked' : `Show expired & revoked (${inactiveCount})`}
          </Button>
        )}
        <Button variant="contained" startIcon={<AddLinkRoundedIcon />} onClick={() => setOpen(true)}>
          Create invite link
        </Button>
      </Box>
      {error ? (
        <Box sx={{ p: 2 }}>
          <EmptyState tone="error" compact title="Couldn’t load invites" description={error.message} action={<Button variant="contained" onClick={reload}>Retry</Button>} />
        </Box>
      ) : loading && !data ? (
        <Box sx={{ p: 2 }}>
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Box>
      ) : visible.length === 0 ? (
        <Box sx={{ px: 2, pb: 2 }}>
          <EmptyState compact icon={<AddLinkRoundedIcon />} title="No active invite links" description="Create one to bring colleagues into your workspace." />
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 0 }}>
          <Table size="small" aria-label="Invite links">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Uses</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Expires</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">
                  <span className="nv-sr-only">Actions</span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((inv) => {
                const status = INVITE_STATUS[inv.status] || INVITE_STATUS.active;
                const active = inv.status === 'active';
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Box component="code" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600, fontSize: '0.8125rem' }}>
                        {inv.code}
                      </Box>
                    </TableCell>
                    <TableCell>{roleLabel(inv.role)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {inv.uses} / {inv.maxUses ?? '∞'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, whiteSpace: 'nowrap', color: 'text.secondary' }}>{fmtDate(inv.expiresAt)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={status.label} color={status.color} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {active && (
                        <>
                          <Tooltip title="Copy link">
                            <IconButton aria-label={`Copy invite link ${inv.code}`} onClick={() => copy(inv)} size="small">
                              <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Revoke">
                            <IconButton aria-label={`Revoke invite ${inv.code}`} onClick={() => setRevoking(inv)} size="small" color="error">
                              <LinkOffRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <CreateInviteDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={({ invite, url }) => setData((d) => ({ ...(d || {}), items: [{ ...invite, url, status: 'active' }, ...(d?.items || [])] }))}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        title="Revoke this invite link?"
        description="People who haven’t used it yet won’t be able to join with it. Anyone who already joined keeps their account."
        confirmLabel="Revoke link"
        onConfirm={() => revoke(revoking)}
        onClose={() => setRevoking(null)}
      />
    </Paper>
  );
};

const MembersTab = () => (
  <Box>
    <MembersTable />
    <InvitesSection />
  </Box>
);

export default MembersTab;
