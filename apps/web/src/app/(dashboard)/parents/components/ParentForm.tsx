'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type {
  ParentFormPayload,
  ParentRecord,
  ParentRelationType,
} from '@/utils/api';

const relationOptions: ParentRelationType[] = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'BROTHER',
  'SISTER',
  'RELATIVE',
  'OTHER',
];

interface ParentFormProps {
  initialValue?: ParentRecord | null;
  submitting: boolean;
  onSubmit: (payload: ParentFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface ParentFormState {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  relationType: ParentRelationType;
  emergencyContact: string;
  portalPassword: string;
}

const emptyState: ParentFormState = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  relationType: 'FATHER',
  emergencyContact: '',
  portalPassword: '',
};

export function ParentForm({
  initialValue,
  submitting,
  onSubmit,
  onCancel,
}: ParentFormProps) {
  const [form, setForm] = useState<ParentFormState>(emptyState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialValue) {
      setForm(emptyState);
      setErrors({});
      return;
    }

    setForm({
      fullName: initialValue.fullName,
      phone: initialValue.phone,
      email: initialValue.email ?? '',
      address: initialValue.address ?? '',
      relationType: initialValue.relationType,
      emergencyContact: initialValue.emergencyContact ?? '',
      portalPassword: '',
    });
    setErrors({});
  }, [initialValue]);

  const setField = <K extends keyof ParentFormState>(
    key: K,
    value: ParentFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Parent name is required.';
    }

    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone number is required.';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (form.portalPassword && form.portalPassword.length < 8) {
      nextErrors.portalPassword = 'Portal password must be at least 8 characters.';
    }

    if (form.portalPassword && !form.email.trim()) {
      nextErrors.portalPassword = 'Email is required when enabling portal access.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      relationType: form.relationType,
      emergencyContact: form.emergencyContact.trim() || undefined,
      portalPassword: form.portalPassword.trim() || undefined,
    });

    if (!initialValue) {
      setForm(emptyState);
      setErrors({});
    }
  };

  return (
    <form className="parent-form" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <h3>{initialValue ? 'Edit Parent Profile' : 'Create Parent Profile'}</h3>
          <p className="muted-text">
            Maintain guardian records and optionally enable parent portal access.
          </p>
        </div>
      </div>

      <div className="form-grid two-column-grid">
        <Field error={errors.fullName} label="Full Name">
          <Input
            placeholder="e.g. Anita Sharma"
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
          />
        </Field>

        <Field error={errors.phone} label="Phone">
          <Input
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />
        </Field>

        <Field error={errors.email} hint="Required only for portal login." label="Email">
          <Input
            placeholder="parent@school.com"
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
          />
        </Field>

        <Field label="Relation Type">
          <Select
            value={form.relationType}
            onChange={(event) =>
              setField('relationType', event.target.value as ParentRelationType)
            }
          >
            {relationOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Emergency Contact">
          <Input
            placeholder="Optional alternate number"
            value={form.emergencyContact}
            onChange={(event) => setField('emergencyContact', event.target.value)}
          />
        </Field>

        <Field
          error={errors.portalPassword}
          hint={initialValue ? 'Leave blank to keep current password.' : 'Optional portal access password.'}
          label="Portal Password"
        >
          <Input
            placeholder="Create parent portal password"
            type="password"
            value={form.portalPassword}
            onChange={(event) => setField('portalPassword', event.target.value)}
          />
        </Field>
      </div>

      <Field className="full-width-field" label="Address">
        <Textarea
          placeholder="Home address"
          rows={4}
          value={form.address}
          onChange={(event) => setField('address', event.target.value)}
        />
      </Field>

      <div className="form-actions">
        {initialValue && onCancel ? (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        ) : null}
        <Button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : initialValue ? 'Update Parent' : 'Create Parent'}
        </Button>
      </div>
    </form>
  );
}
