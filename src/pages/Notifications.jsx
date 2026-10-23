import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Sparkles, MessageCircle, UserPlus,
  TrendingUp, TrendingDown, Check, Trash2
} from 'lucide-react';
import { api } from '../api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { timeAgo } from '../utils/format';

function notificationIcon(type) {
  switch (type) {
    case 'aura_given':    return <Sparkles size={16} className="text-aura-400" />;
    case 'aura_taken':    return <TrendingDown size={16} className="text-red-400" />;
    case 'comment':       return <MessageCircle size={16} className="text-blue-400" />;
    case 'reply':         return <MessageCircle size={16} className="text-blue-400" />;
    case 'follow':        return <UserPlus size={16} className="text-green-400" />;
    case 'group_join':    return <UserPlus size={16} className="text-green-400" />;
    case 'group_request': return <UserPlus size={16} className="text-yellow-400" />;
    case 'group_approved':return <Check size={16} className="text-green-400" />;
    case 'cashout_ready': return <Sparkles size={16} className="text-yellow-400" />;
    default:              return <Bell size={16} className="text-[var(--text-muted)]" />;
  }
}

function notificationText(type, data) {
  switch (type) {
    case 'aura_given':
      return `@${data?.fromUsername ?? 'Someone'} gave you ${data?.amount ?? ''} aura`;
    case 'aura_taken':
      return `@${data?.fromUsername ?? 'Someone'} took ${data?.amount ?? ''} aura from your post`;
    case 'comment':
      return `@${data?.fromUsername ?? 'Someone'} commented on your post`;
    case 'reply':
      return `@${data?.fromUsername ?? 'Someone'} replied to your comment`;
    case 'follow':
      return `@${data?.fromUsername ?? 'Someone'} started following you`;
    case 'group_join':
      return `@${data?.fromUsername ?? 'Someone'} joined your group ${data?.groupName ?? ''}`;
    case 'group_request':
      return `@${data?.fromUsername ?? 'Someone'} requested to join ${data?.groupName ?? ''}`;
    case 'group_approved':
      return `Your request to join ${data?.groupName ?? 'a group'} was approved`;
    case 'cashout_ready':
      return `You have enough aura to cash out!`;
    default:
      return 'New notification';
  }
}

function notificationRoute(type, data) {
  switch (type) {
    case 'aura_given':
    case 'aura_taken':
    case 'comment':
    case 'reply':
      return data?.postId ? `/post/${data.postId}` : null;
    case 'follow':
      return data?.fromUsername ? `/profile/${data.fromUsername}` : null;
    case 'group_join':
    case 'group_request':
    case 'group_approved':
      return data?.groupId ? `/groups/${data.groupId}` : null;
    case 'cashout_ready':
      return '/wallet';
    default:
      return null;
  }
}

export default function Notifications() {
  const navigate                              = useNavigate();
  const [notifications, setNotifications]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications(50);
      setNotifications(data.notifications ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClick(notification) {
    // Mark as read
    if (!notification.read) {
      await api.markRead(notification.notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notification.notificationId
            ? { ...n, read: true }
            : n
        )
      );
    }

    // Navigate to relevant content
    const route = notificationRoute(notification.type, notification.data);
    if (route) navigate(route);
  }

  async function handleMarkAllRead() {
    await api.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function handleDelete(e, notificationId) {
    e.stopPropagation();
    await api.deleteNotification(notificationId);
    setNotifications(prev =>
      prev.filter(n => n.notificationId !== notificationId)
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={22} className="text-aura-400" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold
                             bg-aura-500 text-white">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead}
            className="text-xs text-aura-400 hover:text-aura-300
                       font-medium transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center py-4">{error}</p>
      )}

      {/* Empty state */}
      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Bell size={40} className="text-[var(--text-muted)]" />
          <p className="text-[var(--text-primary)] font-semibold">No notifications yet</p>
          <p className="text-[var(--text-muted)] text-sm text-center">
            When someone interacts with your posts you'll see it here.
          </p>
        </div>
      )}

      {/* Notification list */}
      <div className="flex flex-col gap-2">
        {notifications.map(notification => (
          <div
            key={notification.notificationId}
            onClick={() => handleClick(notification)}
            className={`card flex items-start gap-3 cursor-pointer
                        hover:border-aura-500/30 transition-all duration-200
                        ${!notification.read
                          ? 'border-aura-500/20 bg-aura-500/5'
                          : ''
                        }`}
          >
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)]
                            flex items-center justify-center flex-shrink-0 mt-0.5">
              {notificationIcon(notification.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug
                ${!notification.read
                  ? 'text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)]'
                }`}>
                {notificationText(notification.type, notification.data)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {timeAgo(notification.createdAt)}
              </p>
            </div>

            {/* Unread dot + delete */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-aura-500" />
              )}
              <button
                onClick={e => handleDelete(e, notification.notificationId)}
                className="p-1.5 rounded-lg text-[var(--text-muted)]
                           hover:text-red-400 hover:bg-red-400/10
                           transition-all duration-200 opacity-0
                           group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}