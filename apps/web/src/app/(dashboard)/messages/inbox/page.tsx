'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch, type ApiSuccessResponse, type MessageRecord } from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function InboxPage() {
  const [items, setItems] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadInbox = () => {
    setLoading(true);
    void apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/inbox')
      .then((response) => {
        setItems(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load inbox.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInbox();
  }, []);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<MessageRecord>>(
        `/messages/${id}/read`,
        {
          method: 'PATCH',
        },
      );

      setItems((current) =>
        current.map((item) => (item.id === id ? response.data : item)),
      );
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to mark message as read.',
      });
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading inbox..." />
      </section>
    );
  }

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Inbox</h2>
            <p className="muted-text">
              Review incoming messages, mark them read, and follow school conversations.
            </p>
          </div>
        </div>

        {!items.length ? (
          <EmptyState
            title="Inbox is empty"
            description="Incoming communication from your school team will appear here."
          />
        ) : (
          <div className="message-thread-list">
            {items.map((item) => (
              <article
                className={`card panel message-thread-card${item.isRead ? '' : ' message-thread-card-unread'}`}
                key={item.id}
              >
                <div className="message-thread-head">
                  <div>
                    <h3>{item.subject ?? 'No subject'}</h3>
                    <p className="muted-text">
                      From {item.sender.name} · {item.sender.role}
                    </p>
                  </div>
                  <div className="chip-list">
                    <Badge tone={item.isRead ? 'neutral' : 'info'}>
                      {item.isRead ? 'Read' : 'Unread'}
                    </Badge>
                    <Badge tone="neutral">{formatDate(item.createdAt)}</Badge>
                  </div>
                </div>

                <p className="message-thread-body">{item.message}</p>

                {!item.isRead ? (
                  <div className="form-actions">
                    <span />
                    <Button
                      disabled={markingId === item.id}
                      onClick={() => void handleMarkRead(item.id)}
                      type="button"
                      variant="secondary"
                    >
                      {markingId === item.id ? 'Updating...' : 'Mark as read'}
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
