import { useEffect, useState } from 'react';
import { api } from '../api';

// Unread notification count, refreshed every 30 seconds. Shared by the desktop
// sidebar and the phone top bar.
export default function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getNotifications(30);
        setUnreadCount(data.unreadCount ?? 0);
      } catch (err) {
        // Silent fail — don't break the UI if notifications fail
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return unreadCount;
}
