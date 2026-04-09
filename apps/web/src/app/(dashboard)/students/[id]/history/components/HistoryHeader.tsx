'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { StudentHistoryBasicRecord } from '@/utils/api';

interface HistoryHeaderProps {
  student: StudentHistoryBasicRecord;
}

export function HistoryHeader({ student }: HistoryHeaderProps) {
  return (
    <section className="page-header history-header">
      <div>
        <p className="eyebrow">Student Timeline</p>
        <h1>{student.name}</h1>
        <p>
          {student.registrationNumber ?? student.studentCode}
          {student.admissionNo ? ` • ${student.admissionNo}` : ''}
          {student.class?.name ? ` • ${student.class.name}` : ''}
          {student.section?.name ? ` • ${student.section.name}` : ''}
        </p>
      </div>
      <div className="page-header-meta">
        <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
          {student.status}
        </Badge>
        <Link
          className="ui-button ui-button-secondary ui-button-md"
          href={`/students/${student.id}`}
        >
          Back to Student
        </Link>
      </div>
    </section>
  );
}
