'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudentForm } from './components/StudentForm';
import { StudentTable } from './components/StudentTable';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type StudentFormPayload,
  type StudentOptionsPayload,
  type StudentRecord,
} from '@/utils/api';
import { studentCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: StudentOptionsPayload = {
  currentSessionId: null,
  currentSessionName: null,
  classes: [],
};

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [options, setOptions] = useState<StudentOptionsPayload>(emptyOptions);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState<StudentRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [registrationSearch, setRegistrationSearch] = useState('');
  const [registrationLookupLoading, setRegistrationLookupLoading] = useState(false);
  const deferredSearch = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<StudentOptionsPayload>>('/students/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load class and section options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch]);

  useEffect(() => {
    setLoadingStudents(true);

    void apiFetch<ApiSuccessResponse<StudentRecord[]>>(
      `/students${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
      })}`,
    )
      .then((response) => {
        setStudents(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setStudents([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load students.',
        });
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [deferredSearch, page, reloadIndex]);

  const handleSubmit = async (payload: StudentFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingStudent
        ? await apiFetch<ApiSuccessResponse<StudentRecord>>(
            `/students/${editingStudent.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<StudentRecord>>('/students', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingStudent(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingStudent
              ? 'Failed to update student.'
              : 'Failed to create student.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (student: StudentRecord) => {
    setPendingDeleteStudent(student);
    setMessage(null);
  };

  const handleRegistrationLookup = async () => {
    const normalizedRegistrationNumber = registrationSearch.trim().toUpperCase();

    if (!normalizedRegistrationNumber) {
      setMessage({
        type: 'error',
        text: 'Enter a registration number to search.',
      });
      return;
    }

    setRegistrationLookupLoading(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<StudentRecord>>(
        `/students/registration/${encodeURIComponent(normalizedRegistrationNumber)}`,
      );

      router.push(`/students/${response.data.id}`);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to find student by registration number.',
      });
    } finally {
      setRegistrationLookupLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<StudentRecord>({
        path: '/students',
        params: {
          search: deferredSearch || undefined,
        },
        columns: studentCsvColumns,
        filename: buildCsvFilename('students'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} student record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to export students.',
      });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteStudent) {
      return;
    }

    setDeletingStudentId(pendingDeleteStudent.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/students/${pendingDeleteStudent.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });

      if (students.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadIndex((current) => current + 1);
      }

      if (editingStudent?.id === pendingDeleteStudent.id) {
        setEditingStudent(null);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete student.',
      });
    } finally {
      setDeletingStudentId(null);
      setPendingDeleteStudent(null);
    }
  };

  return (
    <div className="students-page">
      <section className="card panel students-toolbar">
        <div>
          <h2>Student Management</h2>
          <p className="muted-text">
            Search, create, update, and remove students for the active school.
          </p>
        </div>

        <div className="students-toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by name, registration no, or admission no"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <div className="toolbar-inline-actions">
            <input
              className="search-input"
              placeholder="Find by registration no"
              type="search"
              value={registrationSearch}
              onChange={(event) => setRegistrationSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleRegistrationLookup();
                }
              }}
            />
            <button
              className="secondary-button"
              disabled={registrationLookupLoading}
              onClick={() => void handleRegistrationLookup()}
              type="button"
            >
              {registrationLookupLoading ? 'Searching...' : 'Find Student'}
            </button>
            <CsvDownloadButton
              label="Download CSV"
              loadingLabel="Exporting..."
              onDownload={handleExportCsv}
            />
          </div>
          {editingStudent ? (
            <button
              className="secondary-button"
              onClick={() => setEditingStudent(null)}
              type="button"
            >
              New Student
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

      <div className="students-grid">
        <StudentForm
          mode={editingStudent ? 'edit' : 'create'}
          classes={options.classes}
          currentSessionId={options.currentSessionId}
          currentSessionName={options.currentSessionName}
          initialStudent={editingStudent}
          submitting={submitting || loadingOptions}
          onSubmit={handleSubmit}
          onCancel={editingStudent ? () => setEditingStudent(null) : undefined}
        />

        <StudentTable
          students={students}
          loading={loadingStudents}
          deletingStudentId={deletingStudentId}
          meta={meta}
          onEdit={setEditingStudent}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Delete student"
        description={
          pendingDeleteStudent
            ? `Delete ${pendingDeleteStudent.name}? This will remove the student from active lists.`
            : 'Delete this student?'
        }
        loading={Boolean(
          pendingDeleteStudent && deletingStudentId === pendingDeleteStudent.id,
        )}
        open={Boolean(pendingDeleteStudent)}
        onClose={() => setPendingDeleteStudent(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete student"
      />
    </div>
  );
}
