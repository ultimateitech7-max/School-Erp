'use client';

import type { AcademicSessionRecord, ApiMeta } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';

interface AcademicSessionTableProps {
  sessions: AcademicSessionRecord[];
  meta: ApiMeta;
  loading: boolean;
  canManage: boolean;
  settingCurrentId: string | null;
  hasActiveFilters?: boolean;
  onEdit: (session: AcademicSessionRecord) => void;
  onSetCurrent: (session: AcademicSessionRecord) => void;
  onPageChange: (page: number) => void;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function AcademicSessionTable({
  sessions,
  meta,
  loading,
  canManage,
  settingCurrentId,
  hasActiveFilters = false,
  onEdit,
  onSetCurrent,
  onPageChange,
}: AcademicSessionTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Academic Sessions</h2>
          <p className="muted-text">
            {meta.total} record{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state ui-empty-state">
          <strong>Loading academic sessions...</strong>
          <p className="muted-text">
            Fetching school-scoped session records and current status.
          </p>
        </div>
      ) : null}

      {!loading && sessions.length === 0 ? (
        <EmptyState
          description={
            hasActiveFilters
              ? 'Try resetting filters or using a different search term.'
              : 'Create a new academic session to prepare promotions, reports, and timetable workflows.'
          }
          title="No academic sessions found."
        />
      ) : null}

      {!loading && sessions.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Session</TableHeadCell>
                  <TableHeadCell>Start Date</TableHeadCell>
                  <TableHeadCell>End Date</TableHeadCell>
                  <TableHeadCell>Current</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{session.name}</strong>
                        <span className="muted-text">{session.id.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDisplayDate(session.startDate)}</TableCell>
                    <TableCell>{formatDisplayDate(session.endDate)}</TableCell>
                    <TableCell>
                      <Badge tone={session.isCurrent ? 'info' : 'neutral'}>
                        {session.isCurrent ? 'Current' : 'Standard'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          session.status === 'ACTIVE'
                            ? 'success'
                            : session.status === 'COMPLETED'
                              ? 'info'
                              : 'warning'
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <button
                          className="secondary-button"
                          disabled={!canManage}
                          onClick={() => onEdit(session)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="primary-button"
                          disabled={!canManage || session.isCurrent || settingCurrentId === session.id}
                          onClick={() => onSetCurrent(session)}
                          type="button"
                        >
                          {settingCurrentId === session.id
                            ? 'Updating...'
                            : session.isCurrent
                              ? 'Current'
                              : 'Set Current'}
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
