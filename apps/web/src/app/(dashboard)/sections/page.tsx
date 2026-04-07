'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { SectionForm } from './components/SectionForm';
import { SectionTable } from './components/SectionTable';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type AcademicClassRecord,
  type ApiMeta,
  type ApiSuccessResponse,
  type SectionFormPayload,
  type SectionRecord,
  type UserStatus,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function SectionsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [sections, setSections] = useState<SectionRecord[]>([]);
  const [classes, setClasses] = useState<AcademicClassRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<SectionRecord | null>(null);
  const [pendingDeleteSection, setPendingDeleteSection] = useState<SectionRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [classFilter, setClassFilter] = useState('');
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
  }, [deferredSearch, classFilter, statusFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingClasses(true);

    void apiFetch<ApiSuccessResponse<AcademicClassRecord[]>>(
      `/classes${createQueryString({
        page: 1,
        limit: 100,
        isActive: true,
      })}`,
    )
      .then((response) => {
        setClasses(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load class options.',
        });
      })
      .finally(() => {
        setLoadingClasses(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingSections(true);

    void apiFetch<ApiSuccessResponse<SectionRecord[]>>(
      `/sections${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        classId: classFilter || undefined,
        isActive: statusFilter ? statusFilter === 'ACTIVE' : undefined,
      })}`,
    )
      .then((response) => {
        setSections(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setSections([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load sections.',
        });
      })
      .finally(() => {
        setLoadingSections(false);
      });
  }, [classFilter, deferredSearch, page, reloadIndex, session, statusFilter]);

  const handleSubmit = async (payload: SectionFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingSection
        ? await apiFetch<ApiSuccessResponse<SectionRecord>>(
            `/sections/${editingSection.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<SectionRecord>>('/sections', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSection(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingSection
              ? 'Failed to update section.'
              : 'Failed to create section.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (section: SectionRecord) => {
    setPendingDeleteSection(section);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteSection) {
      return;
    }

    setDeletingSectionId(pendingDeleteSection.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/sections/${pendingDeleteSection.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingSection((current) =>
        current?.id === pendingDeleteSection.id ? null : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete section.',
      });
    } finally {
      setDeletingSectionId(null);
      setPendingDeleteSection(null);
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
          Please sign in again to continue managing sections.
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
          You do not have permission to manage sections.
        </p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Section Management</h2>
          <p className="muted-text">
            Manage class-wise sections and classroom capacity.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by section, room, or class"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
          >
            <option value="">All classes</option>
            {classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.className}
              </option>
            ))}
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
          {editingSection ? (
            <button
              className="secondary-button"
              onClick={() => setEditingSection(null)}
              type="button"
            >
              Reset
            </button>
          ) : null}
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
        <SectionForm
          mode={editingSection ? 'edit' : 'create'}
          classes={classes}
          initialSection={editingSection}
          submitting={submitting || loadingClasses}
          onSubmit={handleSubmit}
          onCancel={editingSection ? () => setEditingSection(null) : undefined}
        />

        <SectionTable
          sections={sections}
          loading={loadingSections}
          meta={meta}
          deletingSectionId={deletingSectionId}
          onEdit={setEditingSection}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete section"
        description={
          pendingDeleteSection
            ? `Delete section ${pendingDeleteSection.sectionName}? This will mark it inactive and remove it from active academic setup.`
            : 'Delete this section?'
        }
        loading={Boolean(
          pendingDeleteSection && deletingSectionId === pendingDeleteSection.id,
        )}
        open={Boolean(pendingDeleteSection)}
        onClose={() => setPendingDeleteSection(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete section"
      />
    </div>
  );
}
