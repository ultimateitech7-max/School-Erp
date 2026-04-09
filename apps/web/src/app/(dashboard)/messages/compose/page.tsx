'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  apiFetch,
  type ApiSuccessResponse,
  type MessageFormPayload,
  type MessageRecipientRecord,
} from '@/utils/api';

export default function ComposeMessagePage() {
  const [recipients, setRecipients] = useState<MessageRecipientRecord[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<MessageRecipientRecord[]>>(
      `/messages/recipients${roleFilter ? `?role=${roleFilter}` : ''}`,
    )
      .then((response) => {
        setRecipients(response.data);
        if (!response.data.some((recipient) => recipient.id === receiverId)) {
          setReceiverId('');
        }
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load recipients.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [roleFilter, receiverId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!receiverId || !body.trim()) {
      setMessage({
        type: 'error',
        text: 'Receiver and message body are required.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload: MessageFormPayload = {
        receiverId,
        subject: subject.trim() || undefined,
        message: body.trim(),
      };

      const response = await apiFetch<ApiSuccessResponse<unknown>>('/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setReceiverId('');
      setSubject('');
      setBody('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send message.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <form className="card panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <h2>Compose Message</h2>
            <p className="muted-text">
              Send direct messages to users in your school workspace.
            </p>
          </div>
        </div>

        <div className="form-grid">
          <Field label="Recipient Role">
            <Select
              disabled={loading}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="">All allowed roles</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
              <option value="PARENT">Parent</option>
              <option value="STAFF">Staff</option>
              <option value="SCHOOL_ADMIN">School Admin</option>
            </Select>
          </Field>

          <Field label="Recipient">
            <Select
              disabled={loading}
              value={receiverId}
              onChange={(event) => setReceiverId(event.target.value)}
            >
              <option value="">{loading ? 'Loading recipients...' : 'Select user'}</option>
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.name} ({recipient.roleType.replace('_', ' ')} • {recipient.userType})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subject">
            <Input
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Optional subject"
              value={subject}
            />
          </Field>

          <Field className="form-grid-span-full" label="Message">
            <textarea
              className="ui-input ui-textarea"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your message here..."
              value={body}
            />
          </Field>
        </div>

        <div className="form-actions">
          <span />
          <Button disabled={submitting || loading} type="submit">
            {submitting ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </form>
    </div>
  );
}
