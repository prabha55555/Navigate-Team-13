import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import React from 'react';
import { isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { Kbd } from './CommandPalette';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

/** Global shortcuts reference (opened with "?"). */
const ShortcutsDialog = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const staff = isStaffRole(currentUser?.role);

  const groups = [
    {
      heading: 'General',
      items: [
        [[MOD_KEY, 'K'], 'Open command palette'],
        [['?'], 'Show keyboard shortcuts'],
        [['Esc'], 'Close dialogs and menus'],
      ],
    },
    {
      heading: 'Go to',
      items: [
        [['G', 'D'], 'Dashboard'],
        ...(staff
          ? [
              [['G', 'C'], 'Courses'],
              [['G', 'Q'], 'Question bank'],
            ]
          : [
              [['G', 'R'], 'My results'],
              [['G', 'J'], 'Join a course'],
            ]),
        [['G', 'N'], 'Notifications'],
        [['G', 'S'], 'Settings'],
      ],
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="nv-shortcuts-title">
      <DialogTitle id="nv-shortcuts-title" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>Keyboard shortcuts</Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {groups.map((group) => (
          <Box key={group.heading} sx={{ mb: 2 }}>
            <Typography variant="overline" component="h3" sx={{ color: 'text.secondary' }}>
              {group.heading}
            </Typography>
            {group.items.map(([keys, label]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {keys.map((k, i) => (
                    <React.Fragment key={k}>
                      {i > 0 && group.heading === 'Go to' && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          then
                        </Typography>
                      )}
                      <Kbd>{k}</Kbd>
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Shortcuts are paused while you type in a field.
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsDialog;
