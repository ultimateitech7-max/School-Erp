'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { ClassForm } from './components/ClassForm';
import { ClassTable } from './components/ClassTable';
import { SubjectAssignmentPanel } from './components/SubjectAssignmentPanel';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type AcademicClassFormPayload,
  type AcademicClassRecord,
  type ApiMeta,
  type ApiSuccessResponse,
  type AssignClassSubjectsPayload,
  type SubjectRecord,
  type UserStatus,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { classCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function ClassesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [classes, setClasses] = useState<AcademicClassRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<AcademicClassRecord | null>(null);
  const [assigningClass, setAssigningClass] = useState<AcademicClassRecord | null>(
    null,
  );
  const [pendingDeleteClass, setPendingDeleteClass] = useState<AcademicClassRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
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
  }, [deferredSearch, statusFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingSubjects(true);

    void apiFetch<ApiSuccessResponse<SubjectRecord[]>>(
      `/subjects${createQueryString({
        page: 1,
        limit: 100,
        isActive: true,
      })}`,
    )
      .then((response) => {
        setSubjects(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load subject options.',
        });
      })
      .finally(() => {
        setLoadingSubjects(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingClasses(true);

    void apiFetch<ApiSuccessResponse<AcademicClassRecord[]>>(
      `/classes${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        isActive: statusFilter ? statusFilter === 'ACTIVE' : undefined,
      })}`,
    )
      .then((response) => {
        setClasses(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setClasses([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load classes.',
        });
      })
      .finally(() => {
        setLoadingClasses(false);
      });
  }, [deferredSearch, page, reloadIndex, session, statusFilter]);

  const handleSubmit = async (payload: AcademicClassFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingClass
        ? await apiFetch<ApiSuccessResponse<AcademicClassRecord>>(
            `/classes/${editingClass.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<AcademicClassRecord>>('/classes', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingClass(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingClass
              ? 'Failed to update class.'
              : 'Failed to create class.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (academicClass: AcademicClassRecord) => {
    setPendingDeleteClass(academicClass);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteClass) {
      return;
    }

    setDeletingClassId(pendingDeleteClass.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/classes/${pendingDeleteClass.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingClass((current) =>
        current?.id === pendingDeleteClass.id ? null : current,
      );
      setAssigningClass((current) =>
        current?.id === pendingDeleteClass.id ? null : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete class.',
      });
    } finally {
      setDeletingClassId(null);
      setPendingDeleteClass(null);
    }
  };

  const handleAssignSubjects = async (payload: AssignClassSubjectsPayload) => {
    if (!assigningClass) {
      return;
    }

    setAssigning(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<AcademicClassRecord>>(
        `/classes/${assigningClass.id}/subjects`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setAssigningClass(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to assign subjects.',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<AcademicClassRecord>({
        path: '/classes',
        params: {
          search: deferredSearch || undefined,
          isActive: statusFilter ? statusFilter === 'ACTIVE' : undefined,
        },
        columns: classCsvColumns,
        filename: buildCsvFilename(`classes-${statusFilter || 'all'}`),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} class record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export classes.',
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
          Please sign in again to continue managing classes.
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
          You do not have permission to manage academic structure.
        </p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Class Management</h2>
          <p className="muted-text">
            Organize classes and map them with sections and subjects.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by class name or code"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
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
          {editingClass || assigningClass ? (
            <button
              className="secondary-button"
              onClick={() => {
                setEditingClass(null);
                setAssigningClass(null);
              }}
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
        <ClassForm
          mode={editingClass ? 'edit' : 'create'}
          initialClass={editingClass}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={editingClass ? () => setEditingClass(null) : undefined}
        />

        <ClassTable
          classes={classes}
          loading={loadingClasses}
          meta={meta}
          deletingClassId={deletingClassId}
          onEdit={setEditingClass}
          onAssignSubjects={setAssigningClass}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      {assigningClass ? (
        <SubjectAssignmentPanel
          academicClass={assigningClass}
          subjects={subjects}
          submitting={assigning || loadingSubjects}
          onSubmit={handleAssignSubjects}
          onCancel={() => setAssigningClass(null)}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Delete class"
        description={
          pendingDeleteClass
            ? `Delete ${pendingDeleteClass.className}? This will mark the class inactive and remove it from active academic lists.`
            : 'Delete this class?'
        }
        loading={Boolean(pendingDeleteClass && deletingClassId === pendingDeleteClass.id)}
        open={Boolean(pendingDeleteClass)}
        onClose={() => setPendingDeleteClass(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete class"
      />
    </div>
  );
}
