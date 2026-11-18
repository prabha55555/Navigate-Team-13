import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import React, { useState } from 'react';

/**
 * Confirmation for destructive or irreversible actions.
 * onConfirm may return a promise; the button shows progress until it settles,
 * and the dialog stays open if it rejects (the caller shows the error).
 */
const ConfirmDialog = ({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'error',
  onConfirm,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
      onClose?.();
    } catch {
      /* caller reports the error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(open)} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth aria-labelledby="nv-confirm-title">
      <DialogTitle id="nv-confirm-title">{title}</DialogTitle>
      <DialogContent>
        {description && <DialogContentText>{description}</DialogContentText>}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={tone}
          onClick={handleConfirm}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
