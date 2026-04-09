'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Select } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type TimetableEntryRecord,
  type TimetableFormPayload,
  type TimetableOptionsPayload,
  type UpdateTimetableFormPayload,
} from '@/utils/api';
import { TimetableForm } from './components/TimetableForm';
import { TimetableGrid } from './components/TimetableGrid';

export default function TimetablesPage() {
  const [options, setOptions] = useState<TimetableOptionsPayload | null>(null);
  const [entries, setEntries] = useState<TimetableEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TimetableEntryRecord | null>(
    null,
  );
  const [entryPendingDelete, setEntryPendingDelete] =
    useState<TimetableEntryRecord | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<TimetableOptionsPayload>>('/timetables/options')
      .then((response) => {
        setOptions(response.data);
        setClassId((current) => current || response.data.classes[0]?.id || '');
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load timetable options.',
        });
      });
  }, []);

  useEffect(() => {
    setLoading(true);

    const endpoint = classId
      ? `/timetables/class/${classId}${createQueryString({
          sectionId: sectionId || undefined,
        })}`
      : `/timetables${createQueryString({
          sectionId: sectionId || undefined,
        })}`;

    void apiFetch<ApiSuccessResponse<TimetableEntryRecord[]>>(endpoint)
      .then((response) => {
        setEntries(response.data);
      })
      .catch((error) => {
        setEntries([]);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load timetable entries.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [classId, reloadIndex, sectionId]);

  const sections = useMemo(() => {
    const matchedClass = options?.classes.find((item) => item.id === classId);
    return matchedClass?.sections ?? [];
  }, [classId, options?.classes]);

  const handleCreate = async (payload: TimetableFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<TimetableEntryRecord>>(
        '/timetables',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      setMessage({
        type: 'success',
        text: response.message,
      });
      setReloadIndex((current) => current + 1);
      setClassId(payload.classId);
      setSectionId(payload.sectionId ?? '');
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to create timetable entry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload: TimetableFormPayload) => {
    if (!selectedEntry) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<TimetableEntryRecord>>(
        `/timetables/${selectedEntry.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload satisfies UpdateTimetableFormPayload),
        },
      );
      setMessage({
        type: 'success',
        text: response.message,
      });
      setSelectedEntry(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to update timetable entry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entryPendingDelete) {
      return;
    }

    setDeletingEntryId(entryPendingDelete.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `/timetables/${entryPendingDelete.id}`,
        {
          method: 'DELETE',
        },
      );
      setMessage({
        type: 'success',
        text: response.message,
      });
      setEntryPendingDelete(null);
      if (selectedEntry?.id === entryPendingDelete.id) {
        setSelectedEntry(null);
      }
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to delete timetable entry.',
      });
    } finally {
      setDeletingEntryId(null);
    }
  };

  return (
    <div className="dashboard-stack">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Timetable Planner</h2>
          <p className="muted-text">
            Build weekly schedules by class, section, subject, and teacher.
          </p>
        </div>

        <div className="toolbar-actions">
          <Field label="Class">
            <Select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setSectionId('');
              }}
            >
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
        </div>
      </section>

      {message ? (
        <Banner tone={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Banner>
      ) : null}

      <div className="academic-grid">
        <TimetableForm
          initialEntry={selectedEntry}
          options={options}
          onCancel={() => setSelectedEntry(null)}
          onSubmit={selectedEntry ? handleUpdate : handleCreate}
          submitLabel={selectedEntry ? 'Save Entry' : 'Add Entry'}
          submitting={submitting}
        />
        <TimetableGrid
          deletingEntryId={deletingEntryId}
          entries={entries}
          loading={loading}
          onDelete={(entry) => setEntryPendingDelete(entry)}
          onSelect={(entry) => setSelectedEntry(entry)}
          selectedEntryId={selectedEntry?.id ?? null}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete Entry"
        description="This timetable slot will be removed from the weekly grid."
        loading={Boolean(deletingEntryId)}
        onClose={() => {
          if (!deletingEntryId) {
            setEntryPendingDelete(null);
          }
        }}
        onConfirm={() => void handleDelete()}
        open={Boolean(entryPendingDelete)}
        title="Delete timetable entry?"
      />
    </div>
  );
}
