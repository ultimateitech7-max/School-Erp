'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type StudentPortalExamsPayload,
} from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function StudentExamsPage() {
  const [payload, setPayload] = useState<StudentPortalExamsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setLoading(true);
    setMessage(null);

    void apiFetch<ApiSuccessResponse<StudentPortalExamsPayload>>(
      `/student/exams${createQueryString({
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setPayload(null);
        setMessage(
          error instanceof Error ? error.message : 'Failed to load exams.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const sessions = useMemo(() => payload?.sessions ?? [], [payload]);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading exams..." />
      </section>
    );
  }

  if (!payload) {
    return (
      <EmptyState
        title="Exams unavailable"
        description={message ?? 'Exam schedule could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Exam Planner</h2>
            <p className="muted-text">{payload.student.name}</p>
          </div>
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
              Published date sheets for your class appear here.
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
            description="Published date sheets will appear here once your school schedules them."
          />
        )}
      </section>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Completed Exams</h2>
            <p className="muted-text">
              Published exam history and recorded performance.
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
            description="Completed exams will appear here after marks are published."
          />
        )}
      </section>
    </div>
  );
}
