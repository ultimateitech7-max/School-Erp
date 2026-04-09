'use client';

import { Badge } from '@/components/ui/badge';
import type {
  PromotionRecord,
  StudentEnrollmentHistoryRecord,
  StudentHistoryBasicRecord,
} from '@/utils/api';

interface AcademicJourneyCardProps {
  student: StudentHistoryBasicRecord;
  enrollmentHistory: StudentEnrollmentHistoryRecord[];
  promotionHistory: PromotionRecord[];
}

export function AcademicJourneyCard({
  student,
  enrollmentHistory,
  promotionHistory,
}: AcademicJourneyCardProps) {
  const currentEnrollment =
    enrollmentHistory.find((item) => item.session.isCurrent) ??
    enrollmentHistory[enrollmentHistory.length - 1] ??
    null;

  const promotedCount = promotionHistory.filter(
    (item) => item.action === 'PROMOTED',
  ).length;
  const detainedCount = promotionHistory.filter(
    (item) => item.action === 'DETAINED',
  ).length;

  return (
    <section className="card panel academic-journey-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Academic Journey</p>
          <h2>Current academic standing</h2>
          <p className="muted-text">
            Quick snapshot of the student&apos;s active position and preserved progress.
          </p>
        </div>
        {currentEnrollment ? (
          <Badge tone="success">{currentEnrollment.session.name}</Badge>
        ) : null}
      </div>

      <div className="summary-cards-grid">
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Current Class</Badge>
          </div>
          <strong>{currentEnrollment?.class.name ?? student.class?.name ?? '-'}</strong>
          <span>{currentEnrollment?.section?.name ?? student.section?.name ?? 'No section'}</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Current Session</Badge>
          </div>
          <strong>{currentEnrollment?.session.name ?? '-'}</strong>
          <span>{currentEnrollment?.session.isCurrent ? 'Live session' : 'Archived session'}</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="success">Sessions</Badge>
          </div>
          <strong>{enrollmentHistory.length}</strong>
          <span>Total sessions completed</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <div className="summary-card-top">
            <Badge tone="warning">Promotion Stats</Badge>
          </div>
          <strong>
            {promotedCount} / {detainedCount}
          </strong>
          <span>Promoted / detained actions</span>
        </article>
      </div>
    </section>
  );
}
