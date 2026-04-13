'use client';

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type ExamDateSheetFormPayload,
  type ExamDateSheetOptionsPayload,
  type ExamDateSheetRecord,
} from '@/utils/api';
import { examDateSheetCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';
import { ExamDateSheetForm } from './components/ExamDateSheetForm';
import { ExamDateSheetTable } from './components/ExamDateSheetTable';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function ExamDateSheetsPage() {
  const [options, setOptions] = useState<ExamDateSheetOptionsPayload | null>(null);
  const [items, setItems] = useState<ExamDateSheetRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [classId, setClassId] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [editingItem, setEditingItem] = useState<ExamDateSheetRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchInput);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<ExamDateSheetOptionsPayload>>(
      '/exam-date-sheets/options',
    )
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load exam date sheet options.',
        });
      });
  }, []);

  useEffect(() => {
    startTransition(() => setPage(1));
  }, [classId, publishedFilter, deferredSearch]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<ExamDateSheetRecord[]>>(
      `/exam-date-sheets${createQueryString({
        page,
        limit: initialMeta.limit,
        classId: classId || undefined,
        isPublished:
          publishedFilter === ''
            ? undefined
            : publishedFilter === 'published',
        search: deferredSearch || undefined,
      })}`,
    )
      .then((response) => {
        setItems(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setItems([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to fetch exam date sheets.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [classId, publishedFilter, deferredSearch, page, reloadIndex]);

  const classOptions = useMemo(() => options?.classes ?? [], [options?.classes]);

  const handleCreateOrUpdate = async (payload: ExamDateSheetFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingItem
        ? await apiFetch<ApiSuccessResponse<ExamDateSheetRecord>>(
            `/exam-date-sheets/${editingItem.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<ExamDateSheetRecord>>('/exam-date-sheets', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setClassId(payload.classId);
      setEditingItem(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingItem
              ? 'Failed to update exam date sheet.'
              : 'Failed to create exam date sheet.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this exam date sheet?')) {
      return;
    }

    setDeletingId(id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string }>>(
        `/exam-date-sheets/${id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingItem((current) => (current?.id === id ? null : current));
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete exam date sheet.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (id: string) => {
    setPublishingId(id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<ExamDateSheetRecord>>(
        `/exam-date-sheets/${id}/publish`,
        {
          method: 'PATCH',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to publish exam date sheet.',
      });
    } finally {
      setPublishingId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<ExamDateSheetRecord>({
        path: '/exam-date-sheets',
        params: {
          classId: classId || undefined,
          isPublished:
            publishedFilter === ''
              ? undefined
              : publishedFilter === 'published',
          search: deferredSearch || undefined,
        },
        columns: examDateSheetCsvColumns,
        filename: buildCsvFilename('exam-date-sheets'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} exam date sheet${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to export exam date sheets.',
      });
    }
  };

  return (
    <div className="dashboard-stack">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Exam Date Sheet Planner</h2>
          <p className="muted-text">
            Schedule class-wise exam slots and prepare printable exam notices.
          </p>
          <div className="chip-list">
            <Badge tone="info">Draft and published workflows</Badge>
            <Badge tone="neutral">Printable layout ready</Badge>
          </div>
        </div>

        <div className="toolbar-actions">
          <Field label="Class">
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Search">
            <Input
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by exam name"
              value={searchInput}
            />
          </Field>

          <Field label="Status">
            <Select
              value={publishedFilter}
              onChange={(event) => setPublishedFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        </div>
      </section>

      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <div className="dashboard-stack">
        <ExamDateSheetForm
          initialValue={editingItem}
          onCancel={() => setEditingItem(null)}
          onSubmit={handleCreateOrUpdate}
          options={options}
          submitting={submitting}
        />
        <ExamDateSheetTable
          deletingId={deletingId}
          items={items}
          loading={loading}
          meta={meta}
          onDelete={handleDelete}
          onEdit={setEditingItem}
          onPageChange={setPage}
          onPublish={handlePublish}
          publishingId={publishingId}
        />
      </div>
    </div>
  );
}
