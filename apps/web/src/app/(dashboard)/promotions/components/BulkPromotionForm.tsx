'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  BulkPromoteStudentsPayload,
  PromotionAction,
  PromotionEligibleStudentRecord,
  PromotionOptionsPayload,
  PromotionPreviewPayload,
  PromotionPreviewSummary,
} from '@/utils/api';

interface BulkPromotionFormProps {
  selectedStudents: PromotionEligibleStudentRecord[];
  options: PromotionOptionsPayload;
  fromAcademicSessionId: string;
  fromClassId: string;
  fromSectionId: string;
  previewing: boolean;
  submitting: boolean;
  previewSummary: PromotionPreviewSummary | null;
  hasPreview: boolean;
  canConfirm: boolean;
  onPreview: (payload: PromotionPreviewPayload) => Promise<void>;
  onSubmit: (payload: BulkPromoteStudentsPayload) => Promise<void>;
  onClearPreview: () => void;
}

interface BulkPromotionFormState {
  action: PromotionAction;
  toAcademicSessionId: string;
  toClassId: string;
  toSectionId: string;
  remarks: string;
}

const initialFormState: BulkPromotionFormState = {
  action: 'PROMOTED',
  toAcademicSessionId: '',
  toClassId: '',
  toSectionId: '',
  remarks: '',
};

export function BulkPromotionForm({
  selectedStudents,
  options,
  fromAcademicSessionId,
  fromClassId,
  fromSectionId,
  previewing,
  submitting,
  previewSummary,
  hasPreview,
  canConfirm,
  onPreview,
  onSubmit,
  onClearPreview,
}: BulkPromotionFormProps) {
  const [form, setForm] = useState<BulkPromotionFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCount = selectedStudents.length;
  const targetClass =
    options.classes.find((item) => item.id === form.toClassId) ?? null;
  const availableTargetSessions = useMemo(
    () =>
      options.academicSessions.filter(
        (session) => session.id !== fromAcademicSessionId,
      ),
    [fromAcademicSessionId, options.academicSessions],
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      toAcademicSessionId:
        current.toAcademicSessionId ||
        availableTargetSessions[0]?.id ||
        '',
    }));
  }, [availableTargetSessions]);

  useEffect(() => {
    if (form.action === 'DETAINED') {
      setForm((current) => ({
        ...current,
        toClassId: fromClassId,
        toSectionId: fromSectionId,
      }));
    }
  }, [form.action, fromClassId, fromSectionId]);

  useEffect(() => {
    onClearPreview();
  }, [
    form.action,
    form.toAcademicSessionId,
    form.toClassId,
    form.toSectionId,
    selectedCount,
    onClearPreview,
  ]);

  const buildPayload = () => {
    if (!selectedCount) {
      setFormError('Select at least one student for bulk promotion.');
      return null;
    }

    if (!fromAcademicSessionId || !fromClassId) {
      setFormError('Select the source session and class before bulk promotion.');
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
      studentIds: selectedStudents.map((student) => student.id),
      fromAcademicSessionId,
      toAcademicSessionId: form.toAcademicSessionId,
      fromClassId,
      toClassId: form.toClassId,
      fromSectionId: fromSectionId || undefined,
      toSectionId: form.toSectionId || undefined,
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

    await onPreview(payload);
  };

  const handleConfirm = async () => {
    setFormError(null);

    const payload = buildPayload();

    if (!payload) {
      return;
    }

    if (!hasPreview) {
      setFormError('Preview the promotion before confirming.');
      return;
    }

    if (!canConfirm) {
      setFormError('No valid students remain for confirmation.');
      return;
    }

    await onSubmit(payload);
  };

  return (
    <section className="card panel student-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Bulk Promotion</h2>
          <p className="muted-text">
            Preview the selected students first, then confirm only the valid
            promotions.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handlePreview}>
        {formError ? <p className="error-text">{formError}</p> : null}

        <label>
          <span>Selected Students</span>
          <input disabled type="text" value={`${selectedCount} selected`} />
        </label>

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
                      toClassId: fromClassId,
                      toSectionId: fromSectionId,
                    }),
              }))
            }
          >
            <option value="PROMOTED">Promoted</option>
            <option value="DETAINED">Detained</option>
          </select>
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
            placeholder="Optional remarks for all selected students"
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

        <div className="table-actions">
          <button
            className="secondary-button"
            disabled={previewing || submitting}
            type="submit"
          >
            {previewing ? 'Previewing...' : 'Preview Promotion'}
          </button>
          <button
            className="primary-button"
            disabled={submitting || !hasPreview || !canConfirm}
            onClick={handleConfirm}
            type="button"
          >
            {submitting
              ? 'Confirming...'
              : form.action === 'DETAINED'
                ? `Confirm Detention (${previewSummary?.valid ?? 0})`
                : `Confirm Promotion (${previewSummary?.valid ?? 0})`}
          </button>
        </div>
      </form>
    </section>
  );
}
