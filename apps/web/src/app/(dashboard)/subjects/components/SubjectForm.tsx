'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  SubjectFormPayload,
  SubjectRecord,
  SubjectType,
  UserStatus,
} from '@/utils/api';

interface SubjectFormProps {
  mode: 'create' | 'edit';
  initialSubject?: SubjectRecord | null;
  submitting: boolean;
  onSubmit: (payload: SubjectFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface SubjectFormState {
  subjectName: string;
  subjectCode: string;
  subjectType: SubjectType;
  isOptional: boolean;
  status: UserStatus;
}

const initialFormState: SubjectFormState = {
  subjectName: '',
  subjectCode: '',
  subjectType: 'THEORY',
  isOptional: false,
  status: 'ACTIVE',
};

export function SubjectForm({
  mode,
  initialSubject,
  submitting,
  onSubmit,
  onCancel,
}: SubjectFormProps) {
  const [form, setForm] = useState<SubjectFormState>(initialFormState);

  useEffect(() => {
    if (!initialSubject) {
      setForm(initialFormState);
      return;
    }

    setForm({
      subjectName: initialSubject.subjectName,
      subjectCode: initialSubject.subjectCode,
      subjectType: initialSubject.subjectType,
      isOptional: initialSubject.isOptional,
      status: initialSubject.status,
    });
  }, [initialSubject]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      subjectName: form.subjectName.trim(),
      subjectCode: form.subjectCode.trim() || undefined,
      subjectType: form.subjectType,
      isOptional: form.isOptional,
      isActive: form.status === 'ACTIVE',
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Subject' : 'Add Subject'}</h2>
          <p className="muted-text">
            Manage school subjects and make them available for class mapping.
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
          <span>Subject Name</span>
          <input
            required
            type="text"
            value={form.subjectName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subjectName: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Subject Code</span>
          <input
            placeholder="Auto-generated if left empty"
            type="text"
            value={form.subjectCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subjectCode: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Subject Type</span>
          <select
            value={form.subjectType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subjectType: event.target.value as SubjectType,
              }))
            }
          >
            <option value="THEORY">Theory</option>
            <option value="PRACTICAL">Practical</option>
            <option value="BOTH">Both</option>
          </select>
        </label>

        <label className="checkbox-inline">
          <input
            checked={form.isOptional}
            type="checkbox"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isOptional: event.target.checked,
              }))
            }
          />
          <span>Optional Subject</span>
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
              ? 'Save Subject'
              : 'Create Subject'}
        </button>
      </form>
    </section>
  );
}
