'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type HolidayFormPayload,
  type HolidayRecord,
  type HolidayType,
} from '@/utils/api';

export default function HolidaysPage() {
  const [items, setItems] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<HolidayType>('HOLIDAY');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadHolidays = async () => {
    setLoading(true);

    try {
      const response = await apiFetch<ApiSuccessResponse<HolidayRecord[]>>('/holidays');
      setItems(response.data);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load holidays.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!title.trim() || !startDate || !endDate) {
      setMessage({
        type: 'error',
        text: 'Title, start date, and end date are required.',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload: HolidayFormPayload = {
        title: title.trim(),
        startDate,
        endDate,
        type,
      };

      const response = await apiFetch<ApiSuccessResponse<HolidayRecord>>('/holidays', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage({ type: 'success', text: response.message });
      setTitle('');
      setStartDate('');
      setEndDate('');
      setType('HOLIDAY');
      await loadHolidays();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create holiday.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <div className="academic-grid">
        <form className="card panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <h2>Create Holiday</h2>
              <p className="muted-text">
                Add holidays or calendar events for dashboards and portals.
              </p>
            </div>
          </div>

          <div className="form-grid">
            <Field label="Title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Annual Sports Day"
              />
            </Field>

            <Field label="Type">
              <Select value={type} onChange={(event) => setType(event.target.value as HolidayType)}>
                <option value="HOLIDAY">Holiday</option>
                <option value="EVENT">Event</option>
              </Select>
            </Field>

            <Field label="Start Date">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>

            <Field label="End Date">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>

          <div className="form-actions">
            <span />
            <Button disabled={submitting} type="submit">
              {submitting ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </form>

        <section className="card panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming Calendar</h2>
              <p className="muted-text">Upcoming holidays and school events.</p>
            </div>
          </div>

          {loading ? (
            <Spinner label="Loading holidays..." />
          ) : !items.length ? (
            <EmptyState
              title="No calendar items"
              description="Create a holiday or event to start your academic calendar."
            />
          ) : (
            <div className="history-summary-list">
              {items.map((item) => (
                <article className="subtle-card" key={item.id}>
                  <div className="portal-notice-head">
                    <strong>{item.title}</strong>
                    <Badge tone={item.type === 'HOLIDAY' ? 'success' : 'info'}>
                      {item.type}
                    </Badge>
                  </div>
                  <p className="muted-text">
                    {new Date(item.startDate).toLocaleDateString('en-IN')} to{' '}
                    {new Date(item.endDate).toLocaleDateString('en-IN')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
