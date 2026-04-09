'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type {
  PromotionPreviewRecord,
  PromotionPreviewSummary,
} from '@/utils/api';

interface PromotionPreviewTableProps {
  items: PromotionPreviewRecord[];
  summary: PromotionPreviewSummary | null;
  loading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function statusTone(status: PromotionPreviewRecord['status']) {
  switch (status) {
    case 'VALID':
      return 'success';
    case 'ALREADY_PROMOTED':
      return 'warning';
    case 'CONFLICT':
      return 'danger';
    default:
      return 'danger';
  }
}

function statusLabel(status: PromotionPreviewRecord['status']) {
  switch (status) {
    case 'VALID':
      return 'Valid';
    case 'ALREADY_PROMOTED':
      return 'Already Exists';
    case 'CONFLICT':
      return 'Conflict';
    default:
      return 'Invalid';
  }
}

export function PromotionPreviewTable({
  items,
  summary,
  loading,
  emptyTitle = 'No preview available.',
  emptyDescription = 'Configure the promotion inputs and generate a preview to review valid and skipped students.',
}: PromotionPreviewTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Promotion Preview</h2>
          <p className="muted-text">
            Review each student before the promotion workflow creates the next
            enrollment record.
          </p>
        </div>
      </div>

      {summary ? (
        <div className="summary-cards-grid">
          <article className="card summary-card compact-summary-card">
            <div className="summary-card-top">
              <Badge tone="info">Total</Badge>
            </div>
            <strong>{summary.total}</strong>
            <span>Students evaluated</span>
          </article>
          <article className="card summary-card compact-summary-card">
            <div className="summary-card-top">
              <Badge tone="success">Valid</Badge>
            </div>
            <strong>{summary.valid}</strong>
            <span>Ready for confirmation</span>
          </article>
          <article className="card summary-card compact-summary-card">
            <div className="summary-card-top">
              <Badge tone="warning">Skipped</Badge>
            </div>
            <strong>{summary.skipped}</strong>
            <span>Already promoted or enrolled</span>
          </article>
          <article className="card summary-card compact-summary-card">
            <div className="summary-card-top">
              <Badge tone="danger">Errors</Badge>
            </div>
            <strong>{summary.errors}</strong>
            <span>Require correction before confirm</span>
          </article>
        </div>
      ) : null}

      {loading ? (
        <div className="empty-state ui-empty-state">
          <strong>Generating preview...</strong>
          <p className="muted-text">
            Validating source enrollments, target sessions, and duplicate history.
          </p>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          description={emptyDescription}
          title={emptyTitle}
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <TableHeadCell>Student</TableHeadCell>
                <TableHeadCell>Current</TableHeadCell>
                <TableHeadCell>Target</TableHeadCell>
                <TableHeadCell>Action</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Details</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.student?.id ?? 'missing'}-${index}`}>
                  <TableCell>
                    <div className="table-primary-cell">
                      <strong>{item.student?.name ?? 'Unavailable student'}</strong>
                      <span className="muted-text">
                        {item.student?.studentCode ?? 'Missing school-scoped student'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.currentEnrollment ? (
                      <div className="table-primary-cell">
                        <strong>{item.currentEnrollment.academicClass.name}</strong>
                        <span className="muted-text">
                          {item.currentEnrollment.academicSession.name}
                          {item.currentEnrollment.section
                            ? ` • ${item.currentEnrollment.section.name}`
                            : ''}
                        </span>
                      </div>
                    ) : (
                      'Unavailable'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="table-primary-cell">
                      <strong>{item.targetEnrollment.academicClass.name}</strong>
                      <span className="muted-text">
                        {item.targetEnrollment.academicSession.name}
                        {item.targetEnrollment.section
                          ? ` • ${item.targetEnrollment.section.name}`
                          : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={item.action === 'PROMOTED' ? 'success' : 'warning'}>
                      {item.action === 'PROMOTED' ? 'Promoted' : 'Detained'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={statusTone(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.message}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : null}
    </section>
  );
}
