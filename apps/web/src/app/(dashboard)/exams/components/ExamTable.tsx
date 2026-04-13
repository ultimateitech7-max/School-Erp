'use client';

import type { ApiMeta, ExamRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface ExamTableProps {
  exams: ExamRecord[];
  meta: ApiMeta;
  loading: boolean;
  canManage: boolean;
  deletingExamId: string | null;
  selectedExamId: string | null;
  onEdit: (exam: ExamRecord) => void;
  onDelete: (exam: ExamRecord) => void;
  onSelect: (exam: ExamRecord) => void;
  onPageChange: (page: number) => void;
}

export function ExamTable({
  exams,
  meta,
  loading,
  canManage,
  deletingExamId,
  selectedExamId,
  onEdit,
  onDelete,
  onSelect,
  onPageChange,
}: ExamTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Exam List</h2>
          <p className="muted-text">
            Review schedules, attached subjects, and open result workflows.
          </p>
        </div>
      </div>

      {loading ? <p>Loading exams...</p> : null}

      {!loading && exams.length === 0 ? (
        <EmptyState
          description={
            canManage
              ? 'Create an exam or adjust your filters to view existing schedules.'
              : 'Adjust your filters to view existing exam schedules.'
          }
          title="No exams found."
        />
      ) : null}

      {!loading && exams.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Exam</TableHeadCell>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Type</TableHeadCell>
                  <TableHeadCell>Dates</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Subjects</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <TableCell>
                      <strong>{exam.examName}</strong>
                      <div className="muted-text">{exam.examCode}</div>
                    </TableCell>
                    <TableCell>{exam.class ? exam.class.className : 'School-wide'}</TableCell>
                    <TableCell>{exam.examType}</TableCell>
                    <TableCell>
                      {exam.startDate.slice(0, 10)} to {exam.endDate.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          exam.status === 'PUBLISHED'
                            ? 'success'
                            : exam.status === 'ONGOING'
                              ? 'info'
                              : exam.status === 'DRAFT'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{exam.subjects.length}</TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          onClick={() => onSelect(exam)}
                          type="button"
                          variant={selectedExamId === exam.id ? 'primary' : 'secondary'}
                        >
                          {selectedExamId === exam.id ? 'Selected' : 'Open'}
                        </Button>
                        {canManage ? (
                          <>
                            <Button
                              onClick={() => onEdit(exam)}
                              type="button"
                              variant="secondary"
                            >
                              Edit
                            </Button>
                            <Button
                              disabled={deletingExamId === exam.id}
                              onClick={() => onDelete(exam)}
                              type="button"
                              variant="danger"
                            >
                              {deletingExamId === exam.id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </>
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
