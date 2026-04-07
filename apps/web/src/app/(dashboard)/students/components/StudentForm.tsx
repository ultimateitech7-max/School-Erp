'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  StudentClassOption,
  StudentFormPayload,
  StudentRecord,
} from '@/utils/api';

interface StudentFormProps {
  mode: 'create' | 'edit';
  classes: StudentClassOption[];
  currentSessionId: string | null;
  currentSessionName: string | null;
  initialStudent?: StudentRecord | null;
  submitting: boolean;
  onSubmit: (payload: StudentFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface StudentFormState {
  name: string;
  admissionNo: string;
  email: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  classId: string;
  sectionId: string;
}

const initialFormState: StudentFormState = {
  name: '',
  admissionNo: '',
  email: '',
  phone: '',
  gender: 'OTHER',
  dateOfBirth: '',
  classId: '',
  sectionId: '',
};

function formatDate(value?: string | Date | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export function StudentForm({
  mode,
  classes,
  currentSessionId,
  currentSessionName,
  initialStudent,
  submitting,
  onSubmit,
  onCancel,
}: StudentFormProps) {
  const [form, setForm] = useState<StudentFormState>(initialFormState);

  useEffect(() => {
    if (!initialStudent) {
      setForm(initialFormState);
      return;
    }

    setForm({
      name: initialStudent.name,
      admissionNo: initialStudent.admissionNo ?? '',
      email: initialStudent.email ?? '',
      phone: initialStudent.phone ?? '',
      gender:
        initialStudent.gender === 'MALE' ||
        initialStudent.gender === 'FEMALE' ||
        initialStudent.gender === 'OTHER'
          ? initialStudent.gender
          : 'OTHER',
      dateOfBirth: formatDate(initialStudent.dateOfBirth),
      classId: initialStudent.class?.id ?? '',
      sectionId: initialStudent.section?.id ?? '',
    });
  }, [initialStudent]);

  const selectedClass =
    classes.find((academicClass) => academicClass.id === form.classId) ?? null;
  const sectionOptions = selectedClass?.sections ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      name: form.name.trim(),
      admissionNo: form.classId ? form.admissionNo.trim() || undefined : undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      gender: form.gender,
      dateOfBirth: form.dateOfBirth || undefined,
      classId: form.classId || undefined,
      sectionId: form.sectionId || undefined,
      sessionId: form.classId ? currentSessionId ?? undefined : undefined,
    });
  };

  return (
    <section className="card panel student-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Student' : 'Add Student'}</h2>
          <p className="muted-text">
            {currentSessionName
              ? `Current session: ${currentSessionName}`
              : 'You can create a student without assigning a class.'}
          </p>
        </div>

        {mode === 'edit' && onCancel ? (
          <button
            className="secondary-button"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            required
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Phone</span>
          <input
            type="text"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Gender</span>
          <select
            value={form.gender}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                gender: event.target.value as StudentFormState['gender'],
              }))
            }
          >
            <option value="OTHER">Other</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </label>

        <label>
          <span>Date of Birth</span>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dateOfBirth: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Class</span>
          <select
            value={form.classId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                classId: event.target.value,
                sectionId: '',
                admissionNo: event.target.value ? current.admissionNo : '',
              }))
            }
          >
            <option value="">No class assigned</option>
            {classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Section</span>
          <select
            disabled={!form.classId}
            value={form.sectionId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                sectionId: event.target.value,
              }))
            }
          >
            <option value="">No section assigned</option>
            {sectionOptions.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Admission No</span>
          <input
            disabled={!form.classId}
            placeholder={form.classId ? 'Optional' : 'Select class first'}
            type="text"
            value={form.admissionNo}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                admissionNo: event.target.value,
              }))
            }
          />
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save Changes'
              : 'Create Student'}
        </button>
      </form>
    </section>
  );
}
