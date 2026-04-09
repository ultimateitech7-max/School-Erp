'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type {
  ExamDateSheetFormPayload,
  ExamDateSheetOptionsPayload,
} from '@/utils/api';

const initialEntry = {
  subjectId: '',
  examDate: '',
  startTime: '09:00',
  endTime: '12:00',
};

interface ExamDateSheetFormProps {
  options: ExamDateSheetOptionsPayload | null;
  submitting: boolean;
  onSubmit: (payload: ExamDateSheetFormPayload) => Promise<void>;
}

export function ExamDateSheetForm({
  options,
  submitting,
  onSubmit,
}: ExamDateSheetFormProps) {
  const [classId, setClassId] = useState('');
  const [examName, setExamName] = useState('');
  const [entries, setEntries] = useState([initialEntry]);
  const [error, setError] = useState<string | null>(null);

  const subjects = useMemo(() => {
    return options?.classes.find((item) => item.id === classId)?.subjects ?? [];
  }, [classId, options?.classes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!classId || !examName.trim()) {
      setError('Class and exam name are required.');
      return;
    }

    if (
      entries.some(
        (entry) =>
          !entry.subjectId || !entry.examDate || !entry.startTime || !entry.endTime,
      )
    ) {
      setError('Complete all exam schedule rows before saving.');
      return;
    }

    await onSubmit({
      classId,
      examName: examName.trim(),
      entries,
    });

    setClassId('');
    setExamName('');
    setEntries([initialEntry]);
  };

  return (
    <form className="card panel exam-sheet-form" onSubmit={handleSubmit}>
      <div className="panel-heading compact-heading">
        <div>
          <h3>Create Exam Date Sheet</h3>
          <p className="muted-text">
            Schedule subject-wise exam dates and time slots for a class.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <Field label="Class">
          <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">Select class</option>
            {options?.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Exam Name">
          <Input
            onChange={(event) => setExamName(event.target.value)}
            placeholder="Mid Term 2026"
            value={examName}
          />
        </Field>
      </div>

      <div className="exam-sheet-entry-list">
        {entries.map((entry, index) => (
          <div className="exam-sheet-entry-row" key={`sheet-entry-${index}`}>
            <Field label={`Subject ${index + 1}`}>
              <Select
                value={entry.subjectId}
                onChange={(event) => {
                  const nextEntries = [...entries];
                  nextEntries[index] = {
                    ...entry,
                    subjectId: event.target.value,
                  };
                  setEntries(nextEntries);
                }}
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Exam Date">
              <Input
                type="date"
                value={entry.examDate}
                onChange={(event) => {
                  const nextEntries = [...entries];
                  nextEntries[index] = {
                    ...entry,
                    examDate: event.target.value,
                  };
                  setEntries(nextEntries);
                }}
              />
            </Field>

            <Field label="Start Time">
              <Input
                type="time"
                value={entry.startTime}
                onChange={(event) => {
                  const nextEntries = [...entries];
                  nextEntries[index] = {
                    ...entry,
                    startTime: event.target.value,
                  };
                  setEntries(nextEntries);
                }}
              />
            </Field>

            <Field label="End Time">
              <Input
                type="time"
                value={entry.endTime}
                onChange={(event) => {
                  const nextEntries = [...entries];
                  nextEntries[index] = {
                    ...entry,
                    endTime: event.target.value,
                  };
                  setEntries(nextEntries);
                }}
              />
            </Field>

            <div className="exam-sheet-entry-actions">
              <Button
                disabled={entries.length === 1}
                onClick={() =>
                  setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="ui-field-error">{error}</p> : null}

      <div className="form-actions">
        <Button
          onClick={() => setEntries((current) => [...current, initialEntry])}
          type="button"
          variant="secondary"
        >
          Add Subject Slot
        </Button>
        <Button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : 'Create Date Sheet'}
        </Button>
      </div>
    </form>
  );
}
