'use client';

import type { ApiMeta, SubjectRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface SubjectTableProps {
  subjects: SubjectRecord[];
  loading: boolean;
  meta: ApiMeta;
  deletingSubjectId: string | null;
  onEdit: (subject: SubjectRecord) => void;
  onDelete: (subject: SubjectRecord) => void;
  onPageChange: (page: number) => void;
}

export function SubjectTable({
  subjects,
  loading,
  meta,
  deletingSubjectId,
  onEdit,
  onDelete,
  onPageChange,
}: SubjectTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Subjects List</h2>
          <p className="muted-text">
            {meta.total} subject{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? <p>Loading subjects...</p> : null}

      {!loading && subjects.length === 0 ? (
        <EmptyState
          description="Add a subject to start assigning it to classes."
          title="No subjects found."
        />
      ) : null}

      {!loading && subjects.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Subject</TableHeadCell>
                  <TableHeadCell>Code</TableHeadCell>
                  <TableHeadCell>Type</TableHeadCell>
                  <TableHeadCell>Classes</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{subject.subjectName}</strong>
                        <span className="muted-text">
                          {subject.isOptional ? 'Optional' : 'Core'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{subject.subjectCode}</TableCell>
                    <TableCell>{subject.subjectType}</TableCell>
                    <TableCell>
                      <div className="chip-list">
                        {subject.classes.length > 0 ? (
                          subject.classes.map((academicClass) => (
                            <span
                              className="chip"
                              key={`${subject.id}-${academicClass.id}-${academicClass.sessionId}`}
                            >
                              {academicClass.className}
                            </span>
                          ))
                        ) : (
                          <span className="muted-text">Not assigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={subject.isActive ? 'success' : 'warning'}>
                        {subject.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          onClick={() => onEdit(subject)}
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        {subject.isActive ? (
                          <Button
                            disabled={deletingSubjectId === subject.id}
                            onClick={() => onDelete(subject)}
                            type="button"
                            variant="danger"
                          >
                            {deletingSubjectId === subject.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </Button>
                        ) : null}
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
