'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type { ApiMeta, PromotionRecord } from '@/utils/api';

interface PromotionHistoryTableProps {
  records: PromotionRecord[];
  meta: ApiMeta;
  loading: boolean;
  onPageChange?: (page: number) => void;
  title?: string;
  description?: string;
  showStudentColumn?: boolean;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function PromotionHistoryTable({
  records,
  meta,
  loading,
  onPageChange,
  title = 'Promotion History',
  description = 'Audit-safe promotion records with source and target enrollment history.',
  showStudentColumn = true,
}: PromotionHistoryTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted-text">
            {meta.total} record{meta.total === 1 ? '' : 's'} captured with
            preserved class, section, session, and actor history.
          </p>
          <p className="muted-text">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state ui-empty-state">
          <strong>Loading promotion history...</strong>
          <p className="muted-text">
            Fetching school-scoped promotion activity and enrollment transitions.
          </p>
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <EmptyState
          description="Promotion history will appear here after the first promotion or detention is recorded."
          title="No promotions found."
        />
      ) : null}

      {!loading && records.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  {showStudentColumn ? <TableHeadCell>Student</TableHeadCell> : null}
                  <TableHeadCell>Action</TableHeadCell>
                  <TableHeadCell>From Session</TableHeadCell>
                  <TableHeadCell>To Session</TableHeadCell>
                  <TableHeadCell>From Class</TableHeadCell>
                  <TableHeadCell>To Class</TableHeadCell>
                  <TableHeadCell>Remarks</TableHeadCell>
                  <TableHeadCell>Promoted By</TableHeadCell>
                  <TableHeadCell>Date</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {showStudentColumn ? (
                      <TableCell>
                        <div className="table-primary-cell">
                          <strong>{record.student.name}</strong>
                          <span className="muted-text">{record.student.studentCode}</span>
                        </div>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Badge tone={record.action === 'PROMOTED' ? 'success' : 'warning'}>
                        {record.action === 'PROMOTED' ? 'Promoted' : 'Detained'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{record.fromAcademicSession.name}</strong>
                        <span className="muted-text">
                          {record.fromEnrollment.admissionNo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{record.toAcademicSession.name}</strong>
                        <span className="muted-text">
                          {record.toEnrollment.admissionNo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{record.fromClass.name}</strong>
                        <span className="muted-text">
                          {record.fromSection ? record.fromSection.name : 'No section'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{record.toClass.name}</strong>
                        <span className="muted-text">
                          {record.toSection ? record.toSection.name : 'No section'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{record.remarks || 'No remarks'}</TableCell>
                    <TableCell>{record.promotedBy?.name ?? 'System'}</TableCell>
                    <TableCell>{formatDateTime(record.promotedAt)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          {onPageChange ? (
            <PaginationControls
              limit={meta.limit}
              page={meta.page}
              total={meta.total}
              onPageChange={onPageChange}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
