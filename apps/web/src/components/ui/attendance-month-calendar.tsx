'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { StudentAttendanceDayRecord } from '@/utils/api';
import { EmptyState } from './empty-state';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface AttendanceMonthCalendarProps {
  records: StudentAttendanceDayRecord[];
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDateKey(date: Date) {
  return `${toMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

function parsePortalDate(value: string) {
  return new Date(value);
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsePortalDate(value));
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function getStatusTone(status: StudentAttendanceDayRecord['status']) {
  if (status === 'PRESENT') {
    return 'success';
  }

  if (status === 'LATE') {
    return 'warning';
  }

  return 'danger';
}

export function AttendanceMonthCalendar({
  records,
  title,
  description,
  emptyTitle,
  emptyDescription,
  className,
}: AttendanceMonthCalendarProps) {
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const record of records) {
      keys.add(toMonthKey(parsePortalDate(record.date)));
    }

    return Array.from(keys).sort((left, right) => right.localeCompare(left));
  }, [records]);

  const [selectedMonth, setSelectedMonth] = useState(monthKeys[0] ?? toMonthKey(new Date()));

  useEffect(() => {
    setSelectedMonth((current) => (monthKeys.includes(current) ? current : monthKeys[0] ?? toMonthKey(new Date())));
  }, [monthKeys]);

  const monthRecords = useMemo(
    () =>
      records
        .filter((record) => toMonthKey(parsePortalDate(record.date)) === selectedMonth)
        .sort(
          (left, right) =>
            new Date(right.date).getTime() - new Date(left.date).getTime(),
        ),
    [records, selectedMonth],
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, StudentAttendanceDayRecord>();

    for (const record of monthRecords) {
      map.set(toDateKey(parsePortalDate(record.date)), record);
    }

    return map;
  }, [monthRecords]);

  const monthDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1);
  }, [selectedMonth]);

  const firstWeekday = monthDate.getDay();
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const selectedMonthIndex = monthKeys.indexOf(selectedMonth);

  if (!records.length) {
    return (
      <section className={cn('attendance-calendar-shell', className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </section>
    );
  }

  return (
    <section className={cn('attendance-calendar-shell', className)}>
      <div className="panel-heading compact-panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="muted-text">{description}</p>
        </div>
        <div className="attendance-calendar-toolbar">
          <Button
            disabled={selectedMonthIndex < 0 || selectedMonthIndex >= monthKeys.length - 1}
            onClick={() => setSelectedMonth(monthKeys[selectedMonthIndex + 1] ?? selectedMonth)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Older
          </Button>
          <Badge tone="info">{formatMonthLabel(selectedMonth)}</Badge>
          <Button
            disabled={selectedMonthIndex <= 0}
            onClick={() => setSelectedMonth(monthKeys[selectedMonthIndex - 1] ?? selectedMonth)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Newer
          </Button>
        </div>
      </div>

      <div className="attendance-calendar-layout">
        <div className="attendance-calendar-panel">
          <div className="attendance-calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="attendance-calendar-days">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span
                aria-hidden="true"
                className="attendance-calendar-day attendance-calendar-day-empty"
                key={`empty-${index}`}
              />
            ))}

            {Array.from({ length: totalDays }).map((_, index) => {
              const dayNumber = index + 1;
              const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
              const key = toDateKey(date);
              const record = dayMap.get(key) ?? null;

              return (
                <div
                  className={cn(
                    'attendance-calendar-day',
                    record ? `attendance-calendar-day-${record.status.toLowerCase()}` : '',
                  )}
                  key={key}
                  title={record ? `${record.status} • ${formatLongDate(record.date)}` : undefined}
                >
                  <span>{dayNumber}</span>
                  {record ? (
                    <small>{record.status === 'PRESENT' ? 'P' : record.status === 'ABSENT' ? 'A' : record.status === 'LATE' ? 'L' : 'LV'}</small>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="attendance-calendar-list">
          <div className="attendance-calendar-list-head">
            <strong>{monthRecords.length} marked day{monthRecords.length === 1 ? '' : 's'}</strong>
            <span className="muted-text">Latest first</span>
          </div>

          <div className="attendance-calendar-list-items">
            {monthRecords.length ? (
              monthRecords.map((record) => (
                <article className="attendance-calendar-item" key={record.id}>
                  <div className="attendance-calendar-item-top">
                    <strong>{formatLongDate(record.date)}</strong>
                    <Badge tone={getStatusTone(record.status)}>{record.status}</Badge>
                  </div>
                  <p className="muted-text">{record.session.name}</p>
                </article>
              ))
            ) : (
              <EmptyState
                title="No marked dates in this month"
                description="Switch month to review other attendance entries."
              />
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
