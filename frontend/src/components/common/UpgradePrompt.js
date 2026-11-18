import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { toApiError } from '../../api/client';
import { isAdminRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';

export const LIMIT_LABELS = {
  staffSeats: 'staff seats',
  students: 'students',
  aiGenerations: 'AI generations this month',
};

/** True for 402 plan-limit / contact-sales errors. */
export const isPlanLimitError = (err) =>
  Boolean(err) && (err.code === 'PLAN_LIMIT' || err.code === 'CONTACT_SALES' || err.status === 402);

const describe = (error) => {
  const details = error?.details || {};
  const label = LIMIT_LABELS[details.limit];
  if (error?.code === 'CONTACT_SALES') {
    return {
      title: 'Talk to us to change plans',
      body: error.message || 'Plan changes are handled by our sales team. We have let your workspace owner know.',
    };
  }
  return {
    title: label ? `You've reached your plan's limit for ${label}` : "You've reached a plan limit",
    body:
      error?.message ||
      'Your current plan does not include more of this. Upgrade to keep going — existing work is not affected.',
    used: details.used,
    max: details.max,
    plan: details.plan,
  };
};

/**
 * Friendly plan-limit explanation with a path to Billing.
 * variant 'dialog' (default, controlled by open/onClose) or 'inline' (an Alert).
 */
const UpgradePrompt = ({ error, open = true, onClose, variant = 'dialog', sx }) => {
  const { currentUser } = useAuth();
  const canManageBilling = isAdminRole(currentUser?.role);
  const info = describe(error);
  const pct = info.max ? Math.min(100, Math.round((Number(info.used || 0) / info.max) * 100)) : null;
  const ownerHint = canManageBilling
    ? 'Compare plans and upgrade in Billing.'
    : 'Ask your workspace owner or an admin to upgrade the plan.';

  if (variant === 'inline') {
    return (
      <Alert
        severity="warning"
        icon={<RocketLaunchOutlinedIcon fontSize="inherit" />}
        sx={sx}
        action={
          canManageBilling ? (
            <Button component={RouterLink} to="/app/settings/billing" color="inherit" size="small">
              View plans
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>{info.title}</AlertTitle>
        {info.body} {ownerHint}
      </Alert>
    );
  }

  return (
    <Dialog open={Boolean(open && error)} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="nv-upgrade-title">
      <DialogTitle id="nv-upgrade-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          aria-hidden="true"
          sx={(t) => ({
            width: 40,
            height: 40,
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
            color: 'secondary.dark',
            bgcolor: alpha(t.palette.secondary.main, 0.16),
          })}
        >
          <RocketLaunchOutlinedIcon />
        </Box>
        {info.title}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {info.body}
        </Typography>
        {pct !== null && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {info.used} of {info.max} used
              </Typography>
              {info.plan && (
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                  {info.plan} plan
                </Typography>
              )}
            </Box>
            <LinearProgress variant="determinate" value={pct} color={pct >= 100 ? 'error' : 'warning'} aria-label="Plan usage" />
          </Box>
        )}
        <Typography variant="body2">{ownerHint}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Not now</Button>
        {canManageBilling && (
          <Button component={RouterLink} to="/app/settings/billing" variant="contained" onClick={onClose}>
            View plans
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

/**
 * Plan-limit handling for any page.
 *
 *   const planLimit = usePlanLimitHandler();
 *   try { ... } catch (err) { if (!planLimit.handle(err)) notify(err.message, 'error'); }
 *   return <>{...}{planLimit.dialog}</>;
 *
 * Passing an error (e.g. from a fetch hook) opens the dialog automatically when it is a plan limit.
 */
export const usePlanLimitHandler = (error) => {
  const [planError, setPlanError] = useState(null);

  useEffect(() => {
    if (isPlanLimitError(error)) setPlanError(toApiError(error));
  }, [error]);

  const handle = useCallback((err) => {
    if (!isPlanLimitError(err)) return false;
    setPlanError(toApiError(err));
    return true;
  }, []);

  const clear = useCallback(() => setPlanError(null), []);

  const dialog = useMemo(
    () => <UpgradePrompt open={Boolean(planError)} error={planError} onClose={clear} />,
    [planError, clear]
  );

  return { handle, clear, dialog, planError, isPlanLimit: isPlanLimitError(error) };
};

export default UpgradePrompt;
