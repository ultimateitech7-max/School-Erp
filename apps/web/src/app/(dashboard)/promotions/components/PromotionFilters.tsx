'use client';

import type { PromotionOptionsPayload } from '@/utils/api';

interface PromotionFiltersProps {
  options: PromotionOptionsPayload;
  search: string;
  fromAcademicSessionId: string;
  fromClassId: string;
  fromSectionId: string;
  loading?: boolean;
  onSearchChange: (value: string) => void;
  onFromAcademicSessionChange: (value: string) => void;
  onFromClassChange: (value: string) => void;
  onFromSectionChange: (value: string) => void;
  onReset: () => void;
}

export function PromotionFilters({
  options,
  search,
  fromAcademicSessionId,
  fromClassId,
  fromSectionId,
  loading = false,
  onSearchChange,
  onFromAcademicSessionChange,
  onFromClassChange,
  onFromSectionChange,
  onReset,
}: PromotionFiltersProps) {
  const selectedClass =
    options.classes.find((item) => item.id === fromClassId) ?? null;

  return (
    <section className="card panel students-toolbar">
      <div>
        <h2>Promotion Workflow</h2>
        <p className="muted-text">
          Filter a source session, class, and section to prepare eligible students
          for promotion or detention.
        </p>
      </div>

      <div className="students-toolbar-actions">
        <input
          className="search-input"
          disabled={loading}
          placeholder="Search by student name, code, or admission no"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          disabled={loading}
          value={fromAcademicSessionId}
          onChange={(event) => onFromAcademicSessionChange(event.target.value)}
        >
          <option value="">Source Session</option>
          {options.academicSessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>

        <select
          disabled={loading}
          value={fromClassId}
          onChange={(event) => onFromClassChange(event.target.value)}
        >
          <option value="">Source Class</option>
          {options.classes.map((academicClass) => (
            <option key={academicClass.id} value={academicClass.id}>
              {academicClass.name}
            </option>
          ))}
        </select>

        <select
          disabled={loading || !selectedClass}
          value={fromSectionId}
          onChange={(event) => onFromSectionChange(event.target.value)}
        >
          <option value="">All Sections</option>
          {selectedClass?.sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <button className="secondary-button" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </section>
  );
}
