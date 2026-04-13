'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Select } from '@/components/ui/field';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type TimetableEntryRecord,
  type TimetableFormPayload,
  type TimetableOptionsPayload,
  type UpdateTimetableFormPayload,
} from '@/utils/api';
import { timetableCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportRowsToCsv } from '@/utils/csv';
import { TimetableForm } from './components/TimetableForm';
import { TimetableGrid } from './components/TimetableGrid';

export default function TimetablesPage() {
  const [session] = useState<AuthSession | null>(() => getStoredAuthSession());
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
  const selectedClass = useMemo(
    () => options?.classes.find((item) => item.id === classId) ?? null,
    [classId, options?.classes],
  );
  const selectedSection = useMemo(
    () => sections.find((item) => item.id === sectionId) ?? null,
    [sectionId, sections],
  );
  const canReadTimetable = Boolean(session?.permissions.includes('academics.read'));
  const canManageTimetable = Boolean(session?.permissions.includes('academics.manage'));

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

  const handleExportCsv = async () => {
    const count = exportRowsToCsv(entries, timetableCsvColumns, buildCsvFilename('timetable'));
    setMessage({
      type: 'success',
      text: `Downloaded ${count} timetable entr${count === 1 ? 'y' : 'ies'} as CSV.`,
    });
  };

  if (!canReadTimetable) {
    return (
      <section className="card panel">
        <h2>Timetable Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to access timetables.
        </p>
      </section>
    );
  }

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
                setSelectedEntry(null);
              }}
            >
              {!canManageTimetable ? <option value="">All classes</option> : null}
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
              onChange={(event) => {
                setSectionId(event.target.value);
                setSelectedEntry(null);
              }}
            >
              <option value="">
                {canManageTimetable ? 'Class-wide / All sections' : 'All sections'}
              </option>
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

      {message ? (
        <Banner tone={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Banner>
      ) : null}

      <div className="dashboard-stack">
        {canManageTimetable ? (
          <TimetableForm
            initialEntry={selectedEntry}
            onCancel={() => setSelectedEntry(null)}
            onSubmit={selectedEntry ? handleUpdate : handleCreate}
            options={options}
            selectedClassId={classId}
            selectedClassName={selectedClass?.name ?? ''}
            selectedSectionId={sectionId}
            selectedSectionName={selectedSection?.name ?? ''}
            submitLabel={selectedEntry ? 'Save Entry' : 'Add Entry'}
            submitting={submitting}
          />
        ) : null}
        <TimetableGrid
          deletingEntryId={deletingEntryId}
          entries={entries}
          loading={loading}
          onDelete={canManageTimetable ? (entry) => setEntryPendingDelete(entry) : undefined}
          onSelect={canManageTimetable ? (entry) => setSelectedEntry(entry) : undefined}
          selectedEntryId={selectedEntry?.id ?? null}
          showActions={canManageTimetable}
        />
      </div>

      {canManageTimetable ? (
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
      ) : null}
    </div>
  );
}
