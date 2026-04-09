'use client';

import { useEffect, useState } from 'react';
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
  type ParentPortalDetailPayload,
} from '@/utils/api';

export default function ParentResultsPage() {
  const searchParams = useSearchParams();
  const requestedStudentId = searchParams.get('studentId') ?? '';
  const [dashboard, setDashboard] = useState<ParentDashboardPayload | null>(null);
  const [payload, setPayload] = useState<ParentPortalDetailPayload | null>(null);
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<ParentDashboardPayload>>('/parent/dashboard')
      .then((response) => {
        setDashboard(response.data);
        const defaultStudentId =
          response.data.children.find((child) => child.id === requestedStudentId)?.id ??
          response.data.children[0]?.id ??
          '';
        setStudentId((current) => current || defaultStudentId);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Failed to load children.');
      });
  }, [requestedStudentId]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void apiFetch<ApiSuccessResponse<ParentPortalDetailPayload>>(
      `/parent/results${createQueryString({
        studentId,
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Failed to load results.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId, sessionId]);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading results..." />
      </section>
    );
  }

  if (!dashboard?.children.length) {
    return (
      <EmptyState
        title="No linked children"
        description={message ?? 'Link at least one child to view results.'}
      />
    );
  }

  if (!payload?.resultSummary) {
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
            <h2>Child Results</h2>
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
                {payload.resultSummary.bySession.map((entry) => (
                  <option key={entry.session.id} value={entry.session.id}>
                    {entry.session.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
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
                    {session.session.name} • Grade {result.grade ?? 'N/A'}
                  </p>
                </article>
              )),
            )}
          </div>
        ) : (
          <EmptyState
            title="No result history"
            description="Results will appear after report cards are published."
          />
        )}
      </section>
    </div>
  );
}
