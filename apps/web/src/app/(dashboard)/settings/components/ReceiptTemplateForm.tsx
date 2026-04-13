'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import type {
  FeeReceiptTemplateFormPayload,
  FeeReceiptTemplateRecord,
  SchoolBrandingRecord,
  SchoolSettingsRecord,
} from '@/utils/api';
import { buildFeeReceiptPreviewHtml } from '@/utils/fee-receipt';

interface ReceiptTemplateFormProps {
  initialValue: FeeReceiptTemplateRecord;
  isSubmitting: boolean;
  onSubmit: (payload: FeeReceiptTemplateFormPayload) => Promise<void>;
  schoolSettings: SchoolSettingsRecord;
  branding: SchoolBrandingRecord;
}

export function ReceiptTemplateForm({
  initialValue,
  isSubmitting,
  onSubmit,
  schoolSettings,
  branding,
}: ReceiptTemplateFormProps) {
  const [form, setForm] = useState<FeeReceiptTemplateRecord>(initialValue);

  useEffect(() => {
    setForm(initialValue);
  }, [initialValue]);

  const previewHtml = useMemo(
    () =>
      buildFeeReceiptPreviewHtml({
        template: form,
        schoolSettings,
        branding,
      }),
    [branding, form, schoolSettings],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Receipt Template</h2>
          <p className="muted-text">
            Customize the branded fee receipt format for this school.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <div className="form-grid compact-form-grid">
          <Field label="Receipt Title">
            <Input
              value={form.receiptTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, receiptTitle: event.target.value }))
              }
            />
          </Field>

          <Field label="Receipt Subtitle">
            <Input
              value={form.receiptSubtitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, receiptSubtitle: event.target.value }))
              }
            />
          </Field>
        </div>

        <Field label="Header Note">
          <Textarea
            value={form.headerNote}
            onChange={(event) =>
              setForm((current) => ({ ...current, headerNote: event.target.value }))
            }
          />
        </Field>

        <Field label="Footer Note">
          <Textarea
            value={form.footerNote}
            onChange={(event) =>
              setForm((current) => ({ ...current, footerNote: event.target.value }))
            }
          />
        </Field>

        <Field label="Terms & Conditions">
          <Textarea
            value={form.termsAndConditions}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                termsAndConditions: event.target.value,
              }))
            }
          />
        </Field>

        <div className="form-grid compact-form-grid">
          <Field label="Signature Label">
            <Input
              value={form.signatureLabel}
              onChange={(event) =>
                setForm((current) => ({ ...current, signatureLabel: event.target.value }))
              }
            />
          </Field>

          <label className="checkbox-inline">
            <input
              checked={form.showLogo}
              type="checkbox"
              onChange={(event) =>
                setForm((current) => ({ ...current, showLogo: event.target.checked }))
              }
            />
            <span>Show school logo on receipt</span>
          </label>
        </div>

        <label className="checkbox-inline">
          <input
            checked={form.showSignature}
            type="checkbox"
            onChange={(event) =>
              setForm((current) => ({ ...current, showSignature: event.target.checked }))
            }
          />
          <span>Show signature line</span>
        </label>

        <div className="subform-stack">
          <div className="subform-header">
            <h3>Custom Fields</h3>
            <p className="muted-text">
              Add school-specific labels like affiliation, GST, branch, or office notes.
            </p>
          </div>

          <div className="compact-panel-stack">
            {form.customFields.map((field, index) => (
              <div className="form-grid compact-form-grid" key={`receipt-custom-${index}`}>
                <Field label={`Label ${index + 1}`}>
                  <Input
                    value={field.label}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customFields: current.customFields.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                </Field>

                <Field label={`Value ${index + 1}`}>
                  <Input
                    value={field.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customFields: current.customFields.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      }))
                    }
                  />
                </Field>

                <div className="form-actions">
                  <Button
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        customFields: current.customFields.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="form-actions">
            <Button
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  customFields: [...current.customFields, { label: '', value: '' }],
                }))
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              Add Custom Field
            </Button>
          </div>
        </div>

        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : 'Save Receipt Template'}
        </Button>
      </form>

      <div className="receipt-preview-shell">
        <div className="panel-heading compact-panel-heading">
          <div>
            <h3>Live Preview</h3>
            <p className="muted-text">
              Review the receipt below while editing the template fields above.
            </p>
          </div>
        </div>

        <div className="receipt-preview-frame-wrap">
          <iframe
            className="receipt-preview-frame"
            srcDoc={previewHtml}
            title="Fee receipt preview"
          />
        </div>
      </div>
    </section>
  );
}
