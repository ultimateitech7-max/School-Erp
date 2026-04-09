'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type { StudentEnrollmentHistoryRecord } from '@/utils/api';

interface EnrollmentHistoryTableProps {
  records: StudentEnrollmentHistoryRecord[];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function EnrollmentHistoryTable({
  records,
}: EnrollmentHistoryTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        description="Enrollment records will appear as the student progresses across sessions."
        title="No enrollment history found."
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Enrollment History</h2>
          <p className="muted-text">
            Session-wise preserved admission trail for the student.
          </p>
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Session</TableHeadCell>
              <TableHeadCell>Class</TableHeadCell>
              <TableHeadCell>Section</TableHeadCell>
              <TableHeadCell>Admission No</TableHeadCell>
              <TableHeadCell>Roll No</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Admission Date</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <TableCell>
                  <div className="table-primary-cell">
                    <strong>{record.session.name}</strong>
                    <span className="muted-text">
                      {record.session.isCurrent ? 'Current session' : 'Archived'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{record.class.name}</TableCell>
                <TableCell>{record.section?.name ?? '-'}</TableCell>
                <TableCell>{record.admissionNo}</TableCell>
                <TableCell>{record.rollNo ?? '-'}</TableCell>
                <TableCell>
                  <Badge tone={record.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {record.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(record.admissionDate)}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}
