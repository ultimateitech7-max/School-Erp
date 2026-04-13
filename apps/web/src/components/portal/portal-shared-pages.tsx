'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HolidayYearCalendar } from '@/components/ui/holiday-year-calendar';
import { MessageChatWorkspace } from '@/components/messages/chat-workspace';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type HolidayRecord,
  type HomeworkRecord,
  type NoticeRecord,
} from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

interface SharedPageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

interface PortalNoticeGridProps {
  items: NoticeRecord[];
  emptyTitle: string;
  emptyDescription: string;
}

export function PortalNoticeGrid({
  items,
  emptyTitle,
  emptyDescription,
}: PortalNoticeGridProps) {
  const [selectedNotice, setSelectedNotice] = useState<NoticeRecord | null>(null);

  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="portal-notice-list">
        {items.map((item) => (
          <article
            className="subtle-card portal-notice-card"
            key={item.id}
            onClick={() => setSelectedNotice(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedNotice(item);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="portal-notice-head">
              <strong>{item.title}</strong>
              <Badge tone="info">{item.audienceType}</Badge>
            </div>
            <p className="muted-text portal-card-copy">{item.description}</p>
            <div className="portal-card-footer">
              <span className="portal-card-meta">
                {item.expiryDate
                  ? `Visible until ${formatDate(item.expiryDate)}`
                  : 'Published notice'}
              </span>
              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedNotice(item);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Read full
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        className="portal-notice-modal"
        description={
          selectedNotice?.expiryDate
            ? `Visible until ${formatDate(selectedNotice.expiryDate)}`
            : 'Published school notice'
        }
        footer={
          <Button onClick={() => setSelectedNotice(null)} type="button" variant="secondary">
            Close
          </Button>
        }
        onClose={() => setSelectedNotice(null)}
        open={Boolean(selectedNotice)}
        title={selectedNotice?.title ?? 'Notice detail'}
      >
        {selectedNotice ? (
          <div className="notice-modal-copy">
            <div className="chip-list">
              <Badge tone="info">{selectedNotice.audienceType}</Badge>
            </div>
            <p>{selectedNotice.description}</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export function PortalHomeworkPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: SharedPageProps) {
  const [items, setItems] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkRecord | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void apiFetch<ApiSuccessResponse<HomeworkRecord[]>>('/homework/portal')
      .then((response) => {
        setItems(response.data);
      })
      .catch((loadError) => {
        setItems([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load homework.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading homework..." />
      </section>
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">{description}</p>
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {items.length ? (
        <>
          <div className="portal-homework-list">
            {items.map((item) => (
              <article
                className="subtle-card portal-homework-card"
                key={item.id}
                onClick={() => setSelectedHomework(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedHomework(item);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="portal-homework-top">
                  <strong>{item.title}</strong>
                  <Badge tone="warning">Due {formatDate(item.dueDate)}</Badge>
                </div>
                <div className="portal-homework-meta">
                  <span>
                    {item.class.name}
                    {item.section ? ` • ${item.section.name}` : ''}
                  </span>
                  <span>
                    {item.subject.name} • {item.teacher.name}
                  </span>
                </div>
                <p className="muted-text portal-homework-copy">{item.description}</p>
                <div className="portal-card-footer">
                  <span className="portal-card-meta">Tap to view full homework</span>
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedHomework(item);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Open
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <Modal
            className="portal-notice-modal"
            description={
              selectedHomework
                ? `Due ${formatDate(selectedHomework.dueDate)}`
                : 'Homework detail'
            }
            footer={
              <Button
                onClick={() => setSelectedHomework(null)}
                type="button"
                variant="secondary"
              >
                Close
              </Button>
            }
            onClose={() => setSelectedHomework(null)}
            open={Boolean(selectedHomework)}
            title={selectedHomework?.title ?? 'Homework detail'}
          >
            {selectedHomework ? (
              <div className="notice-modal-copy">
                <div className="chip-list">
                  <Badge tone="info">
                    {selectedHomework.class.name}
                    {selectedHomework.section ? ` • ${selectedHomework.section.name}` : ''}
                  </Badge>
                  <Badge tone="neutral">{selectedHomework.subject.name}</Badge>
                </div>
                <p className="muted-text">
                  {selectedHomework.teacher.name} • Due {formatDate(selectedHomework.dueDate)}
                </p>
                <p>{selectedHomework.description}</p>
              </div>
            ) : null}
          </Modal>
        </>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </section>
  );
}

export function PortalNoticePage({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: SharedPageProps) {
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
            : 'Failed to load notices.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading notices..." />
      </section>
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">{description}</p>
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <PortalNoticeGrid
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        items={items}
      />
    </section>
  );
}

export function PortalHolidayPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: SharedPageProps) {
  const [items, setItems] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void apiFetch<ApiSuccessResponse<HolidayRecord[]>>('/holidays/portal')
      .then((response) => {
        setItems(response.data);
      })
      .catch((loadError) => {
        setItems([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load holidays.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading holidays..." />
      </section>
    );
  }

  return (
    <section className="card panel">
      {error ? <Banner tone="error">{error}</Banner> : null}

      <HolidayYearCalendar
        description={description}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        items={items}
        title={title}
      />
    </section>
  );
}

interface PortalMessagePageProps {
  title: string;
  description: string;
}

export function PortalMessagePage({
  title,
  description,
}: PortalMessagePageProps) {
  return <MessageChatWorkspace description={description} title={title} />;
}
