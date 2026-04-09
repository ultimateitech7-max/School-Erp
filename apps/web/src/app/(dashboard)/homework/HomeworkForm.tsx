'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type { HomeworkFormPayload, HomeworkOptionsPayload } from '@/utils/api';

interface HomeworkFormProps {
  options: HomeworkOptionsPayload | null;
  submitting: boolean;
  onSubmit: (payload: HomeworkFormPayload) => Promise<void>;
}

export function HomeworkForm({
  options,
  submitting,
  onSubmit,
}: HomeworkFormProps) {
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(
    () => options?.classes.find((item) => item.id === classId)?.sections ?? [],
    [classId, options],
  );

  useEffect(() => {
    if (sectionId && !sections.some((section) => section.id === sectionId)) {
      setSectionId('');
    }
  }, [sectionId, sections]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!classId || !subjectId || !teacherId || !title.trim() || !description.trim() || !dueDate) {
      setError('Class, subject, teacher, title, description, and due date are required.');
      return;
    }

    await onSubmit({
      classId,
      sectionId: sectionId || undefined,
      subjectId,
      teacherId,
      title: title.trim(),
      description: description.trim(),
      dueDate,
    });

    setTitle('');
    setDescription('');
    setDueDate('');
  };

  return (
    <form className="card panel" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <h2>Create Homework</h2>
          <p className="muted-text">
            Assign work by class, section, subject, and teacher with a clear due date.
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

        <Field label="Section">
          <Select
            disabled={!classId}
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
          >
            <option value="">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subject">
          <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Select subject</option>
            {options?.subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Teacher">
          <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Select teacher</option>
            {options?.teachers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.employeeCode})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Chapter worksheet"
          />
        </Field>

        <Field label="Due Date">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>

        <Field className="form-grid-span-full" label="Description">
          <textarea
            className="ui-input ui-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add the homework brief, instructions, or submission notes..."
          />
        </Field>
      </div>

      {error ? <p className="ui-field-error">{error}</p> : null}

      <div className="form-actions">
        <span />
        <Button disabled={submitting || !options} type="submit">
          {submitting ? 'Assigning...' : 'Assign Homework'}
        </Button>
      </div>
    </form>
  );
}
