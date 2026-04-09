'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import type { ApiMeta, HomeworkRecord } from '@/utils/api';

interface HomeworkTableProps {
  items: HomeworkRecord[];
  loading: boolean;
  meta: ApiMeta;
  onPageChange: (page: number) => void;
}

export function HomeworkTable({
  items,
  loading,
  meta,
  onPageChange,
}: HomeworkTableProps) {
  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading homework..." />
      </section>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title="No homework found"
        description="Homework assigned to the selected filters will appear here."
      />
    );
  }

  const totalPages = Math.max(Math.ceil(meta.total / meta.limit), 1);

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Homework List</h2>
          <p className="muted-text">
            Track due dates, class targeting, and teacher ownership.
          </p>
        </div>
      </div>

      <div className="responsive-table">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Class</th>
              <th>Subject</th>
              <th>Teacher</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="table-primary-cell">
                    <strong>{item.title}</strong>
                    <span className="muted-text">{item.description}</span>
                  </div>
                </td>
                <td>
                  <div className="table-primary-cell">
                    <span>{item.class.name}</span>
                    <span className="muted-text">{item.section?.name ?? 'All sections'}</span>
                  </div>
                </td>
                <td>
                  <Badge tone="info">{item.subject.name}</Badge>
                </td>
                <td>{item.teacher.name}</td>
                <td>{new Date(item.dueDate).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-actions">
        <Button
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          type="button"
          variant="ghost"
        >
          Previous
        </Button>
        <span className="muted-text">
          Page {meta.page} of {totalPages}
        </span>
        <Button
          disabled={meta.page >= totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          type="button"
          variant="ghost"
        >
          Next
        </Button>
      </div>
    </section>
  );
}
