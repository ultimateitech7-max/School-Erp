'use client';

import { useEffect, useState } from 'react';
import type {
  ExamFormPayload,
  ExamRecord,
  ExamsOptionsPayload,
  ExamStatus,
  ExamType,
} from '@/utils/api';

interface ExamFormProps {
  options: ExamsOptionsPayload;
  initialValue?: ExamRecord | null;
  isSubmitting: boolean;
  onSubmit: (payload: ExamFormPayload) => Promise<void>;
  onCancel: () => void;
}

interface SubjectSelectionRow {
  subjectId: string;
  maxMarks: number;
  passMarks: number;
  examDate: string;
}

const createDefaultRow = (): SubjectSelectionRow => ({
  subjectId: '',
  maxMarks: 100,
  passMarks: 35,
  examDate: '',
});

export function ExamForm({
  options,
  initialValue,
  isSubmitting,
  onSubmit,
  onCancel,
}: ExamFormProps) {
  const [examName, setExamName] = useState('');
  const [examCode, setExamCode] = useState('');
  const [classId, setClassId] = useState('');
  const [examType, setExamType] = useState<ExamType>('UNIT');
  const [status, setStatus] = useState<ExamStatus>('SCHEDULED');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [subjects, setSubjects] = useState<SubjectSelectionRow[]>([
    createDefaultRow(),
  ]);

  useEffect(() => {
    if (!initialValue) {
      setExamName('');
      setExamCode('');
      setClassId('');
      setExamType('UNIT');
      setStatus('SCHEDULED');
      setStartDate('');
      setEndDate('');
      setSubjects([createDefaultRow()]);
      return;
    }

    setExamName(initialValue.examName);
    setExamCode(initialValue.examCode);
    setClassId(initialValue.class?.id ?? '');
    setExamType(initialValue.examType);
    setStatus(initialValue.status);
    setStartDate(initialValue.startDate.slice(0, 10));
    setEndDate(initialValue.endDate.slice(0, 10));
    setSubjects(
      initialValue.subjects.length > 0
        ? initialValue.subjects.map((subject) => ({
            subjectId: subject.subjectId,
            maxMarks: subject.maxMarks,
            passMarks: subject.passMarks,
            examDate: subject.examDate?.slice(0, 10) ?? '',
          }))
        : [createDefaultRow()],
    );
  }, [initialValue]);

  const handleSubjectChange = (
    index: number,
    key: keyof SubjectSelectionRow,
    value: number | string,
  ) => {
    setSubjects((current) =>
      current.map((subject, subjectIndex) =>
        subjectIndex === index ? { ...subject, [key]: value } : subject,
      ),
    );
  };

  const handleAddSubject = () => {
    setSubjects((current) => [...current, createDefaultRow()]);
  };

  const handleRemoveSubject = (index: number) => {
    setSubjects((current) =>
      current.length === 1
        ? current
        : current.filter((_, subjectIndex) => subjectIndex !== index),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      sessionId: options.currentSessionId,
      classId: classId || undefined,
      examCode: examCode || undefined,
      examName,
      examType,
      startDate,
      endDate,
      status,
      subjects: subjects
        .filter((subject) => subject.subjectId)
        .map((subject) => ({
          subjectId: subject.subjectId,
          maxMarks: Number(subject.maxMarks),
          passMarks: Number(subject.passMarks),
          examDate: subject.examDate || undefined,
        })),
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{initialValue ? 'Edit Exam' : 'Create Exam'}</h2>
          <p className="muted-text">
            Schedule exams and configure subject-wise mark settings.
          </p>
        </div>
        {initialValue ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Exam Name</span>
          <input
            required
            type="text"
            value={examName}
            onChange={(event) => setExamName(event.target.value)}
          />
        </label>

        <label>
          <span>Exam Code</span>
          <input
            type="text"
            value={examCode}
            onChange={(event) => setExamCode(event.target.value)}
          />
        </label>

        <label>
          <span>Class</span>
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">School-wide</option>
            {options.classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name} ({academicClass.classCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Exam Type</span>
          <select
            value={examType}
            onChange={(event) => setExamType(event.target.value as ExamType)}
          >
            {options.examTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ExamStatus)}
          >
            {options.examStatuses.map((itemStatus) => (
              <option key={itemStatus} value={itemStatus}>
                {itemStatus}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Start Date</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>

        <label>
          <span>End Date</span>
          <input
            required
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>

        <div className="subform-stack">
          <div className="subform-header">
            <h3>Subjects</h3>
            <button className="secondary-button" onClick={handleAddSubject} type="button">
              Add Subject
            </button>
          </div>

          {subjects.map((subject, index) => (
            <div className="nested-form-grid" key={`${subject.subjectId}-${index}`}>
              <label>
                <span>Subject</span>
                <select
                  required
                  value={subject.subjectId}
                  onChange={(event) =>
                    handleSubjectChange(index, 'subjectId', event.target.value)
                  }
                >
                  <option value="">Select subject</option>
                  {options.subjects.map((subjectOption) => (
                    <option key={subjectOption.id} value={subjectOption.id}>
                      {subjectOption.name} ({subjectOption.subjectCode})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Max Marks</span>
                <input
                  min={1}
                  required
                  type="number"
                  value={subject.maxMarks}
                  onChange={(event) =>
                    handleSubjectChange(index, 'maxMarks', Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Pass Marks</span>
                <input
                  min={0}
                  required
                  type="number"
                  value={subject.passMarks}
                  onChange={(event) =>
                    handleSubjectChange(index, 'passMarks', Number(event.target.value))
                  }
                />
              </label>

              <label>
                <span>Exam Date</span>
                <input
                  type="date"
                  value={subject.examDate}
                  onChange={(event) =>
                    handleSubjectChange(index, 'examDate', event.target.value)
                  }
                />
              </label>

              <button
                className="danger-button"
                disabled={subjects.length === 1}
                onClick={() => handleRemoveSubject(index)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? initialValue
              ? 'Updating...'
              : 'Creating...'
            : initialValue
              ? 'Update Exam'
              : 'Create Exam'}
        </button>
      </form>
    </section>
  );
}
