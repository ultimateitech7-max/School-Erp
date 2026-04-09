'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type {
  AcademicSessionFormPayload,
  AcademicSessionRecord,
} from '@/utils/api';

interface AcademicSessionFormProps {
  mode: 'create' | 'edit';
  initialValue?: AcademicSessionRecord | null;
  submitting: boolean;
  canCreate: boolean;
  onSubmit: (payload: AcademicSessionFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface AcademicSessionFormState {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
}

const initialFormState: AcademicSessionFormState = {
  name: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  status: 'ACTIVE',
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

export function AcademicSessionForm({
  mode,
  initialValue,
  submitting,
  canCreate,
  onSubmit,
  onCancel,
}: AcademicSessionFormProps) {
  const [form, setForm] = useState<AcademicSessionFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValue) {
      setForm(initialFormState);
      setFormError(null);
      return;
    }

    setForm({
      name: initialValue.name,
      startDate: formatDate(initialValue.startDate),
      endDate: formatDate(initialValue.endDate),
      isCurrent: initialValue.isCurrent,
      status: initialValue.status,
    });
    setFormError(null);
  }, [initialValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!canCreate) {
      return;
    }

    if (!form.name.trim()) {
      setFormError('Session name is required.');
      return;
    }

    if (!form.startDate || !form.endDate) {
      setFormError('Start date and end date are required.');
      return;
    }

    if (new Date(form.startDate).getTime() > new Date(form.endDate).getTime()) {
      setFormError('Start date must be on or before end date.');
      return;
    }

    await onSubmit({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      ...(mode === 'create'
        ? {
            isCurrent: form.isCurrent,
            isActive: form.status === 'ACTIVE',
          }
        : {
            status: form.status,
          }),
    });

    if (mode === 'create') {
      setForm(initialFormState);
    }
  };

  return (
    <section className="card panel student-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit Academic Session' : 'Create Academic Session'}</h2>
          <p className="muted-text">
            {mode === 'edit'
              ? 'Update dates and lifecycle status without breaking school isolation.'
              : 'Define session timelines and optionally mark the current session for the school.'}
          </p>
        </div>

        {mode === 'edit' && onCancel ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        {formError ? <p className="error-text">{formError}</p> : null}

        <label>
          <span>Session Name</span>
          <input
            disabled={!canCreate || submitting}
            placeholder="2026-2027"
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
          <span>Start Date</span>
          <input
            disabled={!canCreate || submitting}
            required
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>End Date</span>
          <input
            disabled={!canCreate || submitting}
            required
            type="date"
            value={form.endDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endDate: event.target.value,
              }))
            }
          />
        </label>

        <label className="checkbox-inline">
          <input
            checked={form.isCurrent}
            disabled={!canCreate || submitting || mode === 'edit'}
            type="checkbox"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isCurrent: event.target.checked,
              }))
            }
          />
          <span>Mark as current session on create</span>
        </label>

        <label>
          <span>Status</span>
          <select
            disabled={!canCreate || submitting}
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as AcademicSessionFormState['status'],
              }))
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            {mode === 'edit' ? <option value="COMPLETED">Completed</option> : null}
          </select>
        </label>

        <button
          className="primary-button"
          disabled={!canCreate || submitting}
          type="submit"
        >
          {submitting
            ? 'Saving...'
            : mode === 'edit'
              ? 'Update Session'
              : 'Create Session'}
        </button>
      </form>
    </section>
  );
}
