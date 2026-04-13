'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type HolidayAudience,
  type HolidayFormPayload,
  type HolidayOptionsPayload,
  type HolidayRecord,
  type HolidayType,
} from '@/utils/api';
import { buildCsvFilename, exportRowsToCsv } from '@/utils/csv';
import { holidayCsvColumns } from '@/utils/csv-exporters';

export default function HolidaysPage() {
  const [items, setItems] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<HolidayType>('HOLIDAY');
  const [audience, setAudience] = useState<HolidayAudience>('ALL');
  const [allClasses, setAllClasses] = useState(true);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [options, setOptions] = useState<HolidayOptionsPayload>({
    audiences: ['ALL', 'STAFF', 'STUDENT'],
    classes: [],
  });
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
    void apiFetch<ApiSuccessResponse<HolidayOptionsPayload>>('/holidays/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch(() => {
        setOptions({
          audiences: ['ALL', 'STAFF', 'STUDENT'],
          classes: [],
        });
      });
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
        audience,
        allClasses,
        classIds: allClasses ? [] : classIds,
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
      setAudience('ALL');
      setAllClasses(true);
      setClassIds([]);
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

  const handleExportCsv = async () => {
    const count = exportRowsToCsv(items, holidayCsvColumns, buildCsvFilename('holidays'));
    setMessage({
      type: 'success',
      text: `Downloaded ${count} calendar item${count === 1 ? '' : 's'} as CSV.`,
    });
  };

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <form className="card panel compact-panel-stack" onSubmit={handleSubmit}>
        <div className="panel-heading compact-panel-heading">
          <div>
            <h2>Create Holiday</h2>
            <p className="muted-text">
              Add holidays or calendar events for dashboards and portals.
            </p>
          </div>
        </div>

        <div className="form-grid compact-form-grid compact-form-grid-4">
          <Field className="compact-field-span-2" label="Title">
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

          <Field label="Audience">
            <Select
              value={audience}
              onChange={(event) => setAudience(event.target.value as HolidayAudience)}
            >
              {options.audiences.map((option) => (
                <option key={option} value={option}>
                  {option === 'ALL' ? 'All' : option === 'STAFF' ? 'Staff' : 'Student'}
                </option>
              ))}
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

          <div className="compact-inline-submit">
            <Button disabled={submitting} type="submit">
              {submitting ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </div>

        <div className="subform-stack">
          <div className="holiday-target-toolbar">
            <label
              className={`holiday-toggle-chip${allClasses ? ' holiday-toggle-chip-active' : ''}`}
            >
              <input
                checked={allClasses}
                type="checkbox"
                onChange={(event) => {
                  setAllClasses(event.target.checked);
                  if (event.target.checked) {
                    setClassIds([]);
                  }
                }}
              />
              <span>All classes</span>
            </label>
            <span className="holiday-selection-hint">
              {allClasses
                ? 'Holiday applies across the full school.'
                : `${classIds.length} class${classIds.length === 1 ? '' : 'es'} selected`}
            </span>
          </div>

          {!allClasses ? (
            <div className="holiday-class-selector">
              {options.classes.map((item) => {
                const checked = classIds.includes(item.id);

                return (
                  <label
                    className={`holiday-class-chip${checked ? ' holiday-class-chip-selected' : ''}`}
                    key={item.id}
                  >
                    <input
                      checked={checked}
                      type="checkbox"
                      onChange={(event) =>
                        setClassIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((classId) => classId !== item.id),
                        )
                      }
                    />
                    <span className="holiday-class-chip-copy">
                      <strong>{item.name}</strong>
                      <small>{item.classCode}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </form>

      <section className="card panel compact-panel-stack">
        <div className="panel-heading compact-panel-heading">
          <div>
            <h2>Holiday List</h2>
            <p className="muted-text">Compact list of holidays and school events.</p>
          </div>
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        </div>

        {loading ? (
          <Spinner label="Loading holidays..." />
        ) : !items.length ? (
          <EmptyState
            title="No calendar items"
            description="Create a holiday or event to start your academic calendar."
          />
        ) : (
          <div className="compact-summary-list holiday-list-stack">
            {items.map((item) => (
              <article className="subtle-card compact-summary-card holiday-list-card" key={item.id}>
                <div className="portal-notice-head">
                  <strong>{item.title}</strong>
                  <div className="chip-list">
                    <Badge tone={item.type === 'HOLIDAY' ? 'success' : 'info'}>
                      {item.type}
                    </Badge>
                    <Badge tone="neutral">{item.audience}</Badge>
                    {!item.allClasses ? (
                      <Badge tone="info">
                        {item.classes.length} class{item.classes.length === 1 ? '' : 'es'}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="muted-text">
                  {new Date(item.startDate).toLocaleDateString('en-IN')} to{' '}
                  {new Date(item.endDate).toLocaleDateString('en-IN')}
                </p>
                {!item.allClasses && item.classes.length ? (
                  <p className="muted-text">
                    Classes: {item.classes.map((entry) => entry.name).join(', ')}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
