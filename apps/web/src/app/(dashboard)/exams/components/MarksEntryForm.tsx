'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ExamRecord,
  ExamsOptionsPayload,
  MarksEntryPayload,
} from '@/utils/api';

interface MarksEntryFormProps {
  exam: ExamRecord | null;
  options: ExamsOptionsPayload;
  isSubmitting: boolean;
  onSubmit: (payload: MarksEntryPayload) => Promise<void>;
}

interface MarkRowState {
  studentId: string;
  subjectId: string;
  marksObtained: string;
  remarks: string;
  isAbsent: boolean;
}

const createDefaultRow = (): MarkRowState => ({
  studentId: '',
  subjectId: '',
  marksObtained: '',
  remarks: '',
  isAbsent: false,
});

export function MarksEntryForm({
  exam,
  options,
  isSubmitting,
  onSubmit,
}: MarksEntryFormProps) {
  const [rows, setRows] = useState<MarkRowState[]>([createDefaultRow()]);

  const availableStudents = useMemo(() => {
    if (!exam?.class?.id) {
      return options.students;
    }

    return options.students.filter((student) => student.classId === exam.class?.id);
  }, [exam, options.students]);

  useEffect(() => {
    if (!exam) {
      setRows([createDefaultRow()]);
      return;
    }

    setRows([
      {
        studentId: availableStudents[0]?.id ?? '',
        subjectId: exam.subjects[0]?.subjectId ?? '',
        marksObtained: '',
        remarks: '',
        isAbsent: false,
      },
    ]);
  }, [availableStudents, exam]);

  const handleChange = (
    index: number,
    key: keyof MarkRowState,
    value: boolean | string,
  ) => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        studentId: availableStudents[0]?.id ?? '',
        subjectId: exam?.subjects[0]?.subjectId ?? '',
        marksObtained: '',
        remarks: '',
        isAbsent: false,
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((current) =>
      current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      entries: rows
        .filter((row) => row.studentId && row.subjectId)
        .map((row) => ({
          studentId: row.studentId,
          subjectId: row.subjectId,
          marksObtained: row.isAbsent ? undefined : Number(row.marksObtained),
          remarks: row.remarks || undefined,
          isAbsent: row.isAbsent,
        })),
    });
  };

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Marks Entry</h2>
          <p className="muted-text">
            {exam
              ? `Enter marks for ${exam.examName}.`
              : 'Select an exam to start entering marks.'}
          </p>
        </div>
        {exam ? (
          <button className="secondary-button" onClick={addRow} type="button">
            Add Row
          </button>
        ) : null}
      </div>

      {!exam ? <p className="muted-text">Choose an exam from the list first.</p> : null}

      {exam ? (
        <form className="simple-form" onSubmit={handleSubmit}>
          {rows.map((row, index) => (
            <div className="nested-form-grid" key={`${row.studentId}-${row.subjectId}-${index}`}>
              <label>
                <span>Student</span>
                <select
                  required
                  value={row.studentId}
                  onChange={(event) => handleChange(index, 'studentId', event.target.value)}
                >
                  <option value="">Select student</option>
                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.studentCode})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Subject</span>
                <select
                  required
                  value={row.subjectId}
                  onChange={(event) => handleChange(index, 'subjectId', event.target.value)}
                >
                  <option value="">Select subject</option>
                  {exam.subjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      {subject.subjectName} ({subject.subjectCode})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Marks Obtained</span>
                <input
                  disabled={row.isAbsent}
                  min={0}
                  type="number"
                  value={row.marksObtained}
                  onChange={(event) =>
                    handleChange(index, 'marksObtained', event.target.value)
                  }
                />
              </label>

              <label className="checkbox-inline">
                <input
                  checked={row.isAbsent}
                  type="checkbox"
                  onChange={(event) => handleChange(index, 'isAbsent', event.target.checked)}
                />
                <span>Absent</span>
              </label>

              <label>
                <span>Remarks</span>
                <input
                  type="text"
                  value={row.remarks}
                  onChange={(event) => handleChange(index, 'remarks', event.target.value)}
                />
              </label>

              <button
                className="danger-button"
                disabled={rows.length === 1}
                onClick={() => removeRow(index)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving Marks...' : 'Save Marks'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
