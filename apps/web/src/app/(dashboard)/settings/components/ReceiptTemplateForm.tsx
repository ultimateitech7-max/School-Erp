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
import { resolveAssetUrl } from '@/utils/api';
import { buildFeeReceiptPreviewHtml } from '@/utils/fee-receipt';

interface ReceiptTemplateFormProps {
  initialValue: FeeReceiptTemplateRecord;
  isSubmitting: boolean;
  onSubmit: (payload: FeeReceiptTemplateFormPayload) => Promise<void>;
  onUploadSignature: (file: File) => Promise<FeeReceiptTemplateRecord>;
  schoolSettings: SchoolSettingsRecord;
  branding: SchoolBrandingRecord;
}

export function ReceiptTemplateForm({
  initialValue,
  isSubmitting,
  onSubmit,
  onUploadSignature,
  schoolSettings,
  branding,
}: ReceiptTemplateFormProps) {
  const [form, setForm] = useState<FeeReceiptTemplateRecord>(initialValue);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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

  const handleSignatureFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingSignature(true);
    setUploadMessage(null);

    try {
      const updatedTemplate = await onUploadSignature(file);
      setForm(updatedTemplate);
      setUploadMessage('Signature uploaded successfully.');
    } catch (error) {
      setUploadMessage(
        error instanceof Error ? error.message : 'Failed to upload signature.',
      );
    } finally {
      setIsUploadingSignature(false);
      event.target.value = '';
    }
  };

  const previewSignatureUrl = resolveAssetUrl(form.signatureImageUrl);

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <h2>Receipt Template</h2>
          <p className="muted-text">
            Customize the branded fee receipt format for this school.
          </p>
        </div>
      </div>

      <form className="simple-form compact-panel-stack receipt-template-form" onSubmit={handleSubmit}>
        <div className="form-grid compact-form-grid receipt-template-grid">
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

          <Field label="Header Note">
            <Textarea
              className="receipt-template-textarea receipt-template-textarea-sm"
              value={form.headerNote}
              onChange={(event) =>
                setForm((current) => ({ ...current, headerNote: event.target.value }))
              }
            />
          </Field>

          <Field label="Footer Note">
            <Textarea
              className="receipt-template-textarea receipt-template-textarea-sm"
              value={form.footerNote}
              onChange={(event) =>
                setForm((current) => ({ ...current, footerNote: event.target.value }))
              }
            />
          </Field>

          <Field className="form-grid-span-full" label="Terms & Conditions">
            <Textarea
              className="receipt-template-textarea"
              value={form.termsAndConditions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  termsAndConditions: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        <div className="receipt-template-signature-grid">
          <Field label="Signature Label">
            <Input
              value={form.signatureLabel}
              onChange={(event) =>
                setForm((current) => ({ ...current, signatureLabel: event.target.value }))
              }
            />
          </Field>

          <Field label="Upload Signature">
            <Input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={isSubmitting || isUploadingSignature}
              type="file"
              onChange={handleSignatureFileChange}
            />
          </Field>

          <Field label="Signature Image URL">
            <Input
              placeholder="https://example.com/signature.png or uploaded asset path"
              value={form.signatureImageUrl ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  signatureImageUrl: event.target.value || null,
                }))
              }
            />
          </Field>

          <div className="receipt-template-toggle-stack">
            <label className="receipt-template-toggle-inline">
              <input
                checked={form.showLogo}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, showLogo: event.target.checked }))
                }
              />
              <span>Show school logo on receipt</span>
            </label>

            <label className="receipt-template-toggle-inline">
              <input
                checked={form.showSignature}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, showSignature: event.target.checked }))
                }
              />
              <span>Show signature line</span>
            </label>
          </div>
        </div>

        {previewSignatureUrl ? (
          <div className="subtle-card receipt-template-signature-preview">
            <div className="portal-notice-head">
              <strong>Signature Preview</strong>
              <span className="muted-text">
                {isUploadingSignature ? 'Uploading...' : 'Ready'}
              </span>
            </div>
            <img
              alt="Receipt signature preview"
              className="receipt-template-signature-image"
              src={previewSignatureUrl}
            />
          </div>
        ) : null}

        {uploadMessage ? (
          <p className={uploadMessage.includes('successfully') ? 'success-text' : 'error-text'}>
            {uploadMessage}
          </p>
        ) : null}

        <div className="subform-stack">
          <div className="subform-header">
            <h3>Custom Fields</h3>
            <p className="muted-text">
              Add school-specific labels like affiliation, GST, branch, or office notes.
            </p>
          </div>

          <div className="compact-panel-stack">
            {form.customFields.map((field, index) => (
              <div className="form-grid compact-form-grid receipt-template-custom-row" key={`receipt-custom-${index}`}>
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

                <div className="form-actions receipt-template-custom-actions">
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

        <div className="form-actions">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : 'Save Receipt Template'}
          </Button>
        </div>
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
