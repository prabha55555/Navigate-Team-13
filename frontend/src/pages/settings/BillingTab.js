import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { changePlan, getUsage, listPlans } from '../../api/workspace';
import { isOwnerRole } from '../../auth/roles';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import { useAsync } from '../../components/common/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

const METERS = [
  { key: 'staffSeats', label: 'Staff seats', hint: 'Owners, admins and instructors', Icon: GroupsOutlinedIcon },
  { key: 'students', label: 'Students', hint: 'Active student accounts', Icon: SchoolOutlinedIcon },
  { key: 'aiGenerations', label: 'AI generations', hint: 'This month · resets on the 1st', Icon: AutoAwesomeOutlinedIcon },
];

const UsageMeter = ({ meter, used = 0, max }) => {
  const unlimited = max == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const tone = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'primary';
  const { Icon } = meter;
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
          {meter.label}
        </Typography>
        {!unlimited && pct >= 80 && <Chip size="small" color={tone} label={pct >= 100 ? 'Limit reached' : `${pct}%`} />}
      </Box>
      <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {used.toLocaleString()}
        <Box component="span" sx={{ fontSize: '0.95rem', fontWeight: 500, color: 'text.secondary' }}>
          {' '}
          / {unlimited ? 'Unlimited' : max.toLocaleString()}
        </Box>
      </Typography>
      <LinearProgress
        variant="determinate"
        value={unlimited ? 0 : pct}
        color={tone}
        sx={{ mt: 1.5 }}
        aria-label={`${meter.label}: ${used} of ${unlimited ? 'unlimited' : max} used`}
      />
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        {meter.hint}
      </Typography>
    </Paper>
  );
};

const BillingTab = () => {
  const { currentUser, setWorkspace } = useAuth();
  const notify = useNotify();
  const isOwner = isOwnerRole(currentUser?.role);
  const [pending, setPending] = useState(null);
  const [salesInfo, setSalesInfo] = useState(null);
  const { data, error, loading, reload } = useAsync(() => Promise.all([getUsage(), listPlans()]), []);

  const [usage, catalog] = data || [];
  const currentPlan = catalog?.currentPlan || usage?.plan;
  const demo = catalog?.billingMode === 'demo';

  const doChange = async (plan) => {
    try {
      const { workspace } = await changePlan(plan.id);
      setWorkspace((prev) => ({ ...prev, ...workspace }));
      notify(`You’re now on the ${plan.name} plan`, 'success');
      reload();
    } catch (err) {
      if (err.code === 'CONTACT_SALES') {
        setSalesInfo({ plan, message: err.message });
        return;
      }
      notify(err.message || 'Couldn’t change the plan', 'error');
      throw err;
    }
  };

  const requestChange = (plan) => {
    if (plan.id === 'enterprise' && demo === false) {
      doChange(plan).catch(() => {});
      return;
    }
    setPending(plan);
  };

  if (error) {
    return (
      <EmptyState
        tone="error"
        title="Couldn’t load billing"
        description={error.message}
        action={
          <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={reload}>
            Retry
          </Button>
        }
      />
    );
  }

  const nearLimit = usage
    ? METERS.filter((m) => usage.limits?.[m.key] != null && usage.usage?.[m.key] / usage.limits[m.key] >= 0.8)
    : [];

  return (
    <Box>
      {demo && (
        <Alert severity="info" icon={<ScienceOutlinedIcon />} sx={{ mb: 3 }}>
          <AlertTitle>Demo mode — no payment is taken</AlertTitle>
          Plan changes apply instantly so you can try every feature. Real billing will be enabled before launch.
        </Alert>
      )}
      {nearLimit.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          You’ve used {nearLimit.map((m) => m.label.toLowerCase()).join(' and ')} up to 80% or more of your plan.
          {isOwner ? ' Upgrade below to avoid interruptions.' : ' Ask the workspace owner to upgrade.'}
        </Alert>
      )}

      <Typography variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
        Usage
        {currentPlan && (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
            on the {catalog?.plans?.find((p) => p.id === currentPlan)?.name || currentPlan} plan
          </Typography>
        )}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 4 }}>
        {loading && !data
          ? METERS.map((m) => <Skeleton key={m.key} variant="rounded" height={150} sx={{ borderRadius: 4 }} />)
          : METERS.map((m) => <UsageMeter key={m.key} meter={m} used={usage?.usage?.[m.key] ?? 0} max={usage?.limits?.[m.key]} />)}
      </Box>

      <Typography variant="subtitle1" component="h2" sx={{ mb: 1.5 }}>
        Plans
      </Typography>
      {!isOwner && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Only the workspace owner can change the plan.
        </Typography>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {loading && !data
          ? [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={320} sx={{ borderRadius: 4 }} />)
          : (catalog?.plans || []).map((plan) => {
              const current = plan.id === currentPlan;
              const direction = PLAN_ORDER.indexOf(plan.id) > PLAN_ORDER.indexOf(currentPlan) ? 'up' : 'down';
              const highlighted = plan.id === 'pro';
              return (
                <Paper
                  key={plan.id}
                  variant="outlined"
                  sx={(t) => ({
                    p: 3,
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: current ? 'primary.main' : 'divider',
                    borderWidth: current ? 2 : 1,
                    bgcolor: current ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.03) : 'background.paper',
                  })}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" component="h3" sx={{ flex: 1 }}>
                      {plan.name}
                    </Typography>
                    {current ? <Chip size="small" color="primary" label="Current plan" /> : highlighted && <Chip size="small" color="secondary" label="Most popular" />}
                  </Box>
                  <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{plan.price}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    {plan.priceDetail}
                  </Typography>
                  <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0, mb: 3, flex: 1 }}>
                    {plan.features.map((f) => (
                      <Box component="li" key={f} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <CheckRoundedIcon fontSize="small" sx={{ color: 'success.main', mt: 0.25 }} />
                        <Typography variant="body2">{f}</Typography>
                      </Box>
                    ))}
                  </Stack>
                  {current ? (
                    <Button variant="outlined" disabled fullWidth>
                      Your current plan
                    </Button>
                  ) : (
                    <Button
                      variant={direction === 'up' ? 'contained' : 'outlined'}
                      fullWidth
                      disabled={!isOwner}
                      onClick={() => requestChange(plan)}
                    >
                      {plan.id === 'enterprise' && !demo ? 'Contact sales' : direction === 'up' ? `Upgrade to ${plan.name}` : `Downgrade to ${plan.name}`}
                    </Button>
                  )}
                </Paper>
              );
            })}
      </Box>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `Switch to ${pending.name}?` : ''}
        description={
          pending
            ? demo
              ? `This is demo billing — the change applies immediately and nothing is charged. Limits change to: ${pending.features.slice(0, 3).join(', ')}.`
              : `We’ll send your request to our sales team. Your plan stays the same until they confirm.`
            : ''
        }
        confirmLabel={pending ? `Switch to ${pending.name}` : 'Confirm'}
        tone="primary"
        onConfirm={() => doChange(pending)}
        onClose={() => setPending(null)}
      />
      <Dialog open={Boolean(salesInfo)} onClose={() => setSalesInfo(null)} maxWidth="xs" fullWidth aria-labelledby="sales-title">
        <DialogTitle id="sales-title">We’ll be in touch</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {salesInfo?.message || 'Online payments are not available yet. We recorded your request and our sales team will contact you.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setSalesInfo(null)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillingTab;
