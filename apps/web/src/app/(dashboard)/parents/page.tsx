'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { Input } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type ParentFormPayload,
  type ParentRecord,
  type ParentRelationType,
  type StudentRecord,
} from '@/utils/api';
import { parentCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';
import { ParentDetail } from './components/ParentDetail';
import { ParentForm } from './components/ParentForm';
import { ParentTable } from './components/ParentTable';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function ParentsPage() {
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingParents, setLoadingParents] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [selectedParent, setSelectedParent] = useState<ParentRecord | null>(null);
  const [editingParent, setEditingParent] = useState<ParentRecord | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const selectedParentId = selectedParent?.id ?? null;
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch]);

  useEffect(() => {
    setLoadingParents(true);

    void apiFetch<ApiSuccessResponse<ParentRecord[]>>(
      `/parents${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
      })}`,
    )
      .then((response) => {
        setParents(response.data);
        setMeta(response.meta ?? initialMeta);

        if (selectedParentId) {
          const matchedParent = response.data.find(
            (parent) => parent.id === selectedParentId,
          );

          if (matchedParent) {
            setSelectedParent(matchedParent);
          }
        }
      })
      .catch((error) => {
        setParents([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load parents.',
        });
      })
      .finally(() => {
        setLoadingParents(false);
      });
  }, [deferredSearch, page, reloadIndex, selectedParentId]);

  useEffect(() => {
    setLoadingStudents(true);

    void apiFetch<ApiSuccessResponse<StudentRecord[]>>(
      '/students?page=1&limit=100',
    )
      .then((response) => {
        setStudents(response.data);
      })
      .catch((error) => {
        setStudents([]);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load students.',
        });
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, []);

  const loadParentDetail = async (parentId: string) => {
    setLoadingDetail(true);

    try {
      const response = await apiFetch<ApiSuccessResponse<ParentRecord>>(
        `/parents/${parentId}`,
      );
      setSelectedParent(response.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to load parent details.',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmit = async (payload: ParentFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingParent
        ? await apiFetch<ApiSuccessResponse<ParentRecord>>(
            `/parents/${editingParent.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<ParentRecord>>('/parents', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingParent(null);
      setSelectedParent(response.data);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingParent
              ? 'Failed to update parent.'
              : 'Failed to create parent.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkStudent = async (
    parentId: string,
    payload: { studentId: string; relationType?: ParentRelationType },
  ) => {
    setLinking(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<unknown>>(
        `/parents/${parentId}/link-student`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      await loadParentDetail(parentId);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to link student.',
      });
    } finally {
      setLinking(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<ParentRecord>({
        path: '/parents',
        params: {
          search: deferredSearch || undefined,
        },
        columns: parentCsvColumns,
        filename: buildCsvFilename('parents'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} parent record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export parents.',
      });
    }
  };

  return (
    <div className="parents-page">
      <section className="card panel parents-toolbar">
        <div>
          <h2>Parents & Guardians</h2>
          <p className="muted-text">
            Create guardian profiles, enable portal access, and link multiple children safely.
          </p>
        </div>

        <div className="students-toolbar-actions">
          <Input
            className="search-input"
            placeholder="Search by parent name, phone, or email"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        </div>
      </section>

      {message ? (
        <Banner tone={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Banner>
      ) : null}

      <div className="parents-layout">
        <div className="parents-sidebar-stack">
          <section className="card panel">
            <ParentForm
              initialValue={editingParent}
              onCancel={() => setEditingParent(null)}
              onSubmit={handleSubmit}
              students={students}
              submitting={submitting}
            />
          </section>

          <ParentDetail
            linking={linking}
            loading={loadingDetail || loadingStudents}
            onEdit={(parent) => setEditingParent(parent)}
            onLinkStudent={handleLinkStudent}
            onRefresh={(parentId) => void loadParentDetail(parentId)}
            parent={selectedParent}
            students={students}
          />
        </div>

        <ParentTable
          loading={loadingParents}
          meta={meta}
          onEdit={(parent) => setEditingParent(parent)}
          onPageChange={setPage}
          onView={(parent) => void loadParentDetail(parent.id)}
          parents={parents}
        />
      </div>
    </div>
  );
}
