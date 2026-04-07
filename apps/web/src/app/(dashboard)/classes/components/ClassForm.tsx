'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { AcademicClassFormPayload, AcademicClassRecord, UserStatus } from '@/utils/api';

interface ClassFormProps {
  mode: 'create' | 'edit';
  initialClass?: AcademicClassRecord | null;
  submitting: boolean;
  onSubmit: (payload: AcademicClassFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface ClassFormState {
  className: string;
  classCode: string;
  gradeLevel: string;
  sortOrder: string;
  status: UserStatus;
}

const initialFormState: ClassFormState = {
  className: '',
  classCode: '',
  gradeLevel: '',
  sortOrder: '0',
  status: 'ACTIVE',
};

export function ClassForm({
  mode,
  initialClass,
  submitting,
  onSubmit,
  onCancel,
}: ClassFormProps) {
  const [form, setForm] = useState<ClassFormState>(initialFormState);

  useEffect(() => {
    if (!initialClass) {
      setForm(initialFormState);
      return;
    }

    setForm({
      className: initialClass.className,
      classCode: initialClass.classCode,
      gradeLevel:
        initialClass.gradeLevel !== null ? String(initialClass.gradeLevel) : '',
      sortOrder: String(initialClass.sortOrder),
      status: initialClass.status,
    });
  }, [initialClass]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      className: form.className.trim(),
      classCode: form.classCode.trim() || undefined,
      gradeLevel: form.gradeLevel ? Number(form.gradeLevel) : undefined,
      sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
      isActive: form.status === 'ACTIVE',
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Class' : 'Add Class'}</h2>
          <p className="muted-text">
            Manage school classes with sortable academic ordering.
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
          <span>Class Name</span>
          <input
            required
            type="text"
            value={form.className}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                className: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Class Code</span>
          <input
            placeholder="Auto-generated if left empty"
            type="text"
            value={form.classCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                classCode: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Grade Level</span>
          <input
            min="0"
            type="number"
            value={form.gradeLevel}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                gradeLevel: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Sort Order</span>
          <input
            min="0"
            type="number"
            value={form.sortOrder}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sortOrder: event.target.value,
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
                status: event.target.value as UserStatus,
              }))
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save Class'
              : 'Create Class'}
        </button>
      </form>
    </section>
  );
}
