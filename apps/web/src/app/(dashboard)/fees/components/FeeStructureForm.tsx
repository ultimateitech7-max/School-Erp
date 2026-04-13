'use client';

import { FormEvent, useEffect, useState } from 'react';
import type {
  FeeCategory,
  FeeClassOption,
  FeeFrequency,
  FeeStructureFormPayload,
  FeeStructureRecord,
  FeesOptionsPayload,
} from '@/utils/api';

interface FeeStructureFormProps {
  options: FeesOptionsPayload;
  submitting: boolean;
  onSubmit: (payload: FeeStructureFormPayload) => Promise<void>;
  initialValue?: FeeStructureRecord | null;
  onCancel?: () => void;
}

interface FeeStructureFormState {
  name: string;
  feeCode: string;
  classId: string;
  category: FeeCategory;
  frequency: FeeFrequency;
  amount: string;
  dueDate: string;
  lateFeePerDay: string;
  isOptional: boolean;
}

const initialFormState: FeeStructureFormState = {
  name: '',
  feeCode: '',
  classId: '',
  category: 'TUITION',
  frequency: 'MONTHLY',
  amount: '',
  dueDate: '',
  lateFeePerDay: '0',
  isOptional: false,
};

export function FeeStructureForm({
  options,
  submitting,
  onSubmit,
  initialValue,
  onCancel,
}: FeeStructureFormProps) {
  const [form, setForm] = useState<FeeStructureFormState>(initialFormState);

  useEffect(() => {
    if (initialValue) {
      setForm({
        name: initialValue.name,
        feeCode: initialValue.feeCode,
        classId: initialValue.classId ?? '',
        category: initialValue.category,
        frequency: initialValue.frequency,
        amount: String(initialValue.amount),
        dueDate: initialValue.dueDate?.slice(0, 10) ?? '',
        lateFeePerDay: String(initialValue.lateFeePerDay),
        isOptional: initialValue.isOptional,
      });
      return;
    }

    setForm((current) => ({
      ...current,
      classId: current.classId || options.classes[0]?.id || '',
    }));
  }, [initialValue, options.classes]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      sessionId: options.currentSessionId,
      classId: form.classId || undefined,
      feeCode: form.feeCode.trim() || undefined,
      name: form.name.trim(),
      category: form.category,
      frequency: form.frequency,
      amount: Number(form.amount),
      dueDate: form.dueDate || undefined,
      lateFeePerDay: Number(form.lateFeePerDay || 0),
      isOptional: form.isOptional,
    });

    if (!initialValue) {
      setForm({
        ...initialFormState,
        classId: options.classes[0]?.id || '',
      });
    }
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{initialValue ? 'Edit Fee Structure' : 'Create Fee Structure'}</h2>
          <p className="muted-text">Define fee templates for classes and sessions.</p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Fee Name</span>
          <input
            required
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>

        <label>
          <span>Fee Code</span>
          <input
            placeholder="Auto-generated if empty"
            type="text"
            value={form.feeCode}
            onChange={(event) =>
              setForm((current) => ({ ...current, feeCode: event.target.value }))
            }
          />
        </label>

        <label>
          <span>Class</span>
          <select
            value={form.classId}
            onChange={(event) =>
              setForm((current) => ({ ...current, classId: event.target.value }))
            }
          >
            <option value="">All classes</option>
            {options.classes.map((academicClass: FeeClassOption) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name} ({academicClass.classCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Category</span>
          <select
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value as FeeCategory,
              }))
            }
          >
            {options.feeCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Frequency</span>
          <select
            value={form.frequency}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                frequency: event.target.value as FeeFrequency,
              }))
            }
          >
            {options.feeFrequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Amount</span>
          <input
            min="0"
            required
            step="0.01"
            type="number"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({ ...current, amount: event.target.value }))
            }
          />
        </label>

        <label>
          <span>Due Date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
          />
        </label>

        <label>
          <span>Late Fee Per Day</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.lateFeePerDay}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                lateFeePerDay: event.target.value,
              }))
            }
          />
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
          <span>Optional fee</span>
        </label>

        <div className="form-actions">
          {initialValue && onCancel ? (
            <button className="secondary-button" onClick={onCancel} type="button">
              Cancel
            </button>
          ) : null}
          <button className="primary-button" disabled={submitting} type="submit">
            {submitting
              ? initialValue
                ? 'Updating...'
                : 'Creating...'
              : initialValue
                ? 'Update Structure'
                : 'Create Structure'}
          </button>
        </div>
      </form>
    </section>
  );
}
