import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { usePageVisible } from '../components/common/hooks';

/**
 * In-app notifications for the signed-in user. Polls unread notifications every 60 s
 * while the tab is visible (and immediately when it becomes visible again).
 */
const POLL_MS = 60 * 1000;

const InboxContext = createContext({
  unreadCount: 0,
  unread: [],
  refresh: () => Promise.resolve(),
  markRead: () => Promise.resolve(),
  markAllRead: () => Promise.resolve(),
});

export const useInbox = () => useContext(InboxContext);

export const InboxProvider = ({ children }) => {
  const visible = usePageVisible();
  const [unread, setUnread] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await listNotifications({ unread: true });
      setUnread(data.items || []);
      setUnreadCount(data.unreadCount ?? (data.items || []).length);
    } catch {
      /* transient; next poll retries */
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [visible, refresh]);

  const markRead = useCallback(async (id) => {
    setUnread((list) => list.filter((n) => n.id !== id));
    setUnreadCount((n) => Math.max(0, n - 1));
    try {
      const data = await markNotificationRead(id);
      if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount);
      return data;
    } catch (err) {
      refresh();
      throw err;
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const previous = { unread, unreadCount };
    setUnread([]);
    setUnreadCount(0);
    try {
      const data = await markAllNotificationsRead();
      if (typeof data?.unreadCount === 'number') setUnreadCount(data.unreadCount);
      return data;
    } catch (err) {
      setUnread(previous.unread);
      setUnreadCount(previous.unreadCount);
      throw err;
    }
  }, [unread, unreadCount]);

  const value = useMemo(
    () => ({ unread, unreadCount, refresh, markRead, markAllRead }),
    [unread, unreadCount, refresh, markRead, markAllRead]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
};
