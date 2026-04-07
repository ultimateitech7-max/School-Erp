'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AttendanceFormPayload,
  AttendanceOptionsPayload,
  AttendanceRecord,
  AttendanceStatus,
} from '@/utils/api';

interface AttendanceFormProps {
  mode: 'create' | 'edit';
  options: AttendanceOptionsPayload;
  initialRecord?: AttendanceRecord | null;
  submitting: boolean;
  onSubmit: (payload: AttendanceFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface AttendanceFormState {
  studentId: string;
  classId: string;
  sectionId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string;
}

const initialFormState: AttendanceFormState = {
  studentId: '',
  classId: '',
  sectionId: '',
  attendanceDate: '',
  status: 'PRESENT',
  remarks: '',
};

export function AttendanceForm({
  mode,
  options,
  initialRecord,
  submitting,
  onSubmit,
  onCancel,
}: AttendanceFormProps) {
  const [form, setForm] = useState<AttendanceFormState>(initialFormState);

  useEffect(() => {
    if (initialRecord) {
      setForm({
        studentId: initialRecord.student.id,
        classId: initialRecord.class.id,
        sectionId: initialRecord.section?.id ?? '',
        attendanceDate: initialRecord.attendanceDate.slice(0, 10),
        status: initialRecord.status,
        remarks: initialRecord.remarks ?? '',
      });
      return;
    }

    setForm({
      ...initialFormState,
      studentId: options.students[0]?.id ?? '',
      classId: options.students[0]?.classId ?? options.classes[0]?.id ?? '',
      sectionId: options.students[0]?.sectionId ?? '',
      attendanceDate: new Date().toISOString().slice(0, 10),
      status: options.statuses[0] ?? 'PRESENT',
    });
  }, [initialRecord, options.classes, options.statuses, options.students]);

  const selectedStudent = useMemo(
    () => options.students.find((student) => student.id === form.studentId) ?? null,
    [form.studentId, options.students],
  );

  const availableSections = useMemo(() => {
    const selectedClass = options.classes.find(
      (academicClass) => academicClass.id === form.classId,
    );

    return selectedClass?.sections ?? [];
  }, [form.classId, options.classes]);

  useEffect(() => {
    if (selectedStudent && !initialRecord) {
      setForm((current) => ({
        ...current,
        classId: selectedStudent.classId ?? current.classId,
        sectionId: selectedStudent.sectionId ?? '',
      }));
    }
  }, [initialRecord, selectedStudent]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      studentId: form.studentId,
      classId: form.classId || undefined,
      sectionId: form.sectionId || undefined,
      attendanceDate: form.attendanceDate,
      status: form.status,
      remarks: form.remarks.trim() || undefined,
      sessionId: options.currentSessionId,
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Attendance' : 'Mark Attendance'}</h2>
          <p className="muted-text">
            Record attendance for an individual student.
          </p>
        </div>

        {mode === 'edit' && onCancel ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Student</span>
          <select
            required
            value={form.studentId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                studentId: event.target.value,
              }))
            }
          >
            <option value="">Select student</option>
            {options.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.studentCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Class</span>
          <select
            required
            value={form.classId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                classId: event.target.value,
                sectionId: '',
              }))
            }
          >
            <option value="">Select class</option>
            {options.classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Section</span>
          <select
            value={form.sectionId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sectionId: event.target.value,
              }))
            }
          >
            <option value="">All sections</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Date</span>
          <input
            required
            type="date"
            value={form.attendanceDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                attendanceDate: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as AttendanceStatus,
              }))
            }
          >
            {options.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Remarks</span>
          <input
            type="text"
            value={form.remarks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                remarks: event.target.value,
              }))
            }
          />
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? mode === 'edit'
              ? 'Saving...'
              : 'Marking...'
            : mode === 'edit'
              ? 'Save Attendance'
              : 'Mark Attendance'}
        </button>
      </form>
    </section>
  );
}
