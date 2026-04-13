'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { SubjectForm } from './components/SubjectForm';
import { SubjectTable } from './components/SubjectTable';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type SubjectFormPayload,
  type SubjectRecord,
  type SubjectType,
  type UserStatus,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { subjectCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function SubjectsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [pendingDeleteSubject, setPendingDeleteSubject] = useState<SubjectRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [typeFilter, setTypeFilter] = useState<SubjectType | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('ACTIVE');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch, statusFilter, typeFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingSubjects(true);

    void apiFetch<ApiSuccessResponse<SubjectRecord[]>>(
      `/subjects${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        subjectType: typeFilter || undefined,
        isActive: statusFilter ? statusFilter === 'ACTIVE' : undefined,
      })}`,
    )
      .then((response) => {
        setSubjects(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setSubjects([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load subjects.',
        });
      })
      .finally(() => {
        setLoadingSubjects(false);
      });
  }, [deferredSearch, page, reloadIndex, session, statusFilter, typeFilter]);

  const handleSubmit = async (payload: SubjectFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingSubject
        ? await apiFetch<ApiSuccessResponse<SubjectRecord>>(
            `/subjects/${editingSubject.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<SubjectRecord>>('/subjects', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSubject(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingSubject
              ? 'Failed to update subject.'
              : 'Failed to create subject.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (subject: SubjectRecord) => {
    setPendingDeleteSubject(subject);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteSubject) {
      return;
    }

    setDeletingSubjectId(pendingDeleteSubject.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/subjects/${pendingDeleteSubject.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSubject((current) =>
        current?.id === pendingDeleteSubject.id ? null : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete subject.',
      });
    } finally {
      setDeletingSubjectId(null);
      setPendingDeleteSubject(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<SubjectRecord>({
        path: '/subjects',
        params: {
          search: deferredSearch || undefined,
          subjectType: typeFilter || undefined,
          isActive: statusFilter ? statusFilter === 'ACTIVE' : undefined,
        },
        columns: subjectCsvColumns,
        filename: buildCsvFilename('subjects'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} subject record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export subjects.',
      });
    }
  };

  if (!sessionLoaded) {
    return (
      <section className="card panel">
        <p>Loading session...</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="card panel">
        <h2>Session Expired</h2>
        <p className="muted-text">
          Please sign in again to continue managing subjects.
        </p>
      </section>
    );
  }

  const canManageAcademics =
    session.user.role === 'SUPER_ADMIN' || session.user.role === 'SCHOOL_ADMIN';

  if (!canManageAcademics) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to manage subjects.
        </p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Subject Management</h2>
          <p className="muted-text">
            Create subjects and monitor how they are mapped to classes.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by subject name or code"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as SubjectType | '')
            }
          >
            <option value="">All types</option>
            <option value="THEORY">Theory</option>
            <option value="PRACTICAL">Practical</option>
            <option value="BOTH">Both</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as UserStatus | '')
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="">All</option>
          </select>
          {editingSubject ? (
            <button
              className="secondary-button"
              onClick={() => setEditingSubject(null)}
              type="button"
            >
              Reset
            </button>
          ) : null}
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        </div>
      </section>

      {message ? (
        <section
          className={`card panel banner banner-${message.type}`}
          role="status"
        >
          {message.text}
        </section>
      ) : null}

      <div className="academic-grid">
        <SubjectForm
          mode={editingSubject ? 'edit' : 'create'}
          initialSubject={editingSubject}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={editingSubject ? () => setEditingSubject(null) : undefined}
        />

        <SubjectTable
          subjects={subjects}
          loading={loadingSubjects}
          meta={meta}
          deletingSubjectId={deletingSubjectId}
          onEdit={setEditingSubject}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete subject"
        description={
          pendingDeleteSubject
            ? `Delete ${pendingDeleteSubject.subjectName}? This will mark the subject inactive in active curriculum mapping.`
            : 'Delete this subject?'
        }
        loading={Boolean(
          pendingDeleteSubject && deletingSubjectId === pendingDeleteSubject.id,
        )}
        open={Boolean(pendingDeleteSubject)}
        onClose={() => setPendingDeleteSubject(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete subject"
      />
    </div>
  );
}
