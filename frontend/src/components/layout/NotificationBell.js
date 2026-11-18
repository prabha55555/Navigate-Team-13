import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { timeAgo } from '../common/hooks';
import { useInbox } from '../../contexts/InboxContext';
import { useNotify } from '../../contexts/NotificationContext';
import { notificationMeta, safeInternalLink } from './notificationMeta';

export const NotificationRow = ({ item, onClick, dense = false }) => {
  const { Icon, tone } = notificationMeta(item.type);
  const unread = !item.readAt;
  return (
    <ListItemButton
      onClick={onClick}
      sx={{ alignItems: 'flex-start', gap: 1.5, py: dense ? 1.25 : 1.75, px: dense ? 1.5 : 2, borderRadius: 2.5 }}
    >
      <Box
        aria-hidden="true"
        sx={(t) => ({
          width: 34,
          height: 34,
          flex: 'none',
          borderRadius: '10px',
          display: 'grid',
          placeItems: 'center',
          color: t.nv?.inkFor?.[tone] || `${tone}.main`,
          bgcolor: alpha(t.palette[tone].main, t.palette.mode === 'dark' ? 0.18 : 0.1),
          '& svg': { fontSize: 18 },
        })}
      >
        <Icon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: unread ? 700 : 500, lineHeight: 1.4 }}>
          {item.title}
        </Typography>
        {item.body && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: dense ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {item.body}
          </Typography>
        )}
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {timeAgo(item.createdAt)}
        </Typography>
      </Box>
      {unread && (
        <Box
          component="span"
          aria-label="Unread"
          sx={{ width: 8, height: 8, mt: 0.75, flex: 'none', borderRadius: '50%', bgcolor: 'primary.main' }}
        />
      )}
    </ListItemButton>
  );
};

/** Top-bar bell with unread badge and a dropdown of unread notifications. */
const NotificationBell = () => {
  const { unread, unreadCount, markRead, markAllRead, refresh } = useInbox();
  const notify = useNotify();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const openMenu = (e) => {
    setAnchorEl(e.currentTarget);
    refresh();
  };
  const close = () => setAnchorEl(null);

  const handleClick = (item) => {
    close();
    markRead(item.id).catch(() => {});
    const link = safeInternalLink(item.link);
    if (link) navigate(link);
  };

  const handleMarkAll = () => {
    markAllRead().catch(() => notify("Couldn't mark notifications as read", 'error'));
  };

  const label = unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open ? 'true' : undefined}
          onClick={openMenu}
          sx={{ color: 'text.secondary' }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99} overlap="circular">
            <NotificationsNoneRoundedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          role: 'dialog',
          'aria-label': 'Notifications',
          sx: { width: 380, maxWidth: 'calc(100vw - 24px)', mt: 1, display: 'flex', flexDirection: 'column', maxHeight: 'min(560px, calc(100vh - 96px))' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 1 }}>
          <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<DoneAllRoundedIcon />} onClick={handleMarkAll}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {unread.length === 0 ? (
            <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
              <NotificationsNoneRoundedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                You're all caught up
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                New activity will show up here.
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 1 }}>
              {unread.slice(0, 8).map((item) => (
                <NotificationRow key={item.id} item={item} dense onClick={() => handleClick(item)} />
              ))}
            </List>
          )}
        </Box>
        <Divider />
        <Button component={RouterLink} to="/app/notifications" onClick={close} sx={{ borderRadius: 0, py: 1.25 }} fullWidth>
          View all notifications
        </Button>
      </Popover>
    </>
  );
};

export default NotificationBell;
