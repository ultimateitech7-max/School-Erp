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
  type StudentPortalResultsPayload,
} from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function StudentResultsPage() {
  const [payload, setPayload] = useState<StudentPortalResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<StudentPortalResultsPayload>>(
      `/student/results${createQueryString({
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error ? error.message : 'Failed to load results.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const sessions = useMemo(() => payload?.resultSummary.bySession ?? [], [payload]);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading results..." />
      </section>
    );
  }

  if (!payload) {
    return (
      <EmptyState
        title="Results unavailable"
        description={message ?? 'Result summary could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Exam Results</h2>
            <p className="muted-text">{payload.student.name}</p>
          </div>
          <Field className="portal-filter-field" label="Academic Session">
            <Select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">All sessions</option>
              {sessions.map((entry) => (
                <option key={entry.session.id} value={entry.session.id}>
                  {entry.session.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="summary-cards-grid compact-grid">
          <article className="subtle-card">
            <span className="eyebrow">Average</span>
            <strong>{payload.resultSummary.overall.averagePercentage}%</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Exams</span>
            <strong>{payload.resultSummary.overall.examCount}</strong>
          </article>
        </div>

        {payload.resultSummary.bySession.length ? (
          <div className="timeline-list">
            {payload.resultSummary.bySession.flatMap((session) =>
              session.results.map((result) => (
                <article className="subtle-card" key={result.id}>
                  <div className="portal-detail-row">
                    <strong>{result.examName}</strong>
                    <span>{result.percentage}%</span>
                  </div>
                  <p className="muted-text">
                    {session.session.name} • Grade {result.grade ?? 'N/A'} •{' '}
                    {formatDate(result.startDate)}
                  </p>
                </article>
              )),
            )}
          </div>
        ) : (
          <EmptyState
            title="No results available"
            description="Results will appear after exams are published."
          />
        )}
      </section>
    </div>
  );
}
