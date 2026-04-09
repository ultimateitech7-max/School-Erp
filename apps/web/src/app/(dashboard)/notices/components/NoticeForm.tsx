'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import type {
  NoticeAudienceType,
  NoticeFormPayload,
  NoticeRecord,
} from '@/utils/api';

const audienceOptions: Array<{
  value: NoticeAudienceType;
  label: string;
}> = [
  { value: 'ALL', label: 'All' },
  { value: 'STUDENTS', label: 'Students' },
  { value: 'PARENTS', label: 'Parents' },
  { value: 'STAFF', label: 'Staff' },
];

interface NoticeFormProps {
  notice: NoticeRecord | null;
  submitting: boolean;
  onCancelEdit: () => void;
  onSubmit: (payload: NoticeFormPayload) => Promise<void>;
}

export function NoticeForm({
  notice,
  submitting,
  onCancelEdit,
  onSubmit,
}: NoticeFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audienceType, setAudienceType] = useState<NoticeAudienceType>('ALL');
  const [expiryDate, setExpiryDate] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      setTitle('');
      setDescription('');
      setAudienceType('ALL');
      setExpiryDate('');
      setIsPublished(false);
      setError(null);
      return;
    }

    setTitle(notice.title);
    setDescription(notice.description);
    setAudienceType(notice.audienceType);
    setExpiryDate(notice.expiryDate ? notice.expiryDate.slice(0, 10) : '');
    setIsPublished(notice.isPublished);
    setError(null);
  }, [notice]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      audienceType,
      expiryDate: expiryDate || undefined,
      isPublished,
    });

    if (!notice) {
      setTitle('');
      setDescription('');
      setAudienceType('ALL');
      setExpiryDate('');
      setIsPublished(false);
    }
  };

  return (
    <form className="card panel" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <h2>{notice ? 'Edit Notice' : 'Create Notice'}</h2>
          <p className="muted-text">
            Publish targeted updates for students, parents, and staff.
          </p>
        </div>
      </div>

      <div className="form-grid">
        <Field label="Title">
          <Input
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Holiday announcement"
            value={title}
          />
        </Field>

        <Field label="Audience">
          <Select
            value={audienceType}
            onChange={(event) => setAudienceType(event.target.value as NoticeAudienceType)}
          >
            {audienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field className="form-grid-span-full" label="Description">
          <textarea
            className="ui-input ui-textarea"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Share the full notice content here..."
            value={description}
          />
        </Field>

        <Field label="Expiry Date">
          <Input
            type="date"
            value={expiryDate}
            onChange={(event) => setExpiryDate(event.target.value)}
          />
        </Field>

        <Field label="Status">
          <Select
            value={isPublished ? 'published' : 'draft'}
            onChange={(event) => setIsPublished(event.target.value === 'published')}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </Field>
      </div>

      {error ? <p className="ui-field-error">{error}</p> : null}

      <div className="form-actions">
        {notice ? (
          <Button onClick={onCancelEdit} type="button" variant="ghost">
            Cancel edit
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : notice ? 'Update Notice' : 'Create Notice'}
        </Button>
      </div>
    </form>
  );
}
