'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  ExamMarkRecord,
  ExamRecord,
  ExamsOptionsPayload,
  MarksEntryPayload,
} from '@/utils/api';

interface MarksEntryFormProps {
  exam: ExamRecord | null;
  existingMarks: ExamMarkRecord[];
  isSubmitting: boolean;
  onSubmit: (payload: MarksEntryPayload) => Promise<void>;
  options: ExamsOptionsPayload;
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
  existingMarks,
  isSubmitting,
  onSubmit,
  options,
}: MarksEntryFormProps) {
  const [rows, setRows] = useState<MarkRowState[]>([createDefaultRow()]);
  const [editingMarkId, setEditingMarkId] = useState<string | null>(null);

  const availableStudents = useMemo(() => {
    if (!exam?.class?.id) {
      return options.students;
    }

    return options.students.filter((student) => student.classId === exam.class?.id);
  }, [exam, options.students]);

  useEffect(() => {
    setEditingMarkId(null);

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
    setEditingMarkId(null);
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

  const handleEditMark = (mark: ExamMarkRecord) => {
    setEditingMarkId(mark.id);
    setRows([
      {
        studentId: mark.student.id,
        subjectId: mark.subject.id,
        marksObtained: mark.marksObtained?.toString() ?? '',
        remarks: mark.remarks ?? '',
        isAbsent: mark.isAbsent,
      },
    ]);
  };

  const resetEditor = () => {
    setEditingMarkId(null);
    setRows([
      {
        studentId: availableStudents[0]?.id ?? '',
        subjectId: exam?.subjects[0]?.subjectId ?? '',
        marksObtained: '',
        remarks: '',
        isAbsent: false,
      },
    ]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await onSubmit({
        entries: rows
          .filter((row) => row.studentId && row.subjectId)
          .map((row) => ({
            studentId: row.studentId,
            subjectId: row.subjectId,
            marksObtained:
              row.isAbsent || !row.marksObtained ? undefined : Number(row.marksObtained),
            remarks: row.remarks || undefined,
            isAbsent: row.isAbsent,
          })),
      });

      resetEditor();
    } catch {
      // Parent page already surfaces the error banner.
    }
  };

  return (
    <section className="card panel compact-panel-stack">
      <div className="panel-heading compact-panel-heading">
        <div>
          <h2>Marks Entry</h2>
          <p className="muted-text">
            {exam
              ? editingMarkId
                ? `Edit marks for ${exam.examName}.`
                : `Enter or update marks for ${exam.examName}.`
              : 'Select an exam to start entering marks.'}
          </p>
        </div>
        {exam ? (
          <div className="chip-list">
            <button className="secondary-button" onClick={addRow} type="button">
              Add Row
            </button>
            {editingMarkId ? (
              <button className="secondary-button" onClick={resetEditor} type="button">
                Cancel Edit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!exam ? <p className="muted-text">Choose an exam from the list first.</p> : null}

      {exam ? (
        <>
          <form className="simple-form" onSubmit={handleSubmit}>
            {rows.map((row, index) => (
              <div className="nested-form-grid" key={`${row.studentId}-${row.subjectId}-${index}`}>
                <label>
                  <span>Student</span>
                  <select
                    disabled={Boolean(editingMarkId)}
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
                    disabled={Boolean(editingMarkId)}
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
                    onChange={(event) => setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index
                          ? { ...item, remarks: event.target.value }
                          : item,
                      ),
                    )}
                  />
                </label>

                <button
                  className="danger-button"
                  disabled={rows.length === 1 || Boolean(editingMarkId)}
                  onClick={() => removeRow(index)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}

            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Saving Marks...'
                : editingMarkId
                  ? 'Update Marks'
                  : 'Save Marks'}
            </button>
          </form>

          <div className="timeline-list">
            {existingMarks.length ? (
              existingMarks.map((mark) => (
                <article className="subtle-card" key={mark.id}>
                  <div className="portal-detail-row">
                    <strong>
                      {mark.student.name} · {mark.subject.name}
                    </strong>
                    <span>
                      {mark.isAbsent
                        ? 'Absent'
                        : `${mark.marksObtained ?? 0} / ${mark.maxMarks}`}
                    </span>
                  </div>
                  <p className="muted-text">
                    {mark.student.studentCode}
                    {mark.grade ? ` • Grade ${mark.grade}` : ''}
                    {mark.remarks ? ` • ${mark.remarks}` : ''}
                  </p>
                  <div className="form-actions form-actions-split">
                    <span className="muted-text">
                      Updated {new Date(mark.updatedAt).toLocaleString('en-IN')}
                    </span>
                    <button
                      className="secondary-button"
                      onClick={() => handleEditMark(mark)}
                      type="button"
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted-text">Saved marks will appear here for quick edits.</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
