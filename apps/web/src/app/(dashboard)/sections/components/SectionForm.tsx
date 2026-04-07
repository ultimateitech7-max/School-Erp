'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  AcademicClassRecord,
  SectionFormPayload,
  SectionRecord,
  UserStatus,
} from '@/utils/api';

interface SectionFormProps {
  mode: 'create' | 'edit';
  classes: AcademicClassRecord[];
  initialSection?: SectionRecord | null;
  submitting: boolean;
  onSubmit: (payload: SectionFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface SectionFormState {
  classId: string;
  sectionName: string;
  roomNo: string;
  capacity: string;
  status: UserStatus;
}

const initialFormState: SectionFormState = {
  classId: '',
  sectionName: '',
  roomNo: '',
  capacity: '',
  status: 'ACTIVE',
};

export function SectionForm({
  mode,
  classes,
  initialSection,
  submitting,
  onSubmit,
  onCancel,
}: SectionFormProps) {
  const [form, setForm] = useState<SectionFormState>(initialFormState);

  useEffect(() => {
    if (!initialSection) {
      setForm({
        ...initialFormState,
        classId: classes[0]?.id ?? '',
      });
      return;
    }

    setForm({
      classId: initialSection.class.id,
      sectionName: initialSection.sectionName,
      roomNo: initialSection.roomNo ?? '',
      capacity:
        initialSection.capacity !== null ? String(initialSection.capacity) : '',
      status: initialSection.status,
    });
  }, [classes, initialSection]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      classId: form.classId,
      sectionName: form.sectionName.trim(),
      roomNo: form.roomNo.trim() || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      isActive: form.status === 'ACTIVE',
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Section' : 'Add Section'}</h2>
          <p className="muted-text">
            Create sections under the correct class for each school.
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
          <span>Class</span>
          <select
            required
            value={form.classId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                classId: event.target.value,
              }))
            }
          >
            <option value="">Select class</option>
            {classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.className}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Section Name</span>
          <input
            required
            type="text"
            value={form.sectionName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sectionName: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Room No</span>
          <input
            type="text"
            value={form.roomNo}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                roomNo: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Capacity</span>
          <input
            min="0"
            type="number"
            value={form.capacity}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                capacity: event.target.value,
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
              ? 'Save Section'
              : 'Create Section'}
        </button>
      </form>
    </section>
  );
}
