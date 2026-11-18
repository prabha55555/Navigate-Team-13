import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { getAuditLog } from '../../api/workspace';
import { roleLabel } from '../../auth/roles';
import EmptyState from '../../components/common/EmptyState';
import { timeAgo, useAsync } from '../../components/common/hooks';

const ACTIONS = {
  'workspace.create': 'Created the workspace',
  'workspace.update': 'Updated workspace settings',
  'member.join': 'Joined the workspace',
  'member.role_change': 'Changed a member’s role or status',
  'member.remove': 'Removed a member',
  'member.deactivate': 'Deactivated a member',
  'member.reactivate': 'Reactivated a member',
  'invite.create': 'Created an invite link',
  'invite.revoke': 'Revoked an invite link',
  'plan.change': 'Changed the plan',
  'plan.upgrade_request': 'Requested a plan change',
  'course.create': 'Created a course',
  'course.update': 'Updated a course',
  'course.archive': 'Archived a course',
  'course.join': 'Joined a course with a code',
  'course.join_code_regenerate': 'Regenerated a course join code',
  'course.roster_add': 'Added students to a course',
  'course.roster_remove': 'Removed a student from a course',
  'course.instructor_add': 'Added a co-instructor',
  'course.instructor_remove': 'Removed a co-instructor',
  'course.gradebook_export': 'Exported a gradebook',
  'assessment.create': 'Created an assessment',
  'assessment.update': 'Edited an assessment',
  'assessment.publish': 'Published an assessment',
  'assessment.close': 'Closed an assessment',
  'assessment.duplicate': 'Duplicated an assessment',
  'assessment.archive': 'Archived an assessment',
  'assessment.release_results': 'Released results',
  'submission.grade': 'Graded a submission',
  'question_bank.create': 'Added questions to the bank',
  'question_bank.update': 'Edited a bank question',
  'question_bank.delete': 'Deleted a bank question',
  'question_bank.import': 'Imported bank questions into an assessment',
  'user.password_change': 'Changed their password',
  'user.password_reset': 'Reset their password',
};

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'member.role_change', label: 'Role changes' },
  { value: 'member.remove', label: 'Member removals' },
  { value: 'member.deactivate', label: 'Deactivations' },
  { value: 'invite.create', label: 'Invites created' },
  { value: 'plan.change', label: 'Plan changes' },
  { value: 'course.create', label: 'Courses created' },
  { value: 'assessment.publish', label: 'Assessments published' },
  { value: 'submission.grade', label: 'Manual grading' },
  { value: 'course.gradebook_export', label: 'Gradebook exports' },
];

export const humaniseAction = (action = '') =>
  ACTIONS[action] || action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const PLAN_NAMES = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };
const planName = (id) => PLAN_NAMES[id] || id;

/**
 * Full sentence for an entry when its meta has enough detail (newer entries record the member's
 * name/email and from/to values); older entries fall back to the generic action label.
 */
export const describeAction = (entry) => {
  const m = entry.meta || {};
  const who = m.name || m.email;
  switch (entry.action) {
    case 'member.role_change':
      if (who && m.from && m.to) return `Changed ${who}’s role from ${roleLabel(m.from)} to ${roleLabel(m.to)}`;
      if (who && m.to) return `Changed ${who}’s role to ${roleLabel(m.to)}`;
      if (m.from && m.to) return `Changed a member’s role from ${roleLabel(m.from)} to ${roleLabel(m.to)}`;
      break;
    case 'member.deactivate':
      if (who) return `Deactivated ${who}`;
      break;
    case 'member.reactivate':
      if (who) return `Reactivated ${who}`;
      break;
    case 'member.remove':
      if (who) return `Removed ${who} from the workspace`;
      break;
    case 'member.join':
      if (m.role) return `Joined the workspace as ${/^[aeiou]/i.test(m.role) ? 'an' : 'a'} ${roleLabel(m.role).toLowerCase()}`;
      break;
    case 'invite.create':
      if (m.role) return `Created an invite link for ${roleLabel(m.role).toLowerCase()}s`;
      break;
    case 'invite.revoke':
      if (m.code) return `Revoked invite link ${m.code}`;
      break;
    case 'plan.change':
      if (m.from && m.to) return `Changed the plan from ${planName(m.from)} to ${planName(m.to)}`;
      break;
    case 'plan.upgrade_request':
      if (m.to) return `Requested a change to the ${planName(m.to)} plan`;
      break;
    default:
      break;
  }
  return humaniseAction(entry.action);
};

/** Short, human description of the target from the entry's meta. */
const describeTarget = (entry) => {
  const m = entry.meta || {};
  if (entry.action.startsWith('member.') && m.email) return m.email;
  if (entry.action.startsWith('invite.') && m.code) return m.code;
  if (m.title) return m.title;
  if (m.name) return m.name;
  if (m.email) return m.email;
  if (entry.action === 'plan.change' && m.from && m.to) return `${m.from} → ${m.to}`;
  if (entry.action === 'plan.upgrade_request' && m.to) return `to ${m.to}`;
  if (m.role) return `${roleLabel(m.role)}${m.from ? ` (was ${roleLabel(m.from)})` : ''}`;
  if (Array.isArray(m.changed)) return m.changed.join(', ');
  if (typeof m.count === 'number') return `${m.count} item${m.count === 1 ? '' : 's'}`;
  return entry.targetType || '—';
};

const AuditLogTab = () => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [action, setAction] = useState('');
  const { data, error, loading, reload } = useAsync(
    () => getAuditLog({ page: page + 1, pageSize, action: action || undefined }),
    [page, pageSize, action]
  );

  const items = data?.items || [];
  // Older/imported entries carry no IP; hide the column rather than show a wall of dashes.
  const showIp = items.some((e) => e.ip);
  const cols = showIp ? 5 : 4;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Box sx={{ flex: '1 1 240px' }}>
          <Typography variant="subtitle1" component="h2">
            Audit log
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Kept for 365 days. Visible to owners and admins.
          </Typography>
        </Box>
        <Select
          size="small"
          value={action}
          displayEmpty
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          inputProps={{ 'aria-label': 'Filter by activity' }}
          sx={{ minWidth: 200 }}
        >
          {FILTERS.map((f) => (
            <MenuItem key={f.value} value={f.value}>
              {f.label}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title="Refresh">
          <span>
            <Button onClick={reload} disabled={loading} startIcon={<RefreshRoundedIcon />} aria-label="Refresh audit log">
              Refresh
            </Button>
          </span>
        </Tooltip>
      </Box>
      {error ? (
        <Box sx={{ p: 2 }}>
          <EmptyState tone="error" compact title="Couldn’t load the audit log" description={error.message} action={<Button variant="contained" onClick={reload}>Retry</Button>} />
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 0 }}>
          <Table size="small" aria-label="Audit log">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>Action</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Target</TableCell>
                {showIp && <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>IP address</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && !data
                ? [0, 1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={cols}>
                        <Skeleton height={28} />
                      </TableCell>
                    </TableRow>
                  ))
                : items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={new Date(entry.createdAt).toLocaleString()}>
                          <span>{timeAgo(entry.createdAt)}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {entry.actor?.name || 'System'}
                        </Typography>
                        {entry.actor?.email && (
                          <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }} noWrap>
                            {entry.actor.email}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>{describeAction(entry)}</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'none' }}>
                        {describeTarget(entry)}
                      </TableCell>
                      {showIp && (
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.8rem' }}>
                          {entry.ip || 'Not recorded'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              {data && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={cols}>
                    <EmptyState compact icon={<HistoryRoundedIcon />} title="No activity yet" description={action ? 'Nothing matches this filter.' : 'Important changes in your workspace will be recorded here.'} sx={{ border: 0 }} />
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
          rowsPerPageOptions={[25, 50, 100]}
        />
      )}
    </Paper>
  );
};

export default AuditLogTab;
