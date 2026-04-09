'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import type {
  ParentLinkedStudentRecord,
  ParentRecord,
  ParentRelationType,
  StudentRecord,
} from '@/utils/api';

const relationOptions: ParentRelationType[] = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'BROTHER',
  'SISTER',
  'RELATIVE',
  'OTHER',
];

interface ParentDetailProps {
  parent: ParentRecord | null;
  students: StudentRecord[];
  loading: boolean;
  linking: boolean;
  onEdit: (parent: ParentRecord) => void;
  onRefresh: (parentId: string) => void;
  onLinkStudent: (
    parentId: string,
    payload: { studentId: string; relationType?: ParentRelationType },
  ) => Promise<void>;
}

function LinkedChildCard({ child }: { child: ParentLinkedStudentRecord }) {
  return (
    <article className="subtle-card linked-child-card">
      <div>
        <strong>{child.name}</strong>
        <p className="muted-text">
          {child.registrationNumber ?? 'Registration pending'}
        </p>
      </div>
      <div className="linked-child-meta">
        <Badge>{child.relationType}</Badge>
        <span className="muted-text">
          {child.class?.name ?? 'Unassigned class'}
          {child.section?.name ? ` • ${child.section.name}` : ''}
        </span>
      </div>
    </article>
  );
}

export function ParentDetail({
  parent,
  students,
  loading,
  linking,
  onEdit,
  onRefresh,
  onLinkStudent,
}: ParentDetailProps) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedRelation, setSelectedRelation] =
    useState<ParentRelationType>('FATHER');

  const availableStudents = useMemo(() => {
    if (!parent) {
      return students;
    }

    const linkedIds = new Set(parent.linkedStudents.map((student) => student.id));
    return students.filter((student) => !linkedIds.has(student.id));
  }, [parent, students]);

  const handleLink = async () => {
    if (!parent || !selectedStudentId) {
      return;
    }

    await onLinkStudent(parent.id, {
      studentId: selectedStudentId,
      relationType: selectedRelation,
    });

    setSelectedStudentId('');
  };

  if (loading) {
    return (
      <section className="card panel">
        <strong>Loading parent details...</strong>
      </section>
    );
  }

  if (!parent) {
    return (
      <EmptyState
        description="Select a parent from the directory to review profile details and linked children."
        title="Choose a parent"
      />
    );
  }

  return (
    <section className="card panel parent-detail-panel">
      <div className="panel-heading">
        <div>
          <h3>{parent.fullName}</h3>
          <p className="muted-text">
            {parent.phone}
            {parent.email ? ` • ${parent.email}` : ''}
          </p>
        </div>
        <div className="table-action-row">
          <Button onClick={() => onRefresh(parent.id)} size="sm" variant="secondary">
            Refresh
          </Button>
          <Button onClick={() => onEdit(parent)} size="sm" variant="ghost">
            Edit
          </Button>
        </div>
      </div>

      <div className="detail-grid">
        <article className="subtle-card">
          <span className="eyebrow">Profile</span>
          <dl className="detail-list">
            <div>
              <dt>Relation</dt>
              <dd>{parent.relationType}</dd>
            </div>
            <div>
              <dt>Emergency Contact</dt>
              <dd>{parent.emergencyContact ?? '-'}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{parent.address ?? '-'}</dd>
            </div>
            <div>
              <dt>Portal Access</dt>
              <dd>
                <Badge tone={parent.portalAccess ? 'success' : 'neutral'}>
                  {parent.portalAccess ? 'Enabled' : 'Not enabled'}
                </Badge>
              </dd>
            </div>
          </dl>
        </article>

        <article className="subtle-card">
          <span className="eyebrow">Link Student</span>
          <div className="form-grid">
            <Field label="Student">
              <Select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
              >
                <option value="">Select student</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.registrationNumber ? `• ${student.registrationNumber}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Relation Type">
              <Select
                value={selectedRelation}
                onChange={(event) =>
                  setSelectedRelation(event.target.value as ParentRelationType)
                }
              >
                {relationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button
            disabled={!selectedStudentId || linking}
            onClick={() => void handleLink()}
            type="button"
          >
            {linking ? 'Linking...' : 'Link Student'}
          </Button>
        </article>
      </div>

      <div className="panel-heading compact-heading">
        <div>
          <h4>Linked Children</h4>
          <p className="muted-text">
            Guardian links available for parent dashboard and future portal flows.
          </p>
        </div>
      </div>

      <div className="linked-children-stack">
        {parent.linkedStudents.length ? (
          parent.linkedStudents.map((child) => (
            <LinkedChildCard child={child} key={child.id} />
          ))
        ) : (
          <EmptyState
            description="Link at least one student to let this parent access child records in the portal."
            title="No students linked yet"
          />
        )}
      </div>
    </section>
  );
}
