'use client';

import type {
  DashboardExamSummaryRecord,
  DashboardRecentActivityRecord,
} from '@/utils/api';

interface RecentActivityProps {
  items: DashboardRecentActivityRecord[];
  examSummary: DashboardExamSummaryRecord;
}

export function RecentActivity({ items, examSummary }: RecentActivityProps) {
  return (
    <div className="activity-layout">
      <div className="activity-feed">
        {items.length === 0 ? (
          <div className="empty-state">
            <strong>No recent activity</strong>
            <p className="muted-text">
              New activity will appear here as your school uses the platform.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <article className="activity-item" key={item.id}>
              <div className={`activity-badge activity-badge-${item.type}`}>
                {item.type.slice(0, 1).toUpperCase()}
              </div>
              <div className="activity-copy">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <span>{new Date(item.timestamp).toLocaleString('en-IN')}</span>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="exam-summary-grid">
        <article className="card exam-summary-card">
          <p>Total Exams</p>
          <strong>{examSummary.total}</strong>
        </article>
        <article className="card exam-summary-card">
          <p>Published</p>
          <strong>{examSummary.published}</strong>
        </article>
        <article className="card exam-summary-card">
          <p>Ongoing</p>
          <strong>{examSummary.ongoing}</strong>
        </article>
        <article className="card exam-summary-card">
          <p>Avg. Result</p>
          <strong>{examSummary.averagePercentage.toFixed(1)}%</strong>
        </article>
      </div>
    </div>
  );
}
