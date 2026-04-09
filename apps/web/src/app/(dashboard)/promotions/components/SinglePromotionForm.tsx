'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import type {
  PromoteStudentPayload,
  PromotionAction,
  PromotionEligibleStudentRecord,
  PromotionOptionsPayload,
  PromotionPreviewPayload,
  PromotionPreviewRecord,
  PromotionPreviewResponse,
} from '@/utils/api';

interface SinglePromotionFormProps {
  open: boolean;
  student: PromotionEligibleStudentRecord | null;
  options: PromotionOptionsPayload;
  previewing: boolean;
  submitting: boolean;
  onClose: () => void;
  onPreview: (payload: PromotionPreviewPayload) => Promise<PromotionPreviewResponse>;
  onSubmit: (payload: PromoteStudentPayload) => Promise<void>;
}

interface SinglePromotionFormState {
  action: PromotionAction;
  toAcademicSessionId: string;
  toClassId: string;
  toSectionId: string;
  remarks: string;
}

const initialFormState: SinglePromotionFormState = {
  action: 'PROMOTED',
  toAcademicSessionId: '',
  toClassId: '',
  toSectionId: '',
  remarks: '',
};

function statusTone(status: PromotionPreviewRecord['status']) {
  switch (status) {
    case 'VALID':
      return 'success';
    case 'ALREADY_PROMOTED':
      return 'warning';
    case 'CONFLICT':
      return 'danger';
    default:
      return 'danger';
  }
}

export function SinglePromotionForm({
  open,
  student,
  options,
  previewing,
  submitting,
  onClose,
  onPreview,
  onSubmit,
}: SinglePromotionFormProps) {
  const [form, setForm] = useState<SinglePromotionFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PromotionPreviewRecord | null>(null);

  const sourceEnrollment = student?.sourceEnrollment ?? null;
  const targetClass =
    options.classes.find((item) => item.id === form.toClassId) ?? null;

  const availableTargetSessions = useMemo(
    () =>
      options.academicSessions.filter(
        (session) => session.id !== sourceEnrollment?.academicSession.id,
      ),
    [options.academicSessions, sourceEnrollment?.academicSession.id],
  );

  useEffect(() => {
    if (!open || !student || !sourceEnrollment) {
      setForm(initialFormState);
      setFormError(null);
      setPreviewItem(null);
      return;
    }

    setForm({
      action: 'PROMOTED',
      toAcademicSessionId: availableTargetSessions[0]?.id ?? '',
      toClassId: '',
      toSectionId: '',
      remarks: '',
    });
    setFormError(null);
    setPreviewItem(null);
  }, [availableTargetSessions, open, sourceEnrollment, student]);

  useEffect(() => {
    if (!student?.sourceEnrollment) {
      return;
    }

    if (form.action === 'DETAINED') {
      setForm((current) => ({
        ...current,
        toClassId: student.sourceEnrollment?.academicClass.id ?? '',
        toSectionId: student.sourceEnrollment?.section?.id ?? '',
      }));
    }
  }, [form.action, student]);

  useEffect(() => {
    setPreviewItem(null);
  }, [
    form.action,
    form.toAcademicSessionId,
    form.toClassId,
    form.toSectionId,
  ]);

  const buildPayload = () => {
    if (!student || !sourceEnrollment) {
      setFormError('Student enrollment context is not available.');
      return null;
    }

    if (!form.toAcademicSessionId) {
      setFormError('Target academic session is required.');
      return null;
    }

    if (!form.toClassId) {
      setFormError('Target class is required.');
      return null;
    }

    if (targetClass && targetClass.sections.length > 0 && !form.toSectionId) {
      setFormError('Target section is required.');
      return null;
    }

    return {
      studentId: student.id,
      fromAcademicSessionId: sourceEnrollment.academicSession.id,
      toAcademicSessionId: form.toAcademicSessionId,
      fromClassId: sourceEnrollment.academicClass.id,
      toClassId: form.toClassId,
      fromSectionId: sourceEnrollment.section?.id,
      toSectionId: form.toSectionId || undefined,
      fromEnrollmentId: sourceEnrollment.id,
      action: form.action,
      remarks: form.remarks.trim() || undefined,
    };
  };

  const handlePreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const payload = buildPayload();

    if (!payload) {
      return;
    }

    try {
      const response = await onPreview({
        studentIds: [payload.studentId],
        fromAcademicSessionId: payload.fromAcademicSessionId,
        toAcademicSessionId: payload.toAcademicSessionId,
        fromClassId: payload.fromClassId,
        toClassId: payload.toClassId,
        fromSectionId: payload.fromSectionId,
        toSectionId: payload.toSectionId,
        action: payload.action,
      });

      setPreviewItem(response.items[0] ?? null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Failed to generate single promotion preview.',
      );
    }
  };

  const handleConfirm = async () => {
    setFormError(null);

    const payload = buildPayload();

    if (!payload) {
      return;
    }

    if (!previewItem) {
      setFormError('Preview the promotion before confirming.');
      return;
    }

    if (previewItem.status !== 'VALID') {
      setFormError('Only valid promotions can be confirmed.');
      return;
    }

    await onSubmit(payload);
  };

  return (
    <Modal
      className="max-w-2xl"
      description="Create a promotion or detention record without overwriting historical enrollment data."
      footer={null}
      open={open}
      title={student ? `Promote ${student.name}` : 'Promote Student'}
      onClose={onClose}
    >
      <form className="simple-form" onSubmit={handlePreview}>
        {formError ? <p className="error-text">{formError}</p> : null}

        <label>
          <span>Action</span>
          <select
            disabled={previewing || submitting}
            value={form.action}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                action: event.target.value as PromotionAction,
                ...(event.target.value === 'PROMOTED'
                  ? {}
                  : {
                      toClassId: student?.sourceEnrollment?.academicClass.id ?? '',
                      toSectionId: student?.sourceEnrollment?.section?.id ?? '',
                    }),
              }))
            }
          >
            <option value="PROMOTED">Promoted</option>
            <option value="DETAINED">Detained</option>
          </select>
        </label>

        <label>
          <span>Source Enrollment</span>
          <input
            disabled
            type="text"
            value={
              sourceEnrollment
                ? `${sourceEnrollment.academicSession.name} • ${sourceEnrollment.academicClass.name}${sourceEnrollment.section ? ` • ${sourceEnrollment.section.name}` : ''}`
                : ''
            }
          />
        </label>

        <label>
          <span>Target Academic Session</span>
          <select
            disabled={previewing || submitting}
            value={form.toAcademicSessionId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                toAcademicSessionId: event.target.value,
              }))
            }
          >
            <option value="">Select target session</option>
            {availableTargetSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Target Class</span>
          <select
            disabled={previewing || submitting || form.action === 'DETAINED'}
            value={form.toClassId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                toClassId: event.target.value,
                toSectionId: '',
              }))
            }
          >
            <option value="">Select target class</option>
            {options.classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Target Section</span>
          <select
            disabled={previewing || submitting || !targetClass}
            value={form.toSectionId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                toSectionId: event.target.value,
              }))
            }
          >
            <option value="">Select target section</option>
            {targetClass?.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Remarks</span>
          <textarea
            disabled={previewing || submitting}
            placeholder="Optional remarks for the promotion record"
            rows={4}
            value={form.remarks}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                remarks: event.target.value,
              }))
            }
          />
        </label>

        {previewItem ? (
          <div className="card table-panel">
            <div className="panel-heading">
              <div>
                <h3>Preview Result</h3>
                <p className="muted-text">
                  Confirm only after the student is marked valid.
                </p>
              </div>
              <Badge tone={statusTone(previewItem.status)}>
                {previewItem.status.replaceAll('_', ' ')}
              </Badge>
            </div>
            <p className="muted-text">{previewItem.message}</p>
          </div>
        ) : null}

        <div className="table-actions">
          <button
            className="secondary-button"
            disabled={previewing || submitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="secondary-button"
            disabled={previewing || submitting}
            type="submit"
          >
            {previewing ? 'Previewing...' : 'Preview Promotion'}
          </button>
          <button
            className="primary-button"
            disabled={submitting || !previewItem || previewItem.status !== 'VALID'}
            onClick={handleConfirm}
            type="button"
          >
            {submitting
              ? 'Saving...'
              : form.action === 'DETAINED'
                ? 'Confirm Detention'
                : 'Confirm Promotion'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
