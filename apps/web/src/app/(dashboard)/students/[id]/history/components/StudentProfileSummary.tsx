'use client';

import { Badge } from '@/components/ui/badge';
import type { StudentHistoryBasicRecord } from '@/utils/api';

interface StudentProfileSummaryProps {
  student: StudentHistoryBasicRecord;
}

export function StudentProfileSummary({
  student,
}: StudentProfileSummaryProps) {
  return (
    <div className="summary-cards-grid">
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone="success">Registration</Badge>
        </div>
        <strong>{student.registrationNumber ?? '-'}</strong>
        <span>Permanent registration number</span>
      </article>
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone="info">Student Code</Badge>
        </div>
        <strong>{student.studentCode}</strong>
        <span>School student code</span>
      </article>
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone="info">Admission</Badge>
        </div>
        <strong>{student.admissionNo ?? '-'}</strong>
        <span>Current admission number</span>
      </article>
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
            {student.status}
          </Badge>
        </div>
        <strong>{student.class?.name ?? '-'}</strong>
        <span>{student.section?.name ?? 'No section assigned'}</span>
      </article>
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone="info">Email</Badge>
        </div>
        <strong>{student.email ?? '-'}</strong>
        <span>Student email</span>
      </article>
      <article className="card summary-card compact-summary-card">
        <div className="summary-card-top">
          <Badge tone="info">Phone</Badge>
        </div>
        <strong>{student.phone ?? '-'}</strong>
        <span>Student phone</span>
      </article>
    </div>
  );
}
