'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/utils/cn';
import type { HolidayRecord } from '@/utils/api';
import { Badge } from './badge';
import { Button } from './button';
import { EmptyState } from './empty-state';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface HolidayYearCalendarProps {
  items: HolidayRecord[];
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
  showHeading?: boolean;
}

function parseDate(value: string) {
  if (value.includes('T')) {
    return new Date(value);
  }

  return new Date(`${value}T00:00:00`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parseDate(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(parseDate(value));
}

function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getCalendarYears(items: HolidayRecord[]) {
  const years = new Set<number>();

  for (const item of items) {
    const startYear = parseDate(item.startDate).getFullYear();
    const endYear = parseDate(item.endDate).getFullYear();

    for (let year = startYear; year <= endYear; year += 1) {
      years.add(year);
    }
  }

  return Array.from(years).sort((left, right) => left - right);
}

function includesYear(item: HolidayRecord, year: number) {
  const startYear = parseDate(item.startDate).getFullYear();
  const endYear = parseDate(item.endDate).getFullYear();

  return year >= startYear && year <= endYear;
}

function includesMonth(item: HolidayRecord, year: number, monthIndex: number) {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const start = parseDate(item.startDate);
  const end = parseDate(item.endDate);

  return !(end < monthStart || start > monthEnd);
}

function buildHolidayDayMap(items: HolidayRecord[], year: number) {
  const dayMap = new Map<string, HolidayRecord[]>();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  for (const item of items) {
    const start = parseDate(item.startDate);
    const end = parseDate(item.endDate);

    if (end < yearStart || start > yearEnd) {
      continue;
    }

    const cursor = new Date(Math.max(start.getTime(), yearStart.getTime()));
    const last = new Date(Math.min(end.getTime(), yearEnd.getTime()));

    while (cursor <= last) {
      const key = toIsoDate(cursor);
      const existing = dayMap.get(key) ?? [];
      existing.push(item);
      dayMap.set(key, existing);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return dayMap;
}

export function HolidayYearCalendar({
  items,
  title,
  description,
  emptyTitle,
  emptyDescription,
  className,
  showHeading = true,
}: HolidayYearCalendarProps) {
  const years = useMemo(() => {
    const availableYears = getCalendarYears(items);
    return availableYears.length ? availableYears : [new Date().getFullYear()];
  }, [items]);

  const currentYear = new Date().getFullYear();
  const defaultYear = years.includes(currentYear)
    ? currentYear
    : years[years.length - 1] ?? currentYear;
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  useEffect(() => {
    setSelectedYear((current) =>
      years.includes(current) ? current : defaultYear,
    );
  }, [defaultYear, years]);

  const dayMap = useMemo(
    () => buildHolidayDayMap(items, selectedYear),
    [items, selectedYear],
  );

  const visibleItems = useMemo(() => {
    return items
      .filter((item) => includesYear(item, selectedYear))
      .sort(
        (left, right) =>
          parseDate(left.startDate).getTime() - parseDate(right.startDate).getTime(),
      );
  }, [items, selectedYear]);

  const listItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = visibleItems.filter((item) => parseDate(item.endDate) >= today);

    return upcoming.length ? upcoming : visibleItems;
  }, [visibleItems]);

  return (
    <div className={cn('holiday-year-shell', className)}>
      {showHeading ? (
        <div className="panel-heading compact-panel-heading">
          <div>
            <h2>{title}</h2>
            <p className="muted-text">{description}</p>
          </div>

          {years.length > 1 ? (
            <div className="holiday-year-controls" role="tablist" aria-label="Calendar year">
              {years.map((year) => (
                <Button
                  aria-selected={year === selectedYear}
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  role="tab"
                  size="sm"
                  type="button"
                  variant={year === selectedYear ? 'primary' : 'ghost'}
                >
                  {year}
                </Button>
              ))}
            </div>
          ) : (
            <Badge tone="info">{selectedYear}</Badge>
          )}
        </div>
      ) : (
        <div className="holiday-year-inline-toolbar">
          {years.length > 1 ? (
            <div className="holiday-year-controls" role="tablist" aria-label="Calendar year">
              {years.map((year) => (
                <Button
                  aria-selected={year === selectedYear}
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  role="tab"
                  size="sm"
                  type="button"
                  variant={year === selectedYear ? 'primary' : 'ghost'}
                >
                  {year}
                </Button>
              ))}
            </div>
          ) : (
            <Badge tone="info">{selectedYear}</Badge>
          )}
        </div>
      )}

      {visibleItems.length ? (
        <div className="holiday-year-layout">
          <div className="holiday-year-grid">
            {monthNames.map((monthName, monthIndex) => {
              const firstWeekday = new Date(selectedYear, monthIndex, 1).getDay();
              const totalDays = new Date(selectedYear, monthIndex + 1, 0).getDate();

              return (
                <article className="holiday-year-month" key={`${selectedYear}-${monthName}`}>
                  <div className="holiday-year-month-header">
                    <h3>{monthName}</h3>
                    <span>
                      {
                        visibleItems.filter((item) =>
                          includesMonth(item, selectedYear, monthIndex),
                        ).length
                      }{' '}
                      items
                    </span>
                  </div>

                  <div className="holiday-year-weekdays" aria-hidden="true">
                    {weekdayLabels.map((label, index) => (
                      <span key={`${monthName}-weekday-${label}-${index}`}>{label}</span>
                    ))}
                  </div>

                  <div className="holiday-year-days">
                    {Array.from({ length: firstWeekday }).map((_, index) => (
                      <span
                        aria-hidden="true"
                        className="holiday-year-day holiday-year-day-empty"
                        key={`${monthName}-empty-${index}`}
                      />
                    ))}

                    {Array.from({ length: totalDays }).map((_, index) => {
                      const dayNumber = index + 1;
                      const date = new Date(selectedYear, monthIndex, dayNumber);
                      const key = toIsoDate(date);
                      const dayItems = dayMap.get(key) ?? [];
                      const hasHoliday = dayItems.some((item) => item.type === 'HOLIDAY');
                      const hasEvent = dayItems.some((item) => item.type === 'EVENT');
                      const isSunday = date.getDay() === 0;
                      const isToday =
                        date.toDateString() === new Date().toDateString();

                      return (
                        <div
                          aria-label={
                            dayItems.length
                              ? `${date.toDateString()}: ${dayItems
                                  .map((item) => item.title)
                                  .join(', ')}`
                              : date.toDateString()
                          }
                          className={cn(
                            'holiday-year-day',
                            dayItems.length ? 'holiday-year-day-marked' : '',
                            isSunday ? 'holiday-year-day-sunday' : '',
                            hasHoliday && hasEvent
                              ? 'holiday-year-day-mixed'
                              : hasEvent
                                ? 'holiday-year-day-event'
                                : '',
                            isToday ? 'holiday-year-day-today' : '',
                          )}
                          key={key}
                          title={
                            dayItems.length
                              ? dayItems.map((item) => item.title).join(', ')
                              : undefined
                          }
                        >
                          <span>{dayNumber}</span>
                          {dayItems.length ? (
                            <>
                              <span className="holiday-year-day-dot" />
                              {dayItems.length > 1 ? (
                                <span className="holiday-year-day-count">{dayItems.length}</span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="holiday-year-list-panel">
            <div className="panel-heading compact-panel-heading compact-heading-no-space">
              <div>
                <h3>{selectedYear} Holiday List</h3>
                <p className="muted-text">Compact date-wise list on the right side.</p>
              </div>
              <Badge tone="neutral">{listItems.length} items</Badge>
            </div>

            <div className="holiday-year-list">
              {listItems.map((item) => (
                <article className="holiday-year-item" key={item.id}>
                  <div className="holiday-year-item-top">
                    <strong>{item.title}</strong>
                    <Badge tone={item.type === 'HOLIDAY' ? 'success' : 'info'}>
                      {item.type}
                    </Badge>
                  </div>
                  <p className="holiday-year-item-range">
                    {formatDate(item.startDate)} to {formatDate(item.endDate)}
                  </p>
                  <div className="holiday-year-item-meta">
                    <span>{formatShortDate(item.startDate)}</span>
                    <span>to</span>
                    <span>{formatShortDate(item.endDate)}</span>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <EmptyState description={emptyDescription} title={emptyTitle} />
      )}
    </div>
  );
}
