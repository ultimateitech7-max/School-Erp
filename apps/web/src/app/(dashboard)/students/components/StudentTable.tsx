'use client';

import type { ApiMeta, StudentRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface StudentTableProps {
  students: StudentRecord[];
  loading: boolean;
  deletingStudentId: string | null;
  meta: ApiMeta;
  onEdit: (student: StudentRecord) => void;
  onDelete: (student: StudentRecord) => void;
  onPageChange: (page: number) => void;
}

export function StudentTable({
  students,
  loading,
  deletingStudentId,
  meta,
  onEdit,
  onDelete,
  onPageChange,
}: StudentTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Students</h2>
          <p className="muted-text">
            {meta.total} record{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? <p>Loading students...</p> : null}

      {!loading && students.length === 0 ? (
        <EmptyState
          description="Try a different search or add a new student."
          title="No students found."
        />
      ) : null}

      {!loading && students.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Name</TableHeadCell>
                  <TableHeadCell>Admission No</TableHeadCell>
                  <TableHeadCell>Email</TableHeadCell>
                  <TableHeadCell>Phone</TableHeadCell>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Section</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{student.name}</strong>
                        <span className="muted-text">{student.studentCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.admissionNo ?? '-'}</TableCell>
                    <TableCell>{student.email ?? '-'}</TableCell>
                    <TableCell>{student.phone ?? '-'}</TableCell>
                    <TableCell>{student.class?.name ?? '-'}</TableCell>
                    <TableCell>{student.section?.name ?? '-'}</TableCell>
                    <TableCell>
                      <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          onClick={() => onEdit(student)}
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        <Button
                          disabled={deletingStudentId === student.id}
                          onClick={() => onDelete(student)}
                          type="button"
                          variant="danger"
                        >
                          {deletingStudentId === student.id
                            ? 'Deleting...'
                            : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
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
