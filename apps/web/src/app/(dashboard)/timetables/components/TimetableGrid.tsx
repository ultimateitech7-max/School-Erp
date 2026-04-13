'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type {
  TimetableDayOfWeek,
  TimetableEntryRecord,
} from '@/utils/api';

const weekdays: TimetableDayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

interface TimetableGridProps {
  entries: TimetableEntryRecord[];
  loading: boolean;
  showActions?: boolean;
  selectedEntryId?: string | null;
  deletingEntryId?: string | null;
  onSelect?: (entry: TimetableEntryRecord) => void;
  onDelete?: (entry: TimetableEntryRecord) => void;
}

export function TimetableGrid({
  entries,
  loading,
  showActions = true,
  selectedEntryId,
  deletingEntryId,
  onSelect,
  onDelete,
}: TimetableGridProps) {
  if (loading) {
    return (
      <section className="card panel">
        <div className="empty-state ui-empty-state">
          <strong>Loading timetable...</strong>
          <p className="muted-text">
            Building the weekly class and teacher grid.
          </p>
        </div>
      </section>
    );
  }

  if (!entries.length) {
    return (
      <EmptyState
        title="No timetable entries found"
        description="Select a class or create the first entry to see the weekly grid."
      />
    );
  }

  const periods = Array.from(
    new Set(entries.map((entry) => entry.periodNumber)),
  ).sort((left, right) => left - right);

  const getCellEntry = (day: TimetableDayOfWeek, period: number) =>
    entries.find(
      (entry) => entry.dayOfWeek === day && entry.periodNumber === period,
    );

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly Grid</h2>
          <p className="muted-text">
            View subjects and teachers arranged by day and period.
          </p>
        </div>
      </div>

      <div className="timetable-grid-wrap">
        <div className="timetable-grid">
          <div className="timetable-grid-head">Period</div>
          {weekdays.map((day) => (
            <div className="timetable-grid-head" key={day}>
              {day.charAt(0) + day.slice(1).toLowerCase()}
            </div>
          ))}

          {periods.map((period) => (
            <FragmentRow
              dayEntries={weekdays.map((day) => getCellEntry(day, period))}
              deletingEntryId={deletingEntryId}
              key={period}
              onDelete={onDelete}
              onSelect={onSelect}
              period={period}
              selectedEntryId={selectedEntryId}
              showActions={showActions}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FragmentRow({
  period,
  dayEntries,
  selectedEntryId,
  deletingEntryId,
  onSelect,
  onDelete,
  showActions,
}: {
  period: number;
  dayEntries: Array<TimetableEntryRecord | undefined>;
  selectedEntryId?: string | null;
  deletingEntryId?: string | null;
  onSelect?: (entry: TimetableEntryRecord) => void;
  onDelete?: (entry: TimetableEntryRecord) => void;
  showActions: boolean;
}) {
  return (
    <>
      <div className="timetable-grid-period">Period {period}</div>
      {dayEntries.map((entry, index) => (
        <div
          className={`timetable-grid-cell${entry?.id === selectedEntryId ? ' timetable-grid-cell-active' : ''}${entry ? ' timetable-grid-cell-filled' : ''}`}
          key={`${period}-${index}`}
          title={
            entry
              ? `${entry.subject.name} with ${entry.teacher.name} (${entry.startTime}-${entry.endTime})`
              : 'Free period'
          }
        >
          {entry ? (
            <>
              <button
                className="timetable-grid-card"
                onClick={() => onSelect?.(entry)}
                type="button"
              >
                <strong>{entry.subject.name}</strong>
                <span>{entry.teacher.name}</span>
                <small>
                  {entry.startTime} - {entry.endTime}
                </small>
                <small>
                  {entry.section?.name ?? entry.class.name}
                </small>
              </button>
              {showActions ? (
                <div className="timetable-grid-actions">
                  <Button
                    onClick={() => onSelect?.(entry)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={deletingEntryId === entry.id}
                    onClick={() => onDelete?.(entry)}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    {deletingEntryId === entry.id ? 'Removing...' : 'Delete'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <span className="muted-text">Free</span>
          )}
        </div>
      ))}
    </>
  );
}
