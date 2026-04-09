'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { StudentResultHistorySummary } from '@/utils/api';

interface ResultSummaryCardProps {
  summary: StudentResultHistorySummary;
}

export function ResultSummaryCard({ summary }: ResultSummaryCardProps) {
  if (summary.overall.examCount === 0) {
    return (
      <EmptyState
        description="Exam summaries will appear here when results are published for this student."
        title="No result summary available."
      />
    );
  }

  return (
    <div className="history-stack">
      <div className="summary-cards-grid">
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Exams</Badge>
          </div>
          <strong>{summary.overall.examCount}</strong>
          <span>Total published result cards</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="success">Average</Badge>
          </div>
          <strong>{summary.overall.averagePercentage}%</strong>
          <span>Average percentage</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Obtained</Badge>
          </div>
          <strong>{summary.overall.obtainedMarks}</strong>
          <span>Total obtained marks</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Total</Badge>
          </div>
          <strong>{summary.overall.totalMarks}</strong>
          <span>Total maximum marks</span>
        </article>
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Result History by Session</h2>
            <p className="muted-text">
              Exam-wise result records grouped by academic session.
            </p>
          </div>
        </div>

        <div className="history-summary-list">
          {summary.bySession.map((sessionSummary) => (
            <article className="history-result-block" key={sessionSummary.session.id}>
              <div className="history-result-header">
                <div>
                  <strong>{sessionSummary.session.name}</strong>
                  <p className="muted-text">
                    {sessionSummary.examCount} exam{sessionSummary.examCount === 1 ? '' : 's'} •{' '}
                    {sessionSummary.averagePercentage}% average
                  </p>
                </div>
              </div>
              <div className="history-summary-list nested-history-list">
                {sessionSummary.results.map((result) => (
                  <article className="history-summary-item" key={result.id}>
                    <div>
                      <strong>{result.examName}</strong>
                      <p className="muted-text">
                        {result.examCode} • {result.examType}
                      </p>
                    </div>
                    <div className="history-inline-metrics">
                      <span>
                        {result.obtainedMarks}/{result.totalMarks}
                      </span>
                      <span>{result.percentage}%</span>
                      <strong>{result.grade ?? '-'}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
