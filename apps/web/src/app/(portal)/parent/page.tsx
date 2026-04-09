'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type ParentDashboardPayload,
} from '@/utils/api';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    style: 'currency',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ParentPortalPage() {
  const [payload, setPayload] = useState<ParentDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<ParentDashboardPayload>>('/parent/dashboard')
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load parent dashboard.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading children..." />
      </section>
    );
  }

  if (!payload) {
    return (
      <EmptyState
        description={message ?? 'Parent dashboard could not be loaded.'}
        title="Portal unavailable"
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel portal-intro-card">
        <div>
          <span className="eyebrow">Guardian Profile</span>
          <h2>{payload.parent.fullName}</h2>
          <p className="muted-text">
            {payload.parent.phone}
            {payload.parent.email ? ` • ${payload.parent.email}` : ''}
          </p>
        </div>
        <Badge tone="info">{payload.parent.relationType}</Badge>
      </section>

      <div className="portal-children-grid">
        {payload.children.length ? (
          payload.children.map((child) => (
            <article className="card panel portal-child-card" key={child.id}>
              <div className="portal-child-head">
                <div>
                  <h3>{child.name}</h3>
                  <p className="muted-text">
                    {child.registrationNumber ?? 'Registration pending'}
                  </p>
                </div>
                <Badge tone="success">{child.relationType}</Badge>
              </div>

              <div className="detail-list">
                <div>
                  <dt>Class</dt>
                  <dd>{child.class?.name ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Section</dt>
                  <dd>{child.section?.name ?? 'Not assigned'}</dd>
                </div>
              </div>

              <div className="summary-cards-grid compact-grid">
                <article className="subtle-card">
                  <span className="eyebrow">Attendance</span>
                  <strong>{child.attendanceSummary.present}</strong>
                  <span className="muted-text">
                    {child.attendanceSummary.totalDays} total days •{' '}
                    {child.attendanceSummary.percentage}%
                  </span>
                </article>
                <article className="subtle-card">
                  <span className="eyebrow">Fees Due</span>
                  <strong>{formatCurrency(child.feeSummary.totalDue)}</strong>
                  <span className="muted-text">
                    Paid {formatCurrency(child.feeSummary.totalPaid)}
                  </span>
                </article>
              </div>

              <div className="chip-list">
                <Link className="text-link" href={`/parent/attendance?studentId=${child.id}`}>
                  Attendance
                </Link>
                <Link className="text-link" href={`/parent/fees?studentId=${child.id}`}>
                  Fees
                </Link>
                <Link className="text-link" href={`/parent/results?studentId=${child.id}`}>
                  Results
                </Link>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            description="This parent account is active but no students are linked yet."
            title="No linked children"
          />
        )}
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Holiday Calendar</h2>
            <p className="muted-text">
              Upcoming holidays and school events relevant to your family schedule.
            </p>
          </div>
        </div>

        {payload.holidays.length ? (
          <div className="portal-notice-list">
            {payload.holidays.map((item) => (
              <article className="subtle-card portal-notice-card" key={item.id}>
                <div className="portal-notice-head">
                  <strong>{item.title}</strong>
                  <Badge tone={item.type === 'HOLIDAY' ? 'success' : 'info'}>
                    {item.type}
                  </Badge>
                </div>
                <p className="muted-text">
                  {new Date(item.startDate).toLocaleDateString('en-IN')} to{' '}
                  {new Date(item.endDate).toLocaleDateString('en-IN')}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No upcoming holidays"
            description="Calendar updates published by the school will appear here."
          />
        )}
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Notice Board</h2>
            <p className="muted-text">
              Published notices targeted to parents and guardians.
            </p>
          </div>
        </div>

        {payload.notices.length ? (
          <div className="portal-notice-list">
            {payload.notices.map((notice) => (
              <article className="subtle-card portal-notice-card" key={notice.id}>
                <div className="portal-notice-head">
                  <strong>{notice.title}</strong>
                  <Badge tone="info">{notice.audienceType}</Badge>
                </div>
                <p className="muted-text">{notice.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No active notices"
            description="Published parent notices will appear here."
          />
        )}
      </section>
    </div>
  );
}
