'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
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

export default function SentMessagesPage() {
  const [items, setItems] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/sent')
      .then((response) => {
        setItems(response.data);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load sent messages.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading sent messages..." />
      </section>
    );
  }

  return (
    <div className="dashboard-stack">
      {error ? <Banner tone="error">{error}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Sent Messages</h2>
            <p className="muted-text">
              Track outgoing communication and read status from one place.
            </p>
          </div>
        </div>

        {!items.length ? (
          <EmptyState
            title="Nothing sent yet"
            description="Compose a message to begin school-wide communication."
          />
        ) : (
          <div className="message-thread-list">
            {items.map((item) => (
              <article className="card panel message-thread-card" key={item.id}>
                <div className="message-thread-head">
                  <div>
                    <h3>{item.subject ?? 'No subject'}</h3>
                    <p className="muted-text">
                      To {item.receiver.name} · {item.receiver.role}
                    </p>
                  </div>
                  <div className="chip-list">
                    <Badge tone={item.isRead ? 'success' : 'warning'}>
                      {item.isRead ? 'Read' : 'Unread'}
                    </Badge>
                    <Badge tone="neutral">{formatDate(item.createdAt)}</Badge>
                  </div>
                </div>

                <p className="message-thread-body">{item.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
