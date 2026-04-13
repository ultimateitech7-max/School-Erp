'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type {
  ParentFormPayload,
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

interface ParentFormProps {
  initialValue?: ParentRecord | null;
  students: StudentRecord[];
  submitting: boolean;
  onSubmit: (payload: ParentFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface ParentFormState {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  relationType: ParentRelationType;
  emergencyContact: string;
  portalPassword: string;
}

interface StudentLinkDraft {
  studentId: string;
  relationType: ParentRelationType;
}

const emptyState: ParentFormState = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  relationType: 'FATHER',
  emergencyContact: '',
  portalPassword: '',
};

export function ParentForm({
  initialValue,
  students,
  submitting,
  onSubmit,
  onCancel,
}: ParentFormProps) {
  const [form, setForm] = useState<ParentFormState>(emptyState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedRelation, setSelectedRelation] =
    useState<ParentRelationType>('FATHER');
  const [linkedStudents, setLinkedStudents] = useState<StudentLinkDraft[]>([]);

  useEffect(() => {
    if (!initialValue) {
      setForm(emptyState);
      setLinkedStudents([]);
      setErrors({});
      return;
    }

    setForm({
      fullName: initialValue.fullName,
      phone: initialValue.phone,
      email: initialValue.email ?? '',
      address: initialValue.address ?? '',
      relationType: initialValue.relationType,
      emergencyContact: initialValue.emergencyContact ?? '',
      portalPassword: '',
    });
    setLinkedStudents(
      initialValue.linkedStudents.map((student) => ({
        studentId: student.id,
        relationType: student.relationType,
      })),
    );
    setErrors({});
  }, [initialValue]);

  const classOptions = useMemo(() => {
    const seen = new Map<string, string>();

    for (const student of students) {
      if (student.class?.id) {
        seen.set(student.class.id, student.class.name);
      }
    }

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  const sectionOptions = useMemo(() => {
    const seen = new Map<string, string>();

    for (const student of students) {
      if (
        student.class?.id === classFilter &&
        student.section?.id &&
        student.section.name
      ) {
        seen.set(student.section.id, student.section.name);
      }
    }

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [classFilter, students]);

  const availableStudents = useMemo(() => {
    const linkedIds = new Set(linkedStudents.map((item) => item.studentId));
    const search = studentSearch.trim().toLowerCase();

    return students.filter((student) => {
      if (linkedIds.has(student.id)) {
        return false;
      }

      if (classFilter && student.class?.id !== classFilter) {
        return false;
      }

      if (sectionFilter && student.section?.id !== sectionFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        student.name,
        student.registrationNumber ?? '',
        student.studentCode,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [classFilter, linkedStudents, sectionFilter, studentSearch, students]);

  const setField = <K extends keyof ParentFormState>(
    key: K,
    value: ParentFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = 'Parent name is required.';
    }

    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone number is required.';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (form.portalPassword && form.portalPassword.length < 8) {
      nextErrors.portalPassword = 'Portal password must be at least 8 characters.';
    }

    if (form.portalPassword && !form.email.trim()) {
      nextErrors.portalPassword = 'Email is required when enabling portal access.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAddStudent = () => {
    if (!selectedStudentId) {
      return;
    }

    setLinkedStudents((current) => [
      ...current,
      {
        studentId: selectedStudentId,
        relationType: selectedRelation,
      },
    ]);
    setSelectedStudentId('');
    setStudentSearch('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSubmit({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      relationType: form.relationType,
      emergencyContact: form.emergencyContact.trim() || undefined,
      portalPassword: form.portalPassword.trim() || undefined,
      studentLinks: initialValue
        ? undefined
        : linkedStudents.map((student) => ({
            studentId: student.studentId,
            relationType: student.relationType,
          })),
    });

    if (!initialValue) {
      setForm(emptyState);
      setLinkedStudents([]);
      setErrors({});
    }
  };

  return (
    <form className="parent-form" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <h3>{initialValue ? 'Edit Parent Profile' : 'Create Parent Profile'}</h3>
          <p className="muted-text">
            Maintain guardian records and optionally enable parent portal access.
          </p>
        </div>
      </div>

      <div className="form-grid two-column-grid">
        <Field error={errors.fullName} label="Full Name">
          <Input
            placeholder="e.g. Anita Sharma"
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
          />
        </Field>

        <Field error={errors.phone} label="Phone">
          <Input
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />
        </Field>

        <Field error={errors.email} hint="Required only for portal login." label="Email">
          <Input
            placeholder="parent@school.com"
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
          />
        </Field>

        <Field label="Relation Type">
          <Select
            value={form.relationType}
            onChange={(event) =>
              setField('relationType', event.target.value as ParentRelationType)
            }
          >
            {relationOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Emergency Contact">
          <Input
            placeholder="Optional alternate number"
            value={form.emergencyContact}
            onChange={(event) => setField('emergencyContact', event.target.value)}
          />
        </Field>

        <Field
          error={errors.portalPassword}
          hint={initialValue ? 'Leave blank to keep current password.' : 'Optional portal access password.'}
          label="Portal Password"
        >
          <Input
            placeholder="Create parent portal password"
            type="password"
            value={form.portalPassword}
            onChange={(event) => setField('portalPassword', event.target.value)}
          />
        </Field>
      </div>

      <Field className="full-width-field" label="Address">
        <Textarea
          placeholder="Home address"
          rows={4}
          value={form.address}
          onChange={(event) => setField('address', event.target.value)}
        />
      </Field>

      {!initialValue ? (
        <section className="subtle-card parent-link-builder">
          <div className="panel-heading compact-heading">
            <div>
              <h4>Link Children While Creating</h4>
              <p className="muted-text">
                Search by school ID or name, or use class, section, and student selection.
              </p>
            </div>
          </div>

          <div className="form-grid compact-form-grid compact-form-grid-4">
            <Field className="compact-field-span-2" label="Search Student">
              <Input
                placeholder="Search by student name or school ID"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
              />
            </Field>

            <Field label="Class">
              <Select
                value={classFilter}
                onChange={(event) => {
                  setClassFilter(event.target.value);
                  setSectionFilter('');
                  setSelectedStudentId('');
                }}
              >
                <option value="">All classes</option>
                {classOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Section">
              <Select
                value={sectionFilter}
                onChange={(event) => {
                  setSectionFilter(event.target.value);
                  setSelectedStudentId('');
                }}
              >
                <option value="">All sections</option>
                {sectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field className="compact-field-span-2" label="Student">
              <Select
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
              >
                <option value="">Select student</option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.registrationNumber ?? student.studentCode})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Relation for Link">
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

            <div className="compact-inline-submit">
              <Button
                disabled={!selectedStudentId}
                onClick={handleAddStudent}
                type="button"
                variant="secondary"
              >
                Add More Student
              </Button>
            </div>
          </div>

          <div className="chip-list">
            {linkedStudents.length ? (
              linkedStudents.map((item) => {
                const student = students.find((entry) => entry.id === item.studentId);

                return (
                  <Badge className="parent-link-chip" key={item.studentId} tone="info">
                    {student?.name ?? 'Student'} • {item.relationType}
                    <button
                      className="parent-link-chip-remove"
                      onClick={() =>
                        setLinkedStudents((current) =>
                          current.filter((entry) => entry.studentId !== item.studentId),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </Badge>
                );
              })
            ) : (
              <span className="muted-text">No students added yet.</span>
            )}
          </div>
        </section>
      ) : null}

      <div className="form-actions">
        {initialValue && onCancel ? (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        ) : null}
        <Button disabled={submitting} type="submit">
          {submitting ? 'Saving...' : initialValue ? 'Update Parent' : 'Create Parent'}
        </Button>
      </div>
    </form>
  );
}
