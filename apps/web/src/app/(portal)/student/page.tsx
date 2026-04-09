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
  type StudentPortalDashboardPayload,
} from '@/utils/api';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function StudentPortalPage() {
  const [payload, setPayload] = useState<StudentPortalDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<StudentPortalDashboardPayload>>('/student/dashboard')
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load student dashboard.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading student portal..." />
      </section>
    );
  }

  if (!payload) {
    return (
      <EmptyState
        title="Student portal unavailable"
        description={message ?? 'Student dashboard could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel portal-intro-card">
        <div>
          <span className="eyebrow">Student Profile</span>
          <h2>{payload.student.name}</h2>
          <p className="muted-text">
            {payload.student.registrationNumber ?? 'Registration pending'}
          </p>
        </div>
        <div className="chip-list">
          <Badge tone="info">{payload.currentEnrollment?.class.name ?? 'Class pending'}</Badge>
          <Badge tone="neutral">
            {payload.currentEnrollment?.section?.name ?? 'Section pending'}
          </Badge>
        </div>
      </section>

      <div className="summary-cards-grid compact-grid portal-summary-grid">
        <article className="subtle-card">
          <span className="eyebrow">Attendance</span>
          <strong>{payload.attendanceSummary.overall.percentage}%</strong>
          <span className="muted-text">
            {payload.attendanceSummary.overall.present} present out of{' '}
            {payload.attendanceSummary.overall.totalDays}
          </span>
          <Link className="text-link" href="/student/attendance">
            View attendance
          </Link>
        </article>
        <article className="subtle-card">
          <span className="eyebrow">Fees</span>
          <strong>{formatCurrency(payload.feeSummary.overall.totalDue)}</strong>
          <span className="muted-text">
            Paid {formatCurrency(payload.feeSummary.overall.totalPaid)}
          </span>
          <Link className="text-link" href="/student/fees">
            View fees
          </Link>
        </article>
        <article className="subtle-card">
          <span className="eyebrow">Results</span>
          <strong>{payload.resultSummary.overall.averagePercentage}%</strong>
          <span className="muted-text">
            {payload.resultSummary.overall.examCount} exams recorded
          </span>
          <Link className="text-link" href="/student/results">
            View results
          </Link>
        </article>
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Homework</h2>
            <p className="muted-text">
              Upcoming assignments targeted to your class and section.
            </p>
          </div>
        </div>

        {payload.homework.length ? (
          <div className="portal-notice-list">
            {payload.homework.map((item) => (
              <article className="subtle-card portal-notice-card" key={item.id}>
                <div className="portal-notice-head">
                  <strong>{item.title}</strong>
                  <Badge tone="warning">
                    Due {new Date(item.dueDate).toLocaleDateString('en-IN')}
                  </Badge>
                </div>
                <p className="muted-text">
                  {item.subject.name} • {item.teacher.name}
                </p>
                <p className="muted-text">{item.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No homework assigned"
            description="New assignments will appear here when teachers publish them."
          />
        )}
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Holiday Calendar</h2>
            <p className="muted-text">
              Upcoming holidays and school events for your academic calendar.
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
            description="Published holiday calendar items will appear here."
          />
        )}
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Notice Board</h2>
            <p className="muted-text">
              Stay updated with student-specific school announcements.
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
            description="Published student notices will appear here."
          />
        )}
      </section>
    </div>
  );
}
