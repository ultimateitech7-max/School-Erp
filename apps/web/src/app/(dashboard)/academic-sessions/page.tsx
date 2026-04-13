'use client';

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AcademicSessionForm } from './components/AcademicSessionForm';
import { AcademicSessionTable } from './components/AcademicSessionTable';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { useSchoolScope } from '@/hooks/use-school-scope';
import { getStoredAuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  createQueryString,
  type AcademicSessionFormPayload,
  type AcademicSessionRecord,
  type AcademicSessionStatus,
  type ApiMeta,
  type ApiSuccessResponse,
} from '@/utils/api';
import { academicSessionCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function AcademicSessionsPage() {
  const [sessions, setSessions] = useState<AcademicSessionRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [editingSession, setEditingSession] = useState<AcademicSessionRecord | null>(
    null,
  );
  const [currentSession, setCurrentSession] = useState<AcademicSessionRecord | null>(
    null,
  );
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [statusFilter, setStatusFilter] = useState<AcademicSessionStatus | ''>('');
  const [currentFilter, setCurrentFilter] = useState<'all' | 'current' | 'non-current'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const authSession = useMemo(() => getStoredAuthSession(), []);
  const { selectedSchoolId } = useSchoolScope();

  const canCreate =
    authSession?.user.role === 'SCHOOL_ADMIN' ||
    Boolean(authSession?.user.schoolId) ||
    Boolean(selectedSchoolId);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [currentFilter, deferredSearch, statusFilter]);

  useEffect(() => {
    setLoadingCurrent(true);

    void apiFetch<ApiSuccessResponse<AcademicSessionRecord>>('/academic-sessions/current')
      .then((response) => {
        setCurrentSession(response.data);
      })
      .catch(() => {
        setCurrentSession(null);
      })
      .finally(() => {
        setLoadingCurrent(false);
      });
  }, [reloadIndex]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<AcademicSessionRecord[]>>(
      `/academic-sessions${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        status: statusFilter || undefined,
        isCurrent:
          currentFilter === 'all'
            ? undefined
            : currentFilter === 'current',
      })}`,
    )
      .then((response) => {
        setSessions(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setSessions([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load academic sessions.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentFilter, deferredSearch, page, reloadIndex, statusFilter]);

  const hasActiveFilters = Boolean(deferredSearch || statusFilter || currentFilter !== 'all');

  const handleCreate = async (payload: AcademicSessionFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingSession
        ? await apiFetch<ApiSuccessResponse<AcademicSessionRecord>>(
            `/academic-sessions/${editingSession.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<AcademicSessionRecord>>(
            '/academic-sessions',
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
          );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSession(null);
      setReloadIndex((current) => current + 1);
      setPage(1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingSession
              ? 'Failed to update academic session.'
              : 'Failed to create academic session.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetCurrent = async (session: AcademicSessionRecord) => {
    setSettingCurrentId(session.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<AcademicSessionRecord>>(
        `/academic-sessions/${session.id}/set-current`,
        {
          method: 'PATCH',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSession((current) =>
        current?.id === session.id
          ? {
              ...current,
              isCurrent: true,
              isActive: true,
              status: 'ACTIVE',
            }
          : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to update current academic session.',
      });
    } finally {
      setSettingCurrentId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setCurrentFilter('all');
    setPage(1);
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<AcademicSessionRecord>({
        path: '/academic-sessions',
        params: {
          search: deferredSearch || undefined,
          status: statusFilter || undefined,
          isCurrent:
            currentFilter === 'all'
              ? undefined
              : currentFilter === 'current',
        },
        columns: academicSessionCsvColumns,
        filename: buildCsvFilename('academic-sessions'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} academic session record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to export academic sessions.',
      });
    }
  };

  return (
    <div className="students-page">
      <section className="summary-cards-grid">
        <article className="card summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Current Session</Badge>
            <span className="summary-card-trend">
              {loadingCurrent ? 'Syncing' : currentSession ? 'Live' : 'Unset'}
            </span>
          </div>
          <p>School-wide academic context used by future modules.</p>
          <strong>{currentSession?.name ?? 'No current session'}</strong>
          <span>
            {currentSession
              ? `${formatDisplayDate(currentSession.startDate)} to ${formatDisplayDate(
                  currentSession.endDate,
                )}`
              : 'Set one session as current to anchor reports, enrollments, and timetable flows.'}
          </span>
        </article>
      </section>

      <section className="card panel students-toolbar">
        <div>
          <h2>Academic Sessions</h2>
          <p className="muted-text">
            Manage school-wise academic timelines with strict tenant isolation.
          </p>
        </div>

        <div className="students-toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by session name"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as AcademicSessionStatus | '')
            }
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={currentFilter}
            onChange={(event) =>
              setCurrentFilter(
                event.target.value as 'all' | 'current' | 'non-current',
              )
            }
          >
            <option value="all">All sessions</option>
            <option value="current">Current only</option>
            <option value="non-current">Non-current</option>
          </select>
          {hasActiveFilters ? (
            <button
              className="secondary-button"
              onClick={handleResetFilters}
              type="button"
            >
              Reset
            </button>
          ) : null}
          {editingSession ? (
            <button
              className="secondary-button"
              onClick={() => setEditingSession(null)}
              type="button"
            >
              New Session
            </button>
          ) : null}
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        </div>
      </section>

      {!canCreate ? (
        <Banner tone="info">
          Super admin needs a school-scoped context to create academic sessions.
        </Banner>
      ) : null}

      {message ? (
        <Banner tone={message.type}>{message.text}</Banner>
      ) : null}

      <div className="students-grid">
        <AcademicSessionForm
          mode={editingSession ? 'edit' : 'create'}
          canCreate={canCreate}
          initialValue={editingSession}
          submitting={submitting}
          onSubmit={handleCreate}
          onCancel={editingSession ? () => setEditingSession(null) : undefined}
        />

        <AcademicSessionTable
          canManage={canCreate}
          hasActiveFilters={hasActiveFilters}
          loading={loading}
          meta={meta}
          sessions={sessions}
          settingCurrentId={settingCurrentId}
          onEdit={setEditingSession}
          onSetCurrent={handleSetCurrent}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
