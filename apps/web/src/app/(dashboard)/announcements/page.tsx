'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { getStoredAuthSession } from '@/utils/auth-storage';
import { apiFetch, type ApiSuccessResponse, type NoticeRecord } from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function AnnouncementsPage() {
  const session = getStoredAuthSession();
  const [items, setItems] = useState<NoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void apiFetch<ApiSuccessResponse<NoticeRecord[]>>('/notices/portal')
      .then((response) => {
        setItems(response.data);
      })
      .catch((loadError) => {
        setItems([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load announcements.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (!session?.permissions.includes('communication.read')) {
    return (
      <section className="card panel">
        <h2>Announcements Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to access announcements.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading announcements..." />
      </section>
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Announcements</h2>
          <p className="muted-text">
            Read school updates, role-targeted notices, and important reminders.
          </p>
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {items.length ? (
        <div className="portal-notice-list">
          {items.map((item) => (
            <article className="subtle-card portal-notice-card" key={item.id}>
              <div className="portal-notice-head">
                <strong>{item.title}</strong>
                <Badge tone="info">{item.audienceType}</Badge>
              </div>
              <p className="muted-text">{item.description}</p>
              {item.expiryDate ? (
                <p className="muted-text">Visible until {formatDate(item.expiryDate)}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No active announcements"
          description="Published role-targeted notices will appear here."
        />
      )}
    </section>
  );
}
