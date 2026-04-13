'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type NoticeAudienceType,
  type NoticeFormPayload,
  type NoticeRecord,
} from '@/utils/api';
import { noticeCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';
import { NoticeForm } from './components/NoticeForm';
import { NoticeTable } from './components/NoticeTable';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function NoticesPage() {
  const [items, setItems] = useState<NoticeRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<NoticeRecord | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [audienceType, setAudienceType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const deferredSearch = useDeferredValue(searchInput);

  useEffect(() => {
    startTransition(() => setPage(1));
  }, [audienceType, statusFilter, deferredSearch]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<NoticeRecord[]>>(
      `/notices${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch || undefined,
        audienceType: audienceType || undefined,
        isPublished:
          statusFilter === ''
            ? undefined
            : statusFilter === 'published',
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
          text: error instanceof Error ? error.message : 'Failed to fetch notices.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, deferredSearch, audienceType, statusFilter, reloadIndex]);

  const handleSubmit = async (payload: NoticeFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = selectedNotice
        ? await apiFetch<ApiSuccessResponse<NoticeRecord>>(`/notices/${selectedNotice.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<ApiSuccessResponse<NoticeRecord>>('/notices', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setSelectedNotice(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save notice.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<NoticeRecord>({
        path: '/notices',
        params: {
          search: deferredSearch || undefined,
          audienceType: audienceType || undefined,
          isPublished:
            statusFilter === ''
              ? undefined
              : statusFilter === 'published',
        },
        columns: noticeCsvColumns,
        filename: buildCsvFilename('notices'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} notice${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export notices.',
      });
    }
  };

  return (
    <div className="dashboard-stack">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Notice Board</h2>
          <p className="muted-text">
            Create targeted announcements for portal users and school stakeholders.
          </p>
        </div>

        <div className="toolbar-actions">
          <Field label="Search">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search notices"
            />
          </Field>

          <Field label="Audience">
            <Select value={audienceType} onChange={(event) => setAudienceType(event.target.value)}>
              <option value="">All audiences</option>
              <option value="ALL">All</option>
              <option value="STUDENTS">Students</option>
              <option value="PARENTS">Parents</option>
              <option value="STAFF">Staff</option>
            </Select>
          </Field>

          <Field label="Status">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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

      <div className="academic-grid">
        <NoticeForm
          notice={selectedNotice}
          onCancelEdit={() => setSelectedNotice(null)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        <NoticeTable
          items={items}
          loading={loading}
          meta={meta}
          onEdit={setSelectedNotice}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
