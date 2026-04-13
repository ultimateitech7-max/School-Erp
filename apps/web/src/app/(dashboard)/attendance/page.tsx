'use client';

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AttendanceForm } from './components/AttendanceForm';
import { AttendanceSummary } from './components/AttendanceSummary';
import { AttendanceTable } from './components/AttendanceTable';
import { BulkAttendanceForm } from './components/BulkAttendanceForm';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type AttendanceFormPayload,
  type AttendanceOptionsPayload,
  type AttendanceRecord,
  type AttendanceStatus,
  type AttendanceSummaryRecord,
  type BulkAttendancePayload,
  type UpdateAttendancePayload,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { attendanceCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: AttendanceOptionsPayload = {
  currentSessionId: '',
  currentSessionName: '',
  classes: [],
  students: [],
  statuses: ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'],
};

const emptySummary: AttendanceSummaryRecord = {
  total: 0,
  totalPresent: 0,
  totalAbsent: 0,
  totalLate: 0,
  totalLeave: 0,
};

export default function AttendancePage() {
  const [session, setSession] = useState<AuthSession | null>(() =>
    getStoredAuthSession(),
  );
  const [options, setOptions] = useState<AttendanceOptionsPayload>(emptyOptions);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryRecord>(emptySummary);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [submittingSingle, setSubmittingSingle] = useState(false);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<AttendanceRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [attendanceDate, classId, sectionId, studentId, status, deferredSearch]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<AttendanceOptionsPayload>>('/attendance/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load attendance options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingRecords(true);

    void apiFetch<ApiSuccessResponse<AttendanceRecord[]>>(
      `/attendance${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        attendanceDate,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        studentId: studentId || undefined,
        status: status || undefined,
      })}`,
    )
      .then((response) => {
        setRecords(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setRecords([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load attendance records.',
        });
      })
      .finally(() => {
        setLoadingRecords(false);
      });
  }, [attendanceDate, classId, deferredSearch, page, reloadIndex, sectionId, session, status, studentId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingSummary(true);

    void apiFetch<ApiSuccessResponse<AttendanceSummaryRecord>>(
      `/attendance/summary${createQueryString({
        attendanceDate,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        studentId: studentId || undefined,
        status: status || undefined,
      })}`,
    )
      .then((response) => {
        setSummary(response.data);
      })
      .catch((error) => {
        setSummary(emptySummary);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load attendance summary.',
        });
      })
      .finally(() => {
        setLoadingSummary(false);
      });
  }, [attendanceDate, classId, reloadIndex, sectionId, session, status, studentId]);

  const canManageAttendance =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'SCHOOL_ADMIN' ||
    session?.user.role === 'TEACHER';
  const initialContentLoading =
    loadingOptions && loadingRecords && loadingSummary && records.length === 0;

  const filteredStudents = useMemo(() => {
    return options.students.filter((student) => {
      if (classId && student.classId !== classId) {
        return false;
      }

      if (sectionId && student.sectionId !== sectionId) {
        return false;
      }

      return true;
    });
  }, [classId, options.students, sectionId]);

  const availableSections = useMemo(() => {
    const selectedClass = options.classes.find(
      (academicClass) => academicClass.id === classId,
    );

    return selectedClass?.sections ?? [];
  }, [classId, options.classes]);

  const handleCreateAttendance = async (payload: AttendanceFormPayload) => {
    setSubmittingSingle(true);
    setMessage(null);

    try {
      if (editingRecord) {
        const updatePayload: UpdateAttendancePayload = {
          status: payload.status,
          remarks: payload.remarks,
        };

        await apiFetch<ApiSuccessResponse<AttendanceRecord>>(
          `/attendance/${editingRecord.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(updatePayload),
          },
        );
      } else {
        await apiFetch<ApiSuccessResponse<AttendanceRecord>>('/attendance', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setMessage({
        type: 'success',
        text: editingRecord
          ? 'Attendance updated successfully.'
          : 'Attendance marked successfully.',
      });
      setEditingRecord(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to save attendance record.',
      });
    } finally {
      setSubmittingSingle(false);
    }
  };

  const handleBulkAttendance = async (payload: BulkAttendancePayload) => {
    setSubmittingBulk(true);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<AttendanceRecord[]>>('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: 'Bulk attendance saved successfully.',
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to save bulk attendance.',
      });
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleDelete = async (record: AttendanceRecord) => {
    setPendingDeleteRecord(record);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteRecord) {
      return;
    }

    setDeletingId(pendingDeleteRecord.id);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<{ id: string; deleted: true }>>(
        `/attendance/${pendingDeleteRecord.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: 'Attendance deleted successfully.',
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to delete attendance.',
      });
    } finally {
      setDeletingId(null);
      setPendingDeleteRecord(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<AttendanceRecord>({
        path: '/attendance',
        params: {
          search: deferredSearch || undefined,
          attendanceDate,
          classId: classId || undefined,
          sectionId: sectionId || undefined,
          studentId: studentId || undefined,
          status: status || undefined,
        },
        columns: attendanceCsvColumns,
        filename: buildCsvFilename('attendance-records'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} attendance record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to export attendance.',
      });
    }
  };

  if (!session) {
    return (
      <section className="card panel">
        <Spinner label="Loading attendance module..." />
      </section>
    );
  }

  if (initialContentLoading) {
    return (
      <section className="card panel">
        <Spinner label="Loading attendance content..." />
      </section>
    );
  }

  if (!canManageAttendance) {
    return (
      <section className="card panel">
        <h2>Attendance Access Restricted</h2>
        <p className="muted-text">
          Only school admins and teachers can manage attendance.
        </p>
      </section>
    );
  }

  return (
    <div className="attendance-page">
      {message ? (
        <section
          className={`card panel banner ${
            message.type === 'success' ? 'banner-success' : 'banner-error'
          }`}
        >
          {message.text}
        </section>
      ) : null}

      <AttendanceSummary loading={loadingSummary} summary={summary} />

      <section className="card panel">
        <div className="attendance-toolbar">
          <label className="field search-input">
            <span>Search</span>
            <input
              placeholder="Search by student or class"
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          <div className="toolbar-actions">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Class</span>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setSectionId('');
                  setStudentId('');
                }}
              >
                <option value="">All classes</option>
                {options.classes.map((academicClass) => (
                  <option key={academicClass.id} value={academicClass.id}>
                    {academicClass.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Section</span>
              <select
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
              >
                <option value="">All sections</option>
                {availableSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Student</span>
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                <option value="">All students</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as AttendanceStatus | '')
                }
              >
                <option value="">All statuses</option>
                {options.statuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <CsvDownloadButton
              label="Download CSV"
              loadingLabel="Exporting..."
              onDownload={handleExportCsv}
            />
          </div>
        </div>
      </section>

      <div className="attendance-grid">
        <AttendanceForm
          mode={editingRecord ? 'edit' : 'create'}
          options={options}
          initialRecord={editingRecord}
          submitting={submittingSingle}
          onSubmit={handleCreateAttendance}
          onCancel={() => setEditingRecord(null)}
        />

        <AttendanceTable
          records={records}
          loading={loadingRecords || loadingOptions}
          deletingId={deletingId}
          meta={meta}
          onEdit={setEditingRecord}
          onDelete={handleDelete}
          onPageChange={setPage}
        />
      </div>

      <BulkAttendanceForm
        options={options}
        submitting={submittingBulk}
        onSubmit={handleBulkAttendance}
      />

      <ConfirmDialog
        confirmLabel="Delete attendance"
        description={
          pendingDeleteRecord
            ? `Delete attendance for ${pendingDeleteRecord.student.name} on ${pendingDeleteRecord.attendanceDate.slice(0, 10)}?`
            : 'Delete this attendance record?'
        }
        loading={Boolean(pendingDeleteRecord && deletingId === pendingDeleteRecord.id)}
        open={Boolean(pendingDeleteRecord)}
        onClose={() => setPendingDeleteRecord(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete attendance record"
      />
    </div>
  );
}
