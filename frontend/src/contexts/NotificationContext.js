import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// App-wide toast notifications. Replaces window.alert(), which blocks the page
// (and freezes timers/proctoring) until the user dismisses it.
const NotificationContext = createContext(() => {});

export const useNotify = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  // notify(message, severity = 'info' | 'success' | 'warning' | 'error')
  const notify = useCallback((message, severity = 'info') => {
    setToast({ message: String(message), severity, key: Date.now() });
  }, []);

  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') return;
    setToast(null);
  };

  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? 8000 : 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert onClose={handleClose} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotificationContext.Provider>
  );
};
