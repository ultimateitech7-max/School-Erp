'use client';

import { useEffect, useMemo, useState } from 'react';
import { AttendanceMonthCalendar } from '@/components/ui/attendance-month-calendar';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type StudentPortalAttendancePayload,
} from '@/utils/api';

export default function StudentAttendancePage() {
  const [payload, setPayload] = useState<StudentPortalAttendancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<StudentPortalAttendancePayload>>(
      `/student/attendance${createQueryString({
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error ? error.message : 'Failed to load attendance.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const sessions = useMemo(
    () => payload?.attendanceSummary.bySession ?? [],
    [payload?.attendanceSummary.bySession],
  );

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading attendance..." />
      </section>
    );
  }

  if (!payload) {
    return (
      <EmptyState
        title="Attendance unavailable"
        description={message ?? 'Attendance summary could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance Summary</h2>
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
            <span className="eyebrow">Present</span>
            <strong>{payload.attendanceSummary.overall.present}</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Absent</span>
            <strong>{payload.attendanceSummary.overall.absent}</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Percentage</span>
            <strong>{payload.attendanceSummary.overall.percentage}%</strong>
          </article>
        </div>

        {payload.attendanceSummary.bySession.length ? (
          <AttendanceMonthCalendar
            description="Calendar view of present, absent, and late dates."
            emptyDescription="Attendance records will appear here once teachers mark classes."
            emptyTitle="No attendance records"
            records={payload.attendanceSummary.records}
            title="Date-wise Attendance"
          />
        ) : (
          <EmptyState
            title="No attendance records"
            description="Attendance records will appear once teachers start marking classes."
          />
        )}
      </section>
    </div>
  );
}
