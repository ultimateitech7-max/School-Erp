'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type {
  ExamDateSheetRecord,
  ExamDateSheetFormPayload,
  ExamDateSheetOptionsPayload,
} from '@/utils/api';

function createInitialEntry() {
  return {
    subjectId: '',
    examDate: '',
    startTime: '09:00',
    endTime: '12:00',
  };
}

function createInitialState() {
  return {
    classId: '',
    examName: '',
    entries: [createInitialEntry()],
  };
}

interface ExamDateSheetFormProps {
  options: ExamDateSheetOptionsPayload | null;
  submitting: boolean;
  initialValue?: ExamDateSheetRecord | null;
  onCancel?: () => void;
  onSubmit: (payload: ExamDateSheetFormPayload) => Promise<void>;
}

export function ExamDateSheetForm({
  options,
  submitting,
  initialValue,
  onCancel,
  onSubmit,
}: ExamDateSheetFormProps) {
  const [form, setForm] = useState(createInitialState);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(initialValue);

  useEffect(() => {
    if (!initialValue) {
      setForm(createInitialState());
      setError(null);
      return;
    }

    setForm({
      classId: initialValue.class.id,
      examName: initialValue.examName,
      entries: initialValue.entries.map((entry) => ({
        subjectId: entry.subject.id,
        examDate: entry.examDate.slice(0, 10),
        startTime: entry.startTime,
        endTime: entry.endTime,
      })),
    });
    setError(null);
  }, [initialValue]);

  const subjects = useMemo(() => {
    return options?.classes.find((item) => item.id === form.classId)?.subjects ?? [];
  }, [form.classId, options?.classes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.classId || !form.examName.trim()) {
      setError('Class and exam name are required.');
      return;
    }

    if (
      form.entries.some(
        (entry) =>
          !entry.subjectId || !entry.examDate || !entry.startTime || !entry.endTime,
      )
    ) {
      setError('Complete all exam schedule rows before saving.');
      return;
    }

    await onSubmit({
      classId: form.classId,
      examName: form.examName.trim(),
      entries: form.entries,
    });

    if (!isEditing) {
      setForm(createInitialState());
    }
  };

  return (
    <form className="card panel exam-sheet-form compact-panel-stack" onSubmit={handleSubmit}>
      <div className="panel-heading compact-heading">
        <div>
          <h3>{isEditing ? 'Edit Exam Date Sheet' : 'Create Exam Date Sheet'}</h3>
          <p className="muted-text">
            {isEditing
              ? 'Update class schedule slots, subjects, and timings.'
              : 'Schedule subject-wise exam dates and time slots for a class.'}
          </p>
        </div>
      </div>

      <div className="form-grid compact-form-grid">
        <Field label="Class">
          <Select
            value={form.classId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                classId: event.target.value,
                entries: current.entries.map((entry) => ({
                  ...entry,
                  subjectId: '',
                })),
              }))
            }
          >
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
            onChange={(event) =>
              setForm((current) => ({ ...current, examName: event.target.value }))
            }
            placeholder="Mid Term 2026"
            value={form.examName}
          />
        </Field>
      </div>

      <div className="exam-sheet-entry-list">
        {form.entries.map((entry, index) => (
          <div className="exam-sheet-entry-row" key={`sheet-entry-${index}`}>
            <Field label={`Subject ${index + 1}`}>
              <Select
                value={entry.subjectId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    entries: current.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, subjectId: event.target.value }
                        : item,
                    ),
                  }));
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
                  setForm((current) => ({
                    ...current,
                    entries: current.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, examDate: event.target.value }
                        : item,
                    ),
                  }));
                }}
              />
            </Field>

            <Field label="Start Time">
              <Input
                type="time"
                value={entry.startTime}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    entries: current.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, startTime: event.target.value }
                        : item,
                    ),
                  }));
                }}
              />
            </Field>

            <Field label="End Time">
              <Input
                type="time"
                value={entry.endTime}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    entries: current.entries.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, endTime: event.target.value }
                        : item,
                    ),
                  }));
                }}
              />
            </Field>

            <div className="exam-sheet-entry-actions">
              <Button
                disabled={form.entries.length === 1}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    entries: current.entries.filter((_, itemIndex) => itemIndex !== index),
                  }))
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
          onClick={() =>
            setForm((current) => ({
              ...current,
              entries: [...current.entries, createInitialEntry()],
            }))
          }
          size="sm"
          type="button"
          variant="secondary"
        >
          Add Subject Slot
        </Button>
        {isEditing && onCancel ? (
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            Cancel Edit
          </Button>
        ) : null}
        <Button disabled={submitting} size="sm" type="submit">
          {submitting ? 'Saving...' : isEditing ? 'Update Date Sheet' : 'Create Date Sheet'}
        </Button>
      </div>
    </form>
  );
}
