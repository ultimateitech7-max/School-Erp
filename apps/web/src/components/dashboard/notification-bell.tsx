'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { NoticeIcon } from '@/components/ui/icons';
import {
  apiFetch,
  type ApiSuccessResponse,
  type NotificationMeta,
  type NotificationRecord,
} from '@/utils/api';

export function NotificationBell() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState<NotificationMeta>({
    page: 1,
    limit: 8,
    total: 0,
    unreadCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<
        ApiSuccessResponse<NotificationRecord[], NotificationMeta>
      >('/notifications?page=1&limit=8');
      const unreadItems = response.data.filter((item) => !item.isRead);
      setItems(unreadItems);
      setMeta(
        response.meta ?? {
          page: 1,
          limit: 8,
          total: unreadItems.length,
          unreadCount: unreadItems.length,
        },
      );
      return unreadItems;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load notifications.',
      );
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) {
        return;
      }

      const target = event.target;

      if (target instanceof Node && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch<ApiSuccessResponse<NotificationRecord>>(
        `/notifications/${id}/read`,
        {
          method: 'PATCH',
        },
      );
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                isRead: true,
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setMeta((current) => ({
        ...current,
        unreadCount: Math.max(current.unreadCount - 1, 0),
      }));
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : 'Failed to update notification.',
      );
    }
  };

  const handleMarkVisibleAsRead = async (visibleItems: NotificationRecord[]) => {
    const unreadItems = visibleItems.filter((item) => !item.isRead);

    if (!unreadItems.length) {
      return;
    }

    await Promise.all(unreadItems.map((item) => handleMarkRead(item.id)));
  };

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    const visibleItems = await loadNotifications();
    await handleMarkVisibleAsRead(visibleItems);
  };

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-label="Notifications"
        className="notification-bell-button"
        onClick={() => void handleToggle()}
        type="button"
      >
        <NoticeIcon />
        {meta.unreadCount > 0 ? (
          <span className="notification-bell-count">{meta.unreadCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-dropdown card">
          <div className="notification-dropdown-head">
            <div>
              <strong>Notifications</strong>
              <p className="muted-text">Unread: {meta.unreadCount}</p>
            </div>
            <button
              className="text-link"
              onClick={() => void loadNotifications()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="notification-dropdown-state">
              <Spinner label="Loading notifications..." />
            </div>
          ) : error ? (
            <div className="notification-dropdown-state">
              <p className="ui-field-error">{error}</p>
            </div>
          ) : !items.length ? (
            <div className="notification-dropdown-state">
              <p className="muted-text">No notifications yet.</p>
            </div>
          ) : (
            <div className="notification-list">
              {items.map((item) => (
                <button
                  className={`notification-item${item.isRead ? '' : ' notification-item-unread'}`}
                  key={item.id}
                  onClick={() => undefined}
                  type="button"
                >
                  <div className="notification-item-head">
                    <strong>{item.title}</strong>
                    <Badge tone={item.isRead ? 'neutral' : 'info'}>
                      {item.isRead ? 'Read' : 'New'}
                    </Badge>
                  </div>
                  <p>{item.message}</p>
                  <span className="notification-item-date">
                    {new Intl.DateTimeFormat('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(item.createdAt))}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
