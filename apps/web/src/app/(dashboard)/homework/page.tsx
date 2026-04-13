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
  type HomeworkFormPayload,
  type HomeworkOptionsPayload,
  type HomeworkRecord,
} from '@/utils/api';
import { homeworkCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';
import { HomeworkForm } from './HomeworkForm';
import { HomeworkTable } from './HomeworkTable';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function HomeworkPage() {
  const [items, setItems] = useState<HomeworkRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [options, setOptions] = useState<HomeworkOptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const deferredSearch = useDeferredValue(searchInput);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<HomeworkOptionsPayload>>('/homework/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load homework options.',
        });
      });
  }, []);

  useEffect(() => {
    startTransition(() => setPage(1));
  }, [deferredSearch, classId, sectionId]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<HomeworkRecord[]>>(
      `/homework${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
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
          text: error instanceof Error ? error.message : 'Failed to load homework.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, deferredSearch, classId, sectionId, reloadIndex]);

  const sections = options?.classes.find((item) => item.id === classId)?.sections ?? [];

  const handleSubmit = async (payload: HomeworkFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<HomeworkRecord>>('/homework', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage({ type: 'success', text: response.message });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create homework.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<HomeworkRecord>({
        path: '/homework',
        params: {
          search: deferredSearch || undefined,
          classId: classId || undefined,
          sectionId: sectionId || undefined,
        },
        columns: homeworkCsvColumns,
        filename: buildCsvFilename('homework'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} homework record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export homework.',
      });
    }
  };

  return (
    <div className="dashboard-stack">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Homework Tracker</h2>
          <p className="muted-text">
            Manage class-wise homework, due dates, and teacher accountability.
          </p>
        </div>

        <div className="toolbar-actions">
          <Field label="Search">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search homework"
            />
          </Field>
          <Field label="Class">
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {options?.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section">
            <Select
              disabled={!classId}
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            >
              <option value="">All sections</option>
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
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
        <HomeworkForm options={options} submitting={submitting} onSubmit={handleSubmit} />
        <HomeworkTable items={items} loading={loading} meta={meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
