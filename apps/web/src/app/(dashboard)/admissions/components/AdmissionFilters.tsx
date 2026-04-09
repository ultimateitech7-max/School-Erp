'use client';

import type { AdmissionApplicationStatus } from '@/utils/api';

interface AdmissionFiltersProps {
  search: string;
  status: AdmissionApplicationStatus | '';
  loading?: boolean;
  hasActiveFilters?: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: AdmissionApplicationStatus | '') => void;
  onReset: () => void;
}

export function AdmissionFilters({
  search,
  status,
  loading = false,
  hasActiveFilters = false,
  onSearchChange,
  onStatusChange,
  onReset,
}: AdmissionFiltersProps) {
  return (
    <section className="card panel students-toolbar">
      <div>
        <h2>Admission Filters</h2>
        <p className="muted-text">
          Search by student name or phone number and refine by workflow status.
        </p>
      </div>

      <div className="students-toolbar-actions">
        <input
          className="search-input"
          disabled={loading}
          placeholder="Search by name or phone"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          disabled={loading}
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as AdmissionApplicationStatus | '')
          }
        >
          <option value="">All statuses</option>
          <option value="INQUIRY">Inquiry</option>
          <option value="APPLIED">Applied</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="ENROLLED">Enrolled</option>
          <option value="REJECTED">Rejected</option>
        </select>

        {hasActiveFilters ? (
          <button className="secondary-button" onClick={onReset} type="button">
            Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}
