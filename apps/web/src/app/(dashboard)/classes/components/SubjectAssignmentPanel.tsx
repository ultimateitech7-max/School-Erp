'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  AcademicClassRecord,
  AssignClassSubjectsPayload,
  SubjectRecord,
} from '@/utils/api';

interface SubjectAssignmentPanelProps {
  academicClass: AcademicClassRecord;
  subjects: SubjectRecord[];
  submitting: boolean;
  onSubmit: (payload: AssignClassSubjectsPayload) => Promise<void>;
  onCancel: () => void;
}

export function SubjectAssignmentPanel({
  academicClass,
  subjects,
  submitting,
  onSubmit,
  onCancel,
}: SubjectAssignmentPanelProps) {
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isMandatory, setIsMandatory] = useState(true);
  const [periodsPerWeek, setPeriodsPerWeek] = useState('');

  useEffect(() => {
    setSelectedSubjectIds(academicClass.subjects.map((subject) => subject.id));
    setIsMandatory(
      academicClass.subjects.length > 0
        ? academicClass.subjects.every((subject) => subject.isMandatory)
        : true,
    );
    setPeriodsPerWeek(
      academicClass.subjects[0]?.periodsPerWeek
        ? String(academicClass.subjects[0].periodsPerWeek)
        : '',
    );
  }, [academicClass]);

  const handleToggle = (subjectId: string) => {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((value) => value !== subjectId)
        : [...current, subjectId],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      subjects: selectedSubjectIds.map((subjectId) => ({
        subjectId,
        isMandatory,
        periodsPerWeek: periodsPerWeek ? Number(periodsPerWeek) : undefined,
      })),
    });
  };

  return (
    <section className="card panel assignment-panel">
      <div className="panel-heading">
        <div>
          <h2>Assign Subjects</h2>
          <p className="muted-text">
            Update subject mapping for {academicClass.className}.
          </p>
        </div>

        <button className="secondary-button" onClick={onCancel} type="button">
          Close
        </button>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <div className="checkbox-grid">
          {subjects.length > 0 ? (
            subjects.map((subject) => (
              <label className="checkbox-card" key={subject.id}>
                <input
                  checked={selectedSubjectIds.includes(subject.id)}
                  type="checkbox"
                  onChange={() => handleToggle(subject.id)}
                />
                <span>
                  <strong>{subject.name}</strong>
                  <small>{subject.subjectCode}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="muted-text">Create subjects first to map them to classes.</p>
          )}
        </div>

        <label>
          <span>Mandatory for selected subjects</span>
          <select
            value={isMandatory ? 'true' : 'false'}
            onChange={(event) => setIsMandatory(event.target.value === 'true')}
          >
            <option value="true">Mandatory</option>
            <option value="false">Optional</option>
          </select>
        </label>

        <label>
          <span>Periods per Week</span>
          <input
            min="0"
            placeholder="Leave blank if not set"
            type="number"
            value={periodsPerWeek}
            onChange={(event) => setPeriodsPerWeek(event.target.value)}
          />
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting ? 'Saving...' : 'Save Subject Assignment'}
        </button>
      </form>
    </section>
  );
}
