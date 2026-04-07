'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AssignFeePayload,
  FeeStructureRecord,
  FeesOptionsPayload,
  FeeStudentOption,
} from '@/utils/api';

interface AssignFeeFormProps {
  options: FeesOptionsPayload;
  feeStructures: FeeStructureRecord[];
  submitting: boolean;
  onSubmit: (payload: AssignFeePayload) => Promise<void>;
}

interface AssignFeeFormState {
  studentId: string;
  feeStructureId: string;
  totalAmount: string;
  concessionAmount: string;
  dueDate: string;
}

const initialFormState: AssignFeeFormState = {
  studentId: '',
  feeStructureId: '',
  totalAmount: '',
  concessionAmount: '0',
  dueDate: '',
};

export function AssignFeeForm({
  options,
  feeStructures,
  submitting,
  onSubmit,
}: AssignFeeFormProps) {
  const [form, setForm] = useState<AssignFeeFormState>(initialFormState);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      studentId: current.studentId || options.students[0]?.id || '',
      feeStructureId: current.feeStructureId || feeStructures[0]?.id || '',
    }));
  }, [feeStructures, options.students]);

  const selectedStructure = useMemo(
    () => feeStructures.find((item) => item.id === form.feeStructureId) ?? null,
    [feeStructures, form.feeStructureId],
  );

  useEffect(() => {
    if (!selectedStructure) {
      return;
    }

    setForm((current) => ({
      ...current,
      totalAmount:
        current.totalAmount || String(selectedStructure.amount),
      dueDate:
        current.dueDate || (selectedStructure.dueDate?.slice(0, 10) ?? ''),
    }));
  }, [selectedStructure]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      studentId: form.studentId,
      feeStructureId: form.feeStructureId,
      sessionId: options.currentSessionId,
      totalAmount: form.totalAmount ? Number(form.totalAmount) : undefined,
      concessionAmount: form.concessionAmount
        ? Number(form.concessionAmount)
        : undefined,
      dueDate: form.dueDate || undefined,
    });

    setForm({
      ...initialFormState,
      studentId: options.students[0]?.id || '',
      feeStructureId: feeStructures[0]?.id || '',
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Assign Fee</h2>
          <p className="muted-text">Attach a fee structure to a student account.</p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Student</span>
          <select
            required
            value={form.studentId}
            onChange={(event) =>
              setForm((current) => ({ ...current, studentId: event.target.value }))
            }
          >
            <option value="">Select student</option>
            {options.students.map((student: FeeStudentOption) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.studentCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Fee Structure</span>
          <select
            required
            value={form.feeStructureId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                feeStructureId: event.target.value,
                totalAmount: '',
                dueDate: '',
              }))
            }
          >
            <option value="">Select structure</option>
            {feeStructures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name} ({structure.feeCode})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Total Amount</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.totalAmount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                totalAmount: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Concession</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.concessionAmount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                concessionAmount: event.target.value,
              }))
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

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Assigning...' : 'Assign Fee'}
        </button>
      </form>
    </section>
  );
}
