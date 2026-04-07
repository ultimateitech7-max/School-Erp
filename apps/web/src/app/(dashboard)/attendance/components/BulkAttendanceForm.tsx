'use client';

import { type FormEvent, useMemo, useState } from 'react';
import type {
  AttendanceOptionsPayload,
  AttendanceStatus,
  BulkAttendancePayload,
} from '@/utils/api';

interface BulkAttendanceFormProps {
  options: AttendanceOptionsPayload;
  submitting: boolean;
  onSubmit: (payload: BulkAttendancePayload) => Promise<void>;
}

interface StudentAttendanceInput {
  studentId: string;
  name: string;
  studentCode: string;
  status: AttendanceStatus;
  remarks: string;
}

export function BulkAttendanceForm({
  options,
  submitting,
  onSubmit,
}: BulkAttendanceFormProps) {
  const [classId, setClassId] = useState(options.classes[0]?.id ?? '');
  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [records, setRecords] = useState<StudentAttendanceInput[]>([]);

  const selectedClass = useMemo(
    () => options.classes.find((academicClass) => academicClass.id === classId) ?? null,
    [classId, options.classes],
  );

  const filteredStudents = useMemo(() => {
    return options.students
      .filter((student) => student.classId === classId)
      .filter((student) => !sectionId || student.sectionId === sectionId)
      .map((student) => ({
        studentId: student.id,
        name: student.name,
        studentCode: student.studentCode,
        status: 'PRESENT' as AttendanceStatus,
        remarks: '',
      }));
  }, [classId, options.students, sectionId]);

  const effectiveRecords = records.length > 0 ? records : filteredStudents;

  const updateRecords = (nextRecords: StudentAttendanceInput[]) => {
    setRecords(nextRecords);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      classId,
      sectionId: sectionId || undefined,
      attendanceDate,
      sessionId: options.currentSessionId,
      records: effectiveRecords.map((record) => ({
        studentId: record.studentId,
        status: record.status,
        remarks: record.remarks.trim() || undefined,
      })),
    });

    setRecords([]);
  };

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Bulk Attendance</h2>
          <p className="muted-text">
            Mark attendance for all students in a class or section.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Class</span>
          <select
            required
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setSectionId('');
              setRecords([]);
            }}
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
            value={sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              setRecords([]);
            }}
          >
            <option value="">All sections</option>
            {(selectedClass?.sections ?? []).map((section) => (
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
            value={attendanceDate}
            onChange={(event) => setAttendanceDate(event.target.value)}
          />
        </label>

        {effectiveRecords.length === 0 ? (
          <div className="empty-state">
            <strong>No students available for the selected class.</strong>
            <p className="muted-text">
              Choose another class or section to mark bulk attendance.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {effectiveRecords.map((record) => (
                  <tr key={record.studentId}>
                    <td>
                      {record.name} ({record.studentCode})
                    </td>
                    <td>
                      <select
                        value={record.status}
                        onChange={(event) =>
                          updateRecords(
                            effectiveRecords.map((current) =>
                              current.studentId === record.studentId
                                ? {
                                    ...current,
                                    status: event.target.value as AttendanceStatus,
                                  }
                                : current,
                            ),
                          )
                        }
                      >
                        {options.statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={record.remarks}
                        onChange={(event) =>
                          updateRecords(
                            effectiveRecords.map((current) =>
                              current.studentId === record.studentId
                                ? {
                                    ...current,
                                    remarks: event.target.value,
                                  }
                                : current,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          className="primary-button"
          disabled={!classId || effectiveRecords.length === 0 || submitting}
          type="submit"
        >
          {submitting ? 'Saving...' : 'Save Bulk Attendance'}
        </button>
      </form>
    </section>
  );
}
