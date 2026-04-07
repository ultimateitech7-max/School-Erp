'use client';

import type { AcademicClassRecord, ApiMeta } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface ClassTableProps {
  classes: AcademicClassRecord[];
  loading: boolean;
  meta: ApiMeta;
  deletingClassId: string | null;
  onEdit: (academicClass: AcademicClassRecord) => void;
  onAssignSubjects: (academicClass: AcademicClassRecord) => void;
  onDelete: (academicClass: AcademicClassRecord) => void;
  onPageChange: (page: number) => void;
}

export function ClassTable({
  classes,
  loading,
  meta,
  deletingClassId,
  onEdit,
  onAssignSubjects,
  onDelete,
  onPageChange,
}: ClassTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Classes List</h2>
          <p className="muted-text">
            {meta.total} class{meta.total === 1 ? '' : 'es'} found
          </p>
        </div>
      </div>

      {loading ? <p>Loading classes...</p> : null}

      {!loading && classes.length === 0 ? (
        <EmptyState
          description="Create a class to start building the academic structure."
          title="No classes found."
        />
      ) : null}

      {!loading && classes.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Code</TableHeadCell>
                  <TableHeadCell>Sections</TableHeadCell>
                  <TableHeadCell>Subjects</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {classes.map((academicClass) => (
                  <tr key={academicClass.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{academicClass.className}</strong>
                        <span className="muted-text">
                          Grade {academicClass.gradeLevel ?? '-'} · Order{' '}
                          {academicClass.sortOrder}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{academicClass.classCode}</TableCell>
                    <TableCell>
                      <div className="chip-list">
                        {academicClass.sections.length > 0 ? (
                          academicClass.sections.map((section) => (
                            <span className="chip" key={section.id}>
                              {section.name}
                            </span>
                          ))
                        ) : (
                          <span className="muted-text">No sections</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="chip-list">
                        {academicClass.subjects.length > 0 ? (
                          academicClass.subjects.map((subject) => (
                            <span className="chip" key={subject.id}>
                              {subject.name}
                            </span>
                          ))
                        ) : (
                          <span className="muted-text">No subjects</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge tone={academicClass.isActive ? 'success' : 'warning'}>
                        {academicClass.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          onClick={() => onEdit(academicClass)}
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => onAssignSubjects(academicClass)}
                          type="button"
                          variant="secondary"
                        >
                          Assign Subjects
                        </Button>
                        {academicClass.isActive ? (
                          <Button
                            disabled={deletingClassId === academicClass.id}
                            onClick={() => onDelete(academicClass)}
                            type="button"
                            variant="danger"
                          >
                            {deletingClassId === academicClass.id
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
