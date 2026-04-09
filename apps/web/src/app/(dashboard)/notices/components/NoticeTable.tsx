'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';
import type { ApiMeta, NoticeRecord } from '@/utils/api';

function formatDate(value: string | null) {
  if (!value) {
    return 'No expiry';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

interface NoticeTableProps {
  items: NoticeRecord[];
  loading: boolean;
  meta: ApiMeta;
  onEdit: (notice: NoticeRecord) => void;
  onPageChange: (page: number) => void;
}

export function NoticeTable({
  items,
  loading,
  meta,
  onEdit,
  onPageChange,
}: NoticeTableProps) {
  if (loading) {
    return (
      <section className="card panel">
        <div className="ui-empty-state">
          <strong>Loading notices...</strong>
          <p className="muted-text">Fetching targeted announcements and updates.</p>
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title="No notices yet"
        description="Create your first notice to start publishing audience-based updates."
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Notice Board</h2>
          <p className="muted-text">Manage publish state, audience targeting, and expiry.</p>
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Audience</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Expiry</TableHeadCell>
              <TableHeadCell>Created</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <TableCell>
                  <strong>{item.title}</strong>
                  <div className="muted-text line-clamp-2">{item.description}</div>
                </TableCell>
                <TableCell>
                  <Badge tone="info">{item.audienceType}</Badge>
                </TableCell>
                <TableCell>
                  <Badge tone={item.isPublished ? 'success' : 'warning'}>
                    {item.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(item.expiryDate)}</TableCell>
                <TableCell>{formatDate(item.createdAt)}</TableCell>
                <TableCell>
                  <Button onClick={() => onEdit(item)} size="sm" type="button" variant="secondary">
                    Edit
                  </Button>
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
