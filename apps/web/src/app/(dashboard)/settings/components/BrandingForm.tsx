'use client';

import { useEffect, useState } from 'react';
import type {
  SchoolBrandingFormPayload,
  SchoolBrandingRecord,
} from '@/utils/api';

interface BrandingFormProps {
  initialValue: SchoolBrandingRecord;
  isSubmitting: boolean;
  onSubmit: (payload: SchoolBrandingFormPayload) => Promise<void>;
}

export function BrandingForm({
  initialValue,
  isSubmitting,
  onSubmit,
}: BrandingFormProps) {
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [website, setWebsite] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

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
            type="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
          />
        </label>

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
