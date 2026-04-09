'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { StudentFeeHistorySummary } from '@/utils/api';

interface FeeSummaryCardProps {
  summary: StudentFeeHistorySummary;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function FeeSummaryCard({ summary }: FeeSummaryCardProps) {
  if (summary.overall.assignmentsCount === 0) {
    return (
      <EmptyState
        description="Fee history will appear here once assignments are created for this student."
        title="No fee summary available."
      />
    );
  }

  return (
    <div className="history-stack">
      <div className="summary-cards-grid">
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Assignments</Badge>
          </div>
          <strong>{summary.overall.assignmentsCount}</strong>
          <span>Fee assignments linked</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="success">Paid</Badge>
          </div>
          <strong>{formatCurrency(summary.overall.totalPaid)}</strong>
          <span>Total collected</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Assigned</Badge>
          </div>
          <strong>{formatCurrency(summary.overall.totalAssigned)}</strong>
          <span>Total assigned amount</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="warning">Due</Badge>
          </div>
          <strong>{formatCurrency(summary.overall.totalDue)}</strong>
          <span>Outstanding balance</span>
        </article>
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Fee Summary by Session</h2>
            <p className="muted-text">Paid and due amounts grouped by academic session.</p>
          </div>
        </div>

        <div className="history-summary-list">
          {summary.bySession.map((item) => (
            <article className="history-summary-item" key={item.session.id}>
              <div>
                <strong>{item.session.name}</strong>
                <p className="muted-text">
                  {item.assignmentsCount} assignment{item.assignmentsCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="history-inline-metrics">
                <span>Assigned: {formatCurrency(item.totalAssigned)}</span>
                <span>Paid: {formatCurrency(item.totalPaid)}</span>
                <strong>Due: {formatCurrency(item.totalDue)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
