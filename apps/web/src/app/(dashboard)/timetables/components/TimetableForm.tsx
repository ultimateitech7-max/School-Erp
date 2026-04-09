'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type {
  TimetableDayOfWeek,
  TimetableFormPayload,
  TimetableOptionsPayload,
  TimetableEntryRecord,
} from '@/utils/api';

const initialForm: TimetableFormPayload = {
  classId: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  dayOfWeek: 'MONDAY',
  periodNumber: 1,
  startTime: '08:00',
  endTime: '08:45',
};

interface TimetableFormProps {
  options: TimetableOptionsPayload | null;
  submitting: boolean;
  onSubmit: (payload: TimetableFormPayload) => Promise<void>;
  initialEntry?: TimetableEntryRecord | null;
  submitLabel?: string;
  onCancel?: () => void;
}

export function TimetableForm({
  options,
  submitting,
  onSubmit,
  initialEntry = null,
  submitLabel,
  onCancel,
}: TimetableFormProps) {
  const [form, setForm] = useState<TimetableFormPayload>(initialForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialEntry) {
      setForm(initialForm);
      setError(null);
      return;
    }

    setForm({
      classId: initialEntry.class.id,
      sectionId: initialEntry.section?.id ?? '',
      subjectId: initialEntry.subject.id,
      teacherId: initialEntry.teacher.id,
      dayOfWeek: initialEntry.dayOfWeek,
      periodNumber: initialEntry.periodNumber,
      startTime: initialEntry.startTime,
      endTime: initialEntry.endTime,
    });
    setError(null);
  }, [initialEntry]);

  const sections = useMemo(() => {
    const matchedClass = options?.classes.find((item) => item.id === form.classId);
    return matchedClass?.sections ?? [];
  }, [form.classId, options?.classes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.classId || !form.subjectId || !form.teacherId) {
      setError('Class, subject, and teacher are required.');
      return;
    }

    await onSubmit({
      ...form,
      sectionId: form.sectionId || undefined,
    });

    if (!initialEntry) {
      setForm({
        ...initialForm,
        dayOfWeek: form.dayOfWeek,
      });
    }
  };

  return (
    <form className="card panel timetable-form" onSubmit={handleSubmit}>
      <div className="panel-heading compact-heading">
        <div>
          <h3>{initialEntry ? 'Edit Timetable Entry' : 'Create Timetable Entry'}</h3>
          <p className="muted-text">
            {initialEntry
              ? 'Update the assigned subject, teacher, or time slot safely.'
              : 'Assign a subject, teacher, and period into the weekly grid.'}
          </p>
        </div>
      </div>

      <div className="form-grid">
        <Field label="Class" error={error && !form.classId ? error : undefined}>
          <Select
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
            {options?.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Section">
          <Select
            value={form.sectionId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sectionId: event.target.value,
              }))
            }
          >
            <option value="">Class-wide</option>
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subject">
          <Select
            value={form.subjectId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subjectId: event.target.value,
              }))
            }
          >
            <option value="">Select subject</option>
            {options?.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Teacher">
          <Select
            value={form.teacherId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                teacherId: event.target.value,
              }))
            }
          >
            <option value="">Select teacher</option>
            {options?.teachers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Day">
          <Select
            value={form.dayOfWeek}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dayOfWeek: event.target.value as TimetableDayOfWeek,
              }))
            }
          >
            {options?.days.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Period Number">
          <Input
            min={1}
            type="number"
            value={form.periodNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                periodNumber: Number(event.target.value),
              }))
            }
          />
        </Field>

        <Field label="Start Time">
          <Input
            type="time"
            value={form.startTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
          />
        </Field>

        <Field label="End Time">
          <Input
            type="time"
            value={form.endTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
          />
        </Field>
      </div>

      {error ? <p className="ui-field-error">{error}</p> : null}

      <div className="form-actions">
        {initialEntry && onCancel ? (
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
        <Button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : submitLabel ?? (initialEntry ? 'Save Changes' : 'Add Entry')}
        </Button>
      </div>
    </form>
  );
}
