'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type ParentDashboardPayload,
  type StudentPortalExamsPayload,
} from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function ParentExamsPage() {
  const searchParams = useSearchParams();
  const requestedStudentId = searchParams.get('studentId') ?? '';
  const [dashboard, setDashboard] = useState<ParentDashboardPayload | null>(null);
  const [payload, setPayload] = useState<StudentPortalExamsPayload | null>(null);
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setLoadingDashboard(true);
    setMessage(null);

    void apiFetch<ApiSuccessResponse<ParentDashboardPayload>>('/parent/dashboard')
      .then((response) => {
        setDashboard(response.data);
        setStudentId(
          response.data.children.find((child) => child.id === requestedStudentId)?.id ??
            response.data.children[0]?.id ??
            '',
        );
      })
      .catch((error) => {
        setDashboard(null);
        setMessage(
          error instanceof Error ? error.message : 'Failed to load linked children.',
        );
      })
      .finally(() => {
        setLoadingDashboard(false);
      });
  }, [requestedStudentId]);

  useEffect(() => {
    if (loadingDashboard) {
      return;
    }

    if (!studentId) {
      setPayload(null);
      setLoadingDetail(false);
      return;
    }

    setLoadingDetail(true);
    setMessage(null);

    void apiFetch<ApiSuccessResponse<StudentPortalExamsPayload>>(
      `/parent/exams${createQueryString({
        studentId,
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setPayload(null);
        setMessage(
          error instanceof Error ? error.message : 'Failed to load child exams.',
        );
      })
      .finally(() => {
        setLoadingDetail(false);
      });
  }, [loadingDashboard, sessionId, studentId]);

  useEffect(() => {
    setSessionId('');
  }, [studentId]);

  const sessions = useMemo(() => payload?.sessions ?? [], [payload]);

  if (loadingDashboard || loadingDetail) {
    return (
      <section className="card panel">
        <Spinner label="Loading exams..." />
      </section>
    );
  }

  if (!dashboard?.children.length) {
    return (
      <EmptyState
        title="No linked children"
        description={message ?? 'Link at least one child to view exams.'}
      />
    );
  }

  if (!payload) {
    return (
      <EmptyState
        title="Exams unavailable"
        description={message ?? 'Child exam data could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Child Exams</h2>
            <p className="muted-text">{payload.student.name}</p>
          </div>
          <div className="toolbar-actions">
            <Field className="portal-filter-field" label="Child">
              <Select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                {dashboard.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="portal-filter-field" label="Academic Session">
              <Select
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              >
                <option value="">All sessions</option>
                {sessions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="summary-cards-grid compact-grid">
          <article className="subtle-card">
            <span className="eyebrow">Upcoming Date Sheets</span>
            <strong>{payload.upcomingDateSheets.length}</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Completed Exams</span>
            <strong>{payload.completedExams.length}</strong>
          </article>
        </div>
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Upcoming Exams</h2>
            <p className="muted-text">
              Published date sheets for the selected child.
            </p>
          </div>
        </div>

        {payload.upcomingDateSheets.length ? (
          <div className="timeline-list">
            {payload.upcomingDateSheets.map((sheet) => (
              <article className="subtle-card" key={sheet.id}>
                <div className="portal-detail-row">
                  <strong>{sheet.examName}</strong>
                  <span>{sheet.class.name}</span>
                </div>
                <div className="detail-list">
                  {sheet.entries.map((entry) => (
                    <div key={entry.id}>
                      <dt>{entry.subject.name}</dt>
                      <dd>
                        {formatDate(entry.examDate)} • {entry.startTime} - {entry.endTime}
                      </dd>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No upcoming exams"
            description="Published date sheets for this child will appear here."
          />
        )}
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Completed Exams</h2>
            <p className="muted-text">
              Published performance summary for completed exams.
            </p>
          </div>
        </div>

        {payload.completedExams.length ? (
          <div className="timeline-list">
            {payload.completedExams.map((exam) => (
              <article className="subtle-card" key={exam.id}>
                <div className="portal-detail-row">
                  <strong>{exam.examName}</strong>
                  <span>{exam.percentage}%</span>
                </div>
                <p className="muted-text">
                  {formatDate(exam.startDate)} • Grade {exam.grade ?? 'N/A'}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No completed exams yet"
            description="Completed exams will appear after marks are published."
          />
        )}
      </section>
    </div>
  );
}
