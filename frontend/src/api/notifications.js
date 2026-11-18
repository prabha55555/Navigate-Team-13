import api, { getData } from './client';

// Notifications (/api/notifications).
/** params: { unread?: true } → { items, unreadCount } */
export const listNotifications = (params) => getData(api.get('/notifications', { params }));
/** → { notification, unreadCount } */
export const markNotificationRead = (id) => getData(api.post(`/notifications/${id}/read`));
/** → { updated, unreadCount } */
export const markAllNotificationsRead = () => getData(api.post('/notifications/read-all'));
