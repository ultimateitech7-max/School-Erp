'use client';

import { EmptyState } from '@/components/ui/empty-state';
import type {
  PromotionRecord,
  StudentEnrollmentHistoryRecord,
  StudentResultHistorySummary,
} from '@/utils/api';
import { TimelineItem, type TimelineItemRecord } from './TimelineItem';

interface StudentTimelineProps {
  enrollmentHistory: StudentEnrollmentHistoryRecord[];
  promotionHistory: PromotionRecord[];
  resultSummary: StudentResultHistorySummary;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function StudentTimeline({
  enrollmentHistory,
  promotionHistory,
  resultSummary,
}: StudentTimelineProps) {
  const enrollmentItems: TimelineItemRecord[] = enrollmentHistory.map((record) => ({
    id: `enrollment-${record.id}`,
    type: 'ENROLLED',
    title: `Enrolled in ${record.class.name}${record.section ? ` • ${record.section.name}` : ''}`,
    description: `${record.session.name} academic session`,
    dateLabel: formatDate(record.admissionDate),
    sortValue: record.admissionDate,
    meta: `Admission ${record.admissionNo}${record.rollNo ? ` • Roll ${record.rollNo}` : ''}`,
    tone: 'info',
  }));

  const promotionItems: TimelineItemRecord[] = promotionHistory.map((record) => ({
    id: `promotion-${record.id}`,
    type: record.action,
    title:
      record.action === 'PROMOTED'
        ? `Promoted to ${record.toClass.name}${record.toSection ? ` • ${record.toSection.name}` : ''}`
        : `Detained in ${record.toClass.name}${record.toSection ? ` • ${record.toSection.name}` : ''}`,
    description: `${record.fromAcademicSession.name} to ${record.toAcademicSession.name}`,
    dateLabel: formatDate(record.promotedAt),
    sortValue: record.promotedAt,
    meta: record.remarks ?? `Actioned by ${record.promotedBy?.name ?? 'System'}`,
    tone: record.action === 'PROMOTED' ? 'success' : 'warning',
  }));

  const resultItems: TimelineItemRecord[] = resultSummary.bySession.flatMap((sessionSummary) =>
    sessionSummary.results.map((result) => ({
      id: `result-${result.id}`,
      type: 'RESULT',
      title: `${result.examName} result published`,
      description: `${sessionSummary.session.name} • ${result.percentage}% • Grade ${result.grade ?? '-'}`,
      dateLabel: formatDate(result.publishedAt ?? result.createdAt),
      sortValue: result.publishedAt ?? result.createdAt,
      meta: `${result.obtainedMarks}/${result.totalMarks} marks`,
      tone: 'info',
    })),
  );

  const items = [...enrollmentItems, ...promotionItems, ...resultItems].sort(
    (left, right) =>
      new Date(left.sortValue).getTime() - new Date(right.sortValue).getTime(),
  );

  if (items.length === 0) {
    return (
      <EmptyState
        description="As the student progresses, enrollments, promotions, and results will appear here."
        title="No academic timeline available."
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Academic Timeline</h2>
          <p className="muted-text">
            A readable journey of enrollments, promotions, detentions, and results.
          </p>
        </div>
      </div>

      <div className="timeline-list">
        {items.map((item, index) => (
          <TimelineItem
            key={item.id}
            isLatest={index === items.length - 1}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}
