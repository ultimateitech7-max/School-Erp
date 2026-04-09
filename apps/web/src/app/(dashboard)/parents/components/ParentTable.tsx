'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';
import type { ApiMeta, ParentRecord } from '@/utils/api';

interface ParentTableProps {
  parents: ParentRecord[];
  loading: boolean;
  meta: ApiMeta;
  onPageChange: (page: number) => void;
  onView: (parent: ParentRecord) => void;
  onEdit: (parent: ParentRecord) => void;
}

export function ParentTable({
  parents,
  loading,
  meta,
  onPageChange,
  onView,
  onEdit,
}: ParentTableProps) {
  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading parents..." />
      </section>
    );
  }

  if (!parents.length) {
    return (
      <EmptyState
        description="Create a parent profile to link guardians with students and unlock portal access."
        title="No parents found"
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h3>Parent Directory</h3>
          <p className="muted-text">
            Manage guardian records, linked children, and parent access.
          </p>
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Parent</TableHeadCell>
              <TableHeadCell>Phone</TableHeadCell>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Relation</TableHeadCell>
              <TableHeadCell>Children</TableHeadCell>
              <TableHeadCell>Portal</TableHeadCell>
              <TableHeadCell className="align-right-cell">Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {parents.map((parent) => (
              <tr key={parent.id}>
                <TableCell>
                  <div className="table-primary-cell">
                    <strong>{parent.fullName}</strong>
                    <span className="muted-text">
                      Created {new Date(parent.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{parent.phone}</TableCell>
                <TableCell>{parent.email ?? '-'}</TableCell>
                <TableCell>
                  <Badge>{parent.relationType}</Badge>
                </TableCell>
                <TableCell>{parent.childrenCount}</TableCell>
                <TableCell>
                  <Badge tone={parent.portalAccess ? 'success' : 'neutral'}>
                    {parent.portalAccess ? 'Enabled' : 'Not enabled'}
                  </Badge>
                </TableCell>
                <TableCell className="align-right-cell">
                  <div className="table-action-row">
                    <Button onClick={() => onView(parent)} size="sm" variant="secondary">
                      View
                    </Button>
                    <Button onClick={() => onEdit(parent)} size="sm" variant="ghost">
                      Edit
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
        onPageChange={onPageChange}
        page={meta.page}
        total={meta.total}
      />
    </section>
  );
}
