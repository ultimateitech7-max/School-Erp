'use client';

import { type FormEvent, useState } from 'react';
import { Field, Input, Textarea } from '@/components/ui/field';
import type { AdmissionFormPayload } from '@/utils/api';

interface AdmissionFormProps {
  submitting: boolean;
  disabled?: boolean;
  onSubmit: (payload: AdmissionFormPayload) => Promise<void>;
}

interface AdmissionFormState {
  studentName: string;
  fatherName: string;
  motherName: string;
  phone: string;
  email: string;
  address: string;
  classApplied: string;
  previousSchool: string;
  dob: string;
  remarks: string;
}

const initialState: AdmissionFormState = {
  studentName: '',
  fatherName: '',
  motherName: '',
  phone: '',
  email: '',
  address: '',
  classApplied: '',
  previousSchool: '',
  dob: '',
  remarks: '',
};

export function AdmissionForm({
  submitting,
  disabled = false,
  onSubmit,
}: AdmissionFormProps) {
  const [form, setForm] = useState<AdmissionFormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.studentName.trim()) {
      setError('Student name is required.');
      return;
    }

    if (!form.fatherName.trim() || !form.motherName.trim()) {
      setError('Parent details are required.');
      return;
    }

    if (!form.phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    if (!form.classApplied.trim()) {
      setError('Class applied is required.');
      return;
    }

    if (!form.address.trim()) {
      setError('Address is required.');
      return;
    }

    if (!form.dob) {
      setError('Date of birth is required.');
      return;
    }

    await onSubmit({
      studentName: form.studentName.trim(),
      fatherName: form.fatherName.trim(),
      motherName: form.motherName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim(),
      classApplied: form.classApplied.trim(),
      previousSchool: form.previousSchool.trim() || undefined,
      dob: form.dob,
      remarks: form.remarks.trim() || undefined,
    });

    setForm(initialState);
  };

  return (
    <section className="card panel student-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Create Admission</h2>
          <p className="muted-text">
            Capture the inquiry with complete family and class preference details.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        {error ? <p className="error-text">{error}</p> : null}

        <div className="form-grid">
          <Field label="Student Name">
            <Input
              disabled={disabled || submitting}
              placeholder="Aarav Sharma"
              value={form.studentName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  studentName: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Class Applied">
            <Input
              disabled={disabled || submitting}
              placeholder="Class 8"
              value={form.classApplied}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  classApplied: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Father Name">
            <Input
              disabled={disabled || submitting}
              placeholder="Rakesh Sharma"
              value={form.fatherName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fatherName: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Mother Name">
            <Input
              disabled={disabled || submitting}
              placeholder="Pooja Sharma"
              value={form.motherName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  motherName: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Phone">
            <Input
              disabled={disabled || submitting}
              placeholder="+91-9999999999"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Email" hint="Optional">
            <Input
              disabled={disabled || submitting}
              placeholder="family@example.com"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Date of Birth">
            <Input
              disabled={disabled || submitting}
              type="date"
              value={form.dob}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dob: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Previous School" hint="Optional">
            <Input
              disabled={disabled || submitting}
              placeholder="Previous school name"
              value={form.previousSchool}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  previousSchool: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        <Field className="form-grid-span-full" label="Address">
          <Textarea
            disabled={disabled || submitting}
            placeholder="Residential address"
            rows={3}
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
          />
        </Field>

        <Field className="form-grid-span-full" hint="Optional" label="Remarks">
          <Textarea
            disabled={disabled || submitting}
            placeholder="Any context for review team"
            rows={3}
            value={form.remarks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                remarks: event.target.value,
              }))
            }
          />
        </Field>

        <button
          className="primary-button"
          disabled={disabled || submitting}
          type="submit"
        >
          {submitting ? 'Saving...' : 'Create Admission'}
        </button>
      </form>
    </section>
  );
}
