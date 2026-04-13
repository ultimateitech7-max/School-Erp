'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';
import type { ApiMeta, FeeStructureRecord } from '@/utils/api';

interface FeeStructureTableProps {
  items: FeeStructureRecord[];
  loading: boolean;
  meta: ApiMeta;
  editingId?: string | null;
  deletingId?: string | null;
  onEdit: (item: FeeStructureRecord) => void;
  onDelete: (item: FeeStructureRecord) => void;
  onPageChange: (page: number) => void;
}

export function FeeStructureTable({
  items,
  loading,
  meta,
  editingId,
  deletingId,
  onEdit,
  onDelete,
  onPageChange,
}: FeeStructureTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Fee Structures</h2>
          <p className="muted-text">
            {meta.total} structure{meta.total === 1 ? '' : 's'} available
          </p>
        </div>
      </div>

      {loading ? <p>Loading fee structures...</p> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No fee structures"
          description="Create a fee structure to start assigning school dues."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Fee</TableHeadCell>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Amount</TableHeadCell>
                  <TableHeadCell>Frequency</TableHeadCell>
                  <TableHeadCell>Due Date</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{item.name}</strong>
                        <span className="muted-text">{item.feeCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.class ? (
                        <div className="table-primary-cell">
                          <strong>{item.class.className}</strong>
                          <span className="muted-text">{item.class.classCode}</span>
                        </div>
                      ) : (
                        <Badge tone="neutral">All classes</Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.amount.toFixed(2)}</TableCell>
                    <TableCell>{item.frequency}</TableCell>
                    <TableCell>
                      {item.dueDate
                        ? new Date(item.dueDate).toLocaleDateString('en-IN')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="table-action-row">
                        <Button
                          disabled={deletingId === item.id}
                          onClick={() => onEdit(item)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {editingId === item.id ? 'Editing' : 'Edit'}
                        </Button>
                        <Button
                          disabled={deletingId === item.id}
                          onClick={() => onDelete(item)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
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
