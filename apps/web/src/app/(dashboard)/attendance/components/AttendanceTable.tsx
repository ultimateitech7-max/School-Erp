'use client';

import type { ApiMeta, AttendanceRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  loading: boolean;
  deletingId: string | null;
  meta: ApiMeta;
  onEdit?: (record: AttendanceRecord) => void;
  onDelete?: (record: AttendanceRecord) => void;
  onPageChange: (page: number) => void;
}

export function AttendanceTable({
  records,
  loading,
  deletingId,
  meta,
  onEdit,
  onDelete,
  onPageChange,
}: AttendanceTableProps) {
  const canManage = Boolean(onEdit && onDelete);

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Attendance Records</h2>
          <p className="muted-text">
            {meta.total} record{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? <Spinner label="Loading attendance..." /> : null}

      {!loading && records.length === 0 ? (
        <EmptyState
          description="Adjust the filters or mark attendance to get started."
          title="No attendance records found."
        />
      ) : null}

      {!loading && records.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Date</TableHeadCell>
                  <TableHeadCell>Student</TableHeadCell>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Section</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Marked By</TableHeadCell>
                  {canManage ? <TableHeadCell>Actions</TableHeadCell> : null}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <TableCell>{record.attendanceDate.slice(0, 10)}</TableCell>
                    <TableCell>
                      {record.student.name} ({record.student.studentCode})
                    </TableCell>
                    <TableCell>{record.class.className}</TableCell>
                    <TableCell>{record.section?.sectionName ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          record.status === 'PRESENT'
                            ? 'success'
                            : record.status === 'LATE'
                              ? 'warning'
                              : record.status === 'LEAVE'
                                ? 'info'
                                : 'danger'
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.markedBy?.name ?? '-'}</TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="table-actions">
                          <Button
                            onClick={() => onEdit?.(record)}
                            type="button"
                            variant="secondary"
                          >
                            Edit
                          </Button>
                          <Button
                            disabled={deletingId === record.id}
                            onClick={() => onDelete?.(record)}
                            type="button"
                            variant="danger"
                          >
                            {deletingId === record.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <PaginationControls
            limit={meta.limit}
            page={meta.page}
            total={meta.total}
            onPageChange={onPageChange}
          />
        </>
      ) : null}
    </section>
  );
}
