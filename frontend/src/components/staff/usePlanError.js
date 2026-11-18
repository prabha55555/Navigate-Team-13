import { useCallback } from 'react';
import { useNotify } from '../../contexts/NotificationContext';

const isPlanLimit = (err) => err?.code === 'PLAN_LIMIT' || err?.code === 'CONTACT_SALES' || err?.status === 402;

/**
 * Error handler for staff actions: plan-limit errors get an upgrade message,
 * everything else a toast with the server's message. Returns true when the
 * error was a plan limit (callers may show an inline upgrade prompt as well).
 */
export default function usePlanError() {
  const notify = useNotify();
  return useCallback(
    (err, fallback = 'Something went wrong') => {
      if (err?.code === 'CANCELED') return false;
      if (isPlanLimit(err)) {
        notify(`${err.message || 'Your plan limit has been reached.'} Upgrade in Settings → Billing.`, 'warning');
        return true;
      }
      notify(err?.message || fallback, 'error');
      return false;
    },
    [notify]
  );
}

export { isPlanLimit };
