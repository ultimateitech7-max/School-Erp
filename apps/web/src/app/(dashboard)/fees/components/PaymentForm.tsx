'use client';

import { FormEvent, useEffect, useState } from 'react';
import type {
  FeesOptionsPayload,
  PaymentMode,
  RecordPaymentPayload,
  StudentFeeRecord,
} from '@/utils/api';

interface PaymentFormProps {
  options: FeesOptionsPayload;
  studentFees: StudentFeeRecord[];
  submitting: boolean;
  onSubmit: (payload: RecordPaymentPayload) => Promise<void>;
}

interface PaymentFormState {
  studentFeeId: string;
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMode;
  reference: string;
  notes: string;
}

const initialFormState: PaymentFormState = {
  studentFeeId: '',
  amount: '',
  paymentDate: '',
  paymentMethod: 'CASH',
  reference: '',
  notes: '',
};

export function PaymentForm({
  options,
  studentFees,
  submitting,
  onSubmit,
}: PaymentFormProps) {
  const [form, setForm] = useState<PaymentFormState>(initialFormState);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      studentFeeId: current.studentFeeId || studentFees[0]?.studentFeeId || '',
      paymentMethod: current.paymentMethod || options.paymentModes[0] || 'CASH',
    }));
  }, [options.paymentModes, studentFees]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      studentFeeId: form.studentFeeId,
      amount: Number(form.amount),
      paymentDate: form.paymentDate || undefined,
      paymentMethod: form.paymentMethod,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });

    setForm({
      ...initialFormState,
      studentFeeId: studentFees[0]?.studentFeeId || '',
      paymentMethod: options.paymentModes[0] || 'CASH',
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Record Payment</h2>
          <p className="muted-text">Capture payments and generate receipts.</p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Assigned Fee</span>
          <select
            required
            value={form.studentFeeId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                studentFeeId: event.target.value,
              }))
            }
          >
            <option value="">Select assigned fee</option>
            {studentFees.map((studentFee) => (
              <option key={studentFee.studentFeeId} value={studentFee.studentFeeId}>
                {studentFee.student.name} · {studentFee.feeStructure.name} · Due{' '}
                {studentFee.dueAmount}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Amount</span>
          <input
            min="0.01"
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
          <span>Payment Date</span>
          <input
            type="date"
            value={form.paymentDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                paymentDate: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Payment Method</span>
          <select
            value={form.paymentMethod}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                paymentMethod: event.target.value as PaymentMode,
              }))
            }
          >
            {options.paymentModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Reference</span>
          <input
            type="text"
            value={form.reference}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reference: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Notes</span>
          <input
            type="text"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Recording...' : 'Record Payment'}
        </button>
      </form>
    </section>
  );
}
