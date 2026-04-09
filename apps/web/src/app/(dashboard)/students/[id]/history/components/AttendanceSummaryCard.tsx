'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { StudentAttendanceHistorySummary } from '@/utils/api';

interface AttendanceSummaryCardProps {
  summary: StudentAttendanceHistorySummary;
}

export function AttendanceSummaryCard({
  summary,
}: AttendanceSummaryCardProps) {
  if (summary.overall.totalDays === 0) {
    return (
      <EmptyState
        description="Attendance summaries will appear once attendance is marked for this student."
        title="No attendance summary available."
      />
    );
  }

  return (
    <div className="history-stack">
      <div className="summary-cards-grid">
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Attendance</Badge>
          </div>
          <strong>{summary.overall.totalDays}</strong>
          <span>Total recorded days</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="success">Present</Badge>
          </div>
          <strong>{summary.overall.present}</strong>
          <span>{summary.overall.percentage}% attendance</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="warning">Absent</Badge>
          </div>
          <strong>{summary.overall.absent}</strong>
          <span>Recorded absences</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Late / Leave</Badge>
          </div>
          <strong>
            {summary.overall.late} / {summary.overall.leave}
          </strong>
          <span>Late and leave totals</span>
        </article>
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Attendance by Session</h2>
            <p className="muted-text">Session-wise attendance breakdown.</p>
          </div>
        </div>

        <div className="history-summary-list">
          {summary.bySession.map((item) => (
            <article className="history-summary-item" key={item.session.id}>
              <div>
                <strong>{item.session.name}</strong>
                <p className="muted-text">
                  {item.session.isCurrent ? 'Current session' : 'Archived session'}
                </p>
              </div>
              <div className="history-inline-metrics">
                <span>P: {item.present}</span>
                <span>A: {item.absent}</span>
                <span>L: {item.late}</span>
                <span>Lv: {item.leave}</span>
                <strong>{item.percentage}%</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
