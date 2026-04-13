'use client';

import { useEffect, useState } from 'react';
import type {
  SchoolBrandingFormPayload,
  SchoolBrandingRecord,
} from '@/utils/api';
import { resolveAssetUrl } from '@/utils/api';

interface BrandingFormProps {
  initialValue: SchoolBrandingRecord;
  isSubmitting: boolean;
  onSubmit: (payload: SchoolBrandingFormPayload) => Promise<void>;
  onUploadLogo: (file: File) => Promise<SchoolBrandingRecord>;
}

export function BrandingForm({
  initialValue,
  isSubmitting,
  onSubmit,
  onUploadLogo,
}: BrandingFormProps) {
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [website, setWebsite] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  useEffect(() => {
    setLogoUrl(initialValue.logoUrl ?? '');
    setPrimaryColor(initialValue.primaryColor ?? '');
    setSecondaryColor(initialValue.secondaryColor ?? '');
    setWebsite(initialValue.website ?? '');
    setSupportEmail(initialValue.supportEmail ?? '');
  }, [initialValue]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      logoUrl,
      primaryColor,
      secondaryColor,
      website,
      supportEmail,
    });
  };

  const handleLogoFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingLogo(true);
    setUploadMessage(null);

    try {
      const updatedBranding = await onUploadLogo(file);
      setLogoUrl(updatedBranding.logoUrl ?? '');
      setUploadMessage('Logo uploaded successfully.');
    } catch (error) {
      setUploadMessage(
        error instanceof Error ? error.message : 'Failed to upload logo.',
      );
    } finally {
      setIsUploadingLogo(false);
      event.target.value = '';
    }
  };

  const previewLogoUrl = resolveAssetUrl(logoUrl);

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Branding</h2>
          <p className="muted-text">
            Customize logo, brand colors, and support contacts.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Logo URL</span>
          <input
            placeholder="https://example.com/logo.png or uploaded asset path"
            type="text"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
          />
        </label>

        <label>
          <span>Upload Logo</span>
          <input
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={isSubmitting || isUploadingLogo}
            onChange={handleLogoFileChange}
            type="file"
          />
        </label>

        {previewLogoUrl ? (
          <div className="subtle-card portal-notice-card">
            <div className="portal-notice-head">
              <strong>Logo Preview</strong>
              <span className="muted-text">
                {isUploadingLogo ? 'Uploading...' : 'Ready'}
              </span>
            </div>
            <img
              alt="School logo preview"
              className="school-brand-logo"
              src={previewLogoUrl}
              style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '0.75rem',
                objectFit: 'cover',
              }}
            />
          </div>
        ) : null}

        {uploadMessage ? (
          <p className={uploadMessage.includes('successfully') ? 'success-text' : 'error-text'}>
            {uploadMessage}
          </p>
        ) : null}

        <label>
          <span>Primary Color</span>
          <input
            placeholder="#0f766e"
            type="text"
            value={primaryColor}
            onChange={(event) => setPrimaryColor(event.target.value)}
          />
        </label>

        <label>
          <span>Secondary Color</span>
          <input
            placeholder="#115e59"
            type="text"
            value={secondaryColor}
            onChange={(event) => setSecondaryColor(event.target.value)}
          />
        </label>

        <label>
          <span>Website</span>
          <input
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>

        <label>
          <span>Support Email</span>
          <input
            type="email"
            value={supportEmail}
            onChange={(event) => setSupportEmail(event.target.value)}
          />
        </label>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : 'Save Branding'}
        </button>
      </form>
    </section>
  );
}
