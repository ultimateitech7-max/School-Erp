'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type {
  AdmissionApplicationRecord,
  AdmissionApplicationStatus,
  ApiMeta,
} from '@/utils/api';

interface AdmissionTableProps {
  admissions: AdmissionApplicationRecord[];
  meta: ApiMeta;
  loading: boolean;
  hasActiveFilters?: boolean;
  onPageChange: (page: number) => void;
  onView: (admission: AdmissionApplicationRecord) => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getStatusTone(status: AdmissionApplicationStatus) {
  if (status === 'ENROLLED') {
    return 'success';
  }

  if (status === 'APPROVED') {
    return 'success';
  }

  if (status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'UNDER_REVIEW') {
    return 'warning';
  }

  if (status === 'APPLIED') {
    return 'info';
  }

  return 'neutral';
}

function getStatusLabel(status: AdmissionApplicationStatus) {
  if (status === 'ENROLLED') {
    return 'Enrolled';
  }

  if (status === 'UNDER_REVIEW') {
    return 'Under Review';
  }

  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function AdmissionTable({
  admissions,
  meta,
  loading,
  hasActiveFilters = false,
  onPageChange,
  onView,
}: AdmissionTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Admission Applications</h2>
          <p className="muted-text">
            {meta.total} application{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state ui-empty-state">
          <strong>Loading admissions...</strong>
          <p className="muted-text">
            Fetching school-scoped admission applications and workflow states.
          </p>
        </div>
      ) : null}

      {!loading && admissions.length === 0 ? (
        <EmptyState
          description={
            hasActiveFilters
              ? 'Try resetting filters or searching with another phone or student name.'
              : 'Admission inquiries will appear here once the front desk starts creating applications.'
          }
          title="No admission applications found."
        />
      ) : null}

      {!loading && admissions.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Student</TableHeadCell>
                  <TableHeadCell>Class Applied</TableHeadCell>
                  <TableHeadCell>Phone</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Created</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {admissions.map((admission) => (
                  <tr key={admission.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{admission.studentName}</strong>
                        <span className="muted-text">
                          {admission.student?.registrationNumber ??
                            admission.email ??
                            admission.id.slice(0, 8)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{admission.classApplied}</TableCell>
                    <TableCell>{admission.phone}</TableCell>
                    <TableCell>
                      <Badge tone={getStatusTone(admission.status)}>
                        {getStatusLabel(admission.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(admission.createdAt)}</TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <button
                          className="secondary-button"
                          onClick={() => onView(admission)}
                          type="button"
                        >
                          View
                        </button>
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
