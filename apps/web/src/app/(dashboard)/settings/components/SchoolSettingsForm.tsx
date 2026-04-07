'use client';

import { useEffect, useState } from 'react';
import type {
  SchoolAddressPayload,
  SchoolSettingsFormPayload,
  SchoolSettingsRecord,
} from '@/utils/api';

interface SchoolSettingsFormProps {
  initialValue: SchoolSettingsRecord;
  isSubmitting: boolean;
  onSubmit: (payload: SchoolSettingsFormPayload) => Promise<void>;
}

export function SchoolSettingsForm({
  initialValue,
  isSubmitting,
  onSubmit,
}: SchoolSettingsFormProps) {
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [academicSessionLabel, setAcademicSessionLabel] = useState('');
  const [address, setAddress] = useState<SchoolAddressPayload>({});

  useEffect(() => {
    setName(initialValue.name);
    setContactEmail(initialValue.contactEmail ?? '');
    setContactPhone(initialValue.contactPhone ?? '');
    setTimezone(initialValue.timezone);
    setPrincipalName(initialValue.principalName ?? '');
    setAcademicSessionLabel(initialValue.academicSessionLabel ?? '');
    setAddress(initialValue.address ?? {});
  }, [initialValue]);

  const handleAddressChange = (key: string, value: string) => {
    setAddress((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      name,
      contactEmail,
      contactPhone,
      timezone,
      principalName,
      academicSessionLabel,
      address,
    });
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>School Settings</h2>
          <p className="muted-text">
            Update contact details, profile information, and address.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>School Name</span>
          <input
            required
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label>
          <span>Contact Email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </label>

        <label>
          <span>Contact Phone</span>
          <input
            type="text"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </label>

        <label>
          <span>Timezone</span>
          <input
            required
            type="text"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </label>

        <label>
          <span>Principal Name</span>
          <input
            type="text"
            value={principalName}
            onChange={(event) => setPrincipalName(event.target.value)}
          />
        </label>

        <label>
          <span>Academic Session Label</span>
          <input
            type="text"
            value={academicSessionLabel}
            onChange={(event) => setAcademicSessionLabel(event.target.value)}
          />
        </label>

        <div className="subform-stack">
          <div className="subform-header">
            <h3>Address</h3>
          </div>
          <div className="nested-form-grid settings-address-grid">
            <label>
              <span>Line 1</span>
              <input
                type="text"
                value={String(address.line1 ?? '')}
                onChange={(event) => handleAddressChange('line1', event.target.value)}
              />
            </label>

            <label>
              <span>Line 2</span>
              <input
                type="text"
                value={String(address.line2 ?? '')}
                onChange={(event) => handleAddressChange('line2', event.target.value)}
              />
            </label>

            <label>
              <span>City</span>
              <input
                type="text"
                value={String(address.city ?? '')}
                onChange={(event) => handleAddressChange('city', event.target.value)}
              />
            </label>

            <label>
              <span>State</span>
              <input
                type="text"
                value={String(address.state ?? '')}
                onChange={(event) => handleAddressChange('state', event.target.value)}
              />
            </label>

            <label>
              <span>Country</span>
              <input
                type="text"
                value={String(address.country ?? '')}
                onChange={(event) => handleAddressChange('country', event.target.value)}
              />
            </label>

            <label>
              <span>Postal Code</span>
              <input
                type="text"
                value={String(address.postalCode ?? '')}
                onChange={(event) => handleAddressChange('postalCode', event.target.value)}
              />
            </label>
          </div>
        </div>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Saving...' : 'Save School Settings'}
        </button>
      </form>
    </section>
  );
}
