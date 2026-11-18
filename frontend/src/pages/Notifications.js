import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Button, List, Paper, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications } from '../api/notifications';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';
import { useAsync } from '../components/common/hooks';
import { NotificationRow } from '../components/layout/NotificationBell';
import { safeInternalLink } from '../components/layout/notificationMeta';
import { useInbox } from '../contexts/InboxContext';
import { useNotify } from '../contexts/NotificationContext';

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = (today - d) / 86400000;
  if (diffDays < 7) return 'Earlier this week';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

/** /app/notifications — everything the user has been notified about (latest 50). */
const Notifications = () => {
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const notify = useNotify();
  const inbox = useInbox();
  const { data, error, loading, reload, setData } = useAsync(
    () => listNotifications(filter === 'unread' ? { unread: true } : undefined),
    [filter]
  );

  const items = useMemo(() => data?.items || [], [data]);
  const unreadCount = data?.unreadCount ?? inbox.unreadCount;

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = dayLabel(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return [...map.entries()];
  }, [items]);

  const markLocal = (predicate) =>
    setData((d) =>
      d
        ? {
            ...d,
            items: filter === 'unread' ? d.items.filter((n) => !predicate(n)) : d.items.map((n) => (predicate(n) ? { ...n, readAt: new Date().toISOString() } : n)),
          }
        : d
    );

  const open = (item) => {
    if (!item.readAt) {
      markLocal((n) => n.id === item.id);
      inbox.markRead(item.id).catch(() => {});
    }
    const link = safeInternalLink(item.link);
    if (link) navigate(link);
  };

  const markAll = async () => {
    try {
      await inbox.markAllRead();
      markLocal(() => true);
      setData((d) => (d ? { ...d, unreadCount: 0 } : d));
      notify('All notifications marked as read', 'success');
    } catch (err) {
      notify(err.message || "Couldn't mark notifications as read", 'error');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Notifications"
        description="Assessment releases, results, submissions and workspace activity. We keep the last 90 days."
        actions={
          <Button variant="outlined" startIcon={<DoneAllRoundedIcon />} onClick={markAll} disabled={!unreadCount}>
            Mark all read
          </Button>
        }
      >
        <ToggleButtonGroup
          value={filter}
          exclusive
          size="small"
          onChange={(_e, v) => v && setFilter(v)}
          aria-label="Filter notifications"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="unread">Unread{unreadCount ? ` (${unreadCount})` : ''}</ToggleButton>
        </ToggleButtonGroup>
      </PageHeader>

      {loading && !data ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
          <Stack spacing={2}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                <Skeleton variant="rounded" width={34} height={34} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="45%" />
                  <Skeleton width="80%" />
                </Box>
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : error ? (
        <EmptyState
          tone="error"
          title="Couldn’t load notifications"
          description={error.message}
          action={
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={reload}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<NotificationsNoneRoundedIcon />}
          title={filter === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
          description={
            filter === 'unread'
              ? 'You’re all caught up.'
              : 'When assessments are published, results are released or people join, you’ll see it here.'
          }
          action={filter === 'unread' ? <Button onClick={() => setFilter('all')}>Show all</Button> : null}
        />
      ) : (
        <Stack spacing={3}>
          {groups.map(([label, list]) => (
            <Box key={label} component="section" aria-label={label}>
              <Typography variant="overline" component="h2" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                {label}
              </Typography>
              <Paper variant="outlined" sx={{ borderRadius: 4 }}>
                <List sx={{ p: 1 }}>
                  {list.map((item) => (
                    <NotificationRow key={item.id} item={item} onClick={() => open(item)} />
                  ))}
                </List>
              </Paper>
            </Box>
          ))}
          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Showing the latest {items.length} notification{items.length === 1 ? '' : 's'}.
          </Typography>
        </Stack>
      )}
    </Box>
  );
};

export default Notifications;
