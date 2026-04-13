'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/field';
import type {
  AssignFeePayload,
  FeeStructureRecord,
  FeesOptionsPayload,
} from '@/utils/api';

interface AssignFeeFormProps {
  options: FeesOptionsPayload;
  feeStructures: FeeStructureRecord[];
  submitting: boolean;
  onSubmit: (payload: AssignFeePayload) => Promise<void>;
}

interface AssignFeeFormState {
  classId: string;
  sectionId: string;
  studentId: string;
  studentSearch: string;
  feeStructureId: string;
  totalAmount: string;
  concessionAmount: string;
  dueDate: string;
}

const initialFormState: AssignFeeFormState = {
  classId: '',
  sectionId: '',
  studentId: '',
  studentSearch: '',
  feeStructureId: '',
  totalAmount: '',
  concessionAmount: '0',
  dueDate: '',
};

function buildStudentLabel(student: FeesOptionsPayload['students'][number]) {
  const identity =
    student.registrationNumber ?? student.admissionNo ?? student.studentCode;
  return `${student.name} • ${identity}`;
}

export function AssignFeeForm({
  options,
  feeStructures,
  submitting,
  onSubmit,
}: AssignFeeFormProps) {
  const [form, setForm] = useState<AssignFeeFormState>(initialFormState);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      feeStructureId: current.feeStructureId || feeStructures[0]?.id || '',
    }));
  }, [feeStructures]);

  const sectionOptions = useMemo(
    () =>
      options.classes.find((item) => item.id === form.classId)?.sections ?? [],
    [form.classId, options.classes],
  );

  const filteredStudents = useMemo(() => {
    const search = form.studentSearch.trim().toLowerCase();

    return options.students.filter((student) => {
      if (form.classId && student.classId !== form.classId) {
        return false;
      }

      if (form.sectionId && student.sectionId !== form.sectionId) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        student.name,
        student.studentCode,
        student.registrationNumber ?? '',
        student.admissionNo ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [form.classId, form.sectionId, form.studentSearch, options.students]);

  const selectedStructure = useMemo(
    () => feeStructures.find((item) => item.id === form.feeStructureId) ?? null,
    [feeStructures, form.feeStructureId],
  );

  useEffect(() => {
    if (!selectedStructure) {
      return;
    }

    setForm((current) => ({
      ...current,
      totalAmount: current.totalAmount || String(selectedStructure.amount),
      dueDate: current.dueDate || (selectedStructure.dueDate?.slice(0, 10) ?? ''),
    }));
  }, [selectedStructure]);

  useEffect(() => {
    if (form.sectionId && !sectionOptions.some((item) => item.id === form.sectionId)) {
      setForm((current) => ({
        ...current,
        sectionId: '',
        studentId: '',
      }));
    }
  }, [form.sectionId, sectionOptions]);

  const targetHint = form.studentId
    ? 'Assigning to one student'
    : form.sectionId
      ? 'Assigning to the selected section'
      : form.classId
        ? 'Assigning to the full selected class'
        : 'Select a class, section, or one student';

  const handleStudentPick = (studentId: string) => {
    const student = options.students.find((item) => item.id === studentId) ?? null;

    setForm((current) => ({
      ...current,
      studentId,
      classId: student?.classId ?? current.classId,
      sectionId: student?.sectionId ?? current.sectionId,
      studentSearch: student ? buildStudentLabel(student) : current.studentSearch,
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      studentId: form.studentId || undefined,
      classId: form.studentId ? undefined : form.classId || undefined,
      sectionId: form.studentId ? undefined : form.sectionId || undefined,
      feeStructureId: form.feeStructureId,
      sessionId: options.currentSessionId,
      totalAmount: form.totalAmount ? Number(form.totalAmount) : undefined,
      concessionAmount: form.concessionAmount
        ? Number(form.concessionAmount)
        : undefined,
      dueDate: form.dueDate || undefined,
    });

    setForm({
      ...initialFormState,
      feeStructureId: feeStructures[0]?.id || '',
    });
    setShowSuggestions(false);
  };

  return (
    <section className="card panel academic-form-panel">
      <div className="panel-heading">
        <div>
          <h2>Assign Fee</h2>
          <p className="muted-text">
            Assign to one student, one section, or a full class from the same form.
          </p>
        </div>
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <div className="chip-list">
          <Badge tone="info">{targetHint}</Badge>
          {form.classId ? (
            <Badge tone="neutral">
              {options.classes.find((item) => item.id === form.classId)?.name ?? 'Class'}
            </Badge>
          ) : null}
          {form.sectionId ? (
            <Badge tone="neutral">
              {sectionOptions.find((item) => item.id === form.sectionId)?.name ?? 'Section'}
            </Badge>
          ) : null}
        </div>

        <Field label="Direct Student Search">
          <div className="fee-student-search">
            <Input
              placeholder="Search by student name, school ID, registration, or admission no."
              value={form.studentSearch}
              onBlur={() => {
                window.setTimeout(() => setShowSuggestions(false), 120);
              }}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  studentSearch: event.target.value,
                  studentId: '',
                }))
              }
              onFocus={() => setShowSuggestions(true)}
            />

            {showSuggestions && form.studentSearch.trim() ? (
              <div className="fee-student-suggestion-list">
                {filteredStudents.length ? (
                  filteredStudents.slice(0, 8).map((student) => (
                    <button
                      className="fee-student-suggestion"
                      key={student.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleStudentPick(student.id)}
                      type="button"
                    >
                      <strong>{student.name}</strong>
                      <span>
                        {student.studentCode}
                        {student.admissionNo ? ` · ${student.admissionNo}` : ''}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="fee-student-suggestion-empty">No matching student found.</div>
                )}
              </div>
            ) : null}
          </div>
        </Field>

        <div className="form-grid compact-form-grid compact-form-grid-4">
          <Field label="Class">
            <Select
              value={form.classId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  classId: event.target.value,
                  sectionId: '',
                  studentId: '',
                }))
              }
            >
              <option value="">Select class</option>
              {options.classes.map((academicClass) => (
                <option key={academicClass.id} value={academicClass.id}>
                  {academicClass.name} ({academicClass.classCode})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Section">
            <Select
              value={form.sectionId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sectionId: event.target.value,
                  studentId: '',
                }))
              }
            >
              <option value="">Full class</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="compact-field-span-2" label="Student">
            <Select
              value={form.studentId}
              onChange={(event) => handleStudentPick(event.target.value)}
            >
              <option value="">Keep class / section scope</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.studentCode})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Fee Structure">
          <Select
            required
            value={form.feeStructureId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                feeStructureId: event.target.value,
                totalAmount: '',
                dueDate: '',
              }))
            }
          >
            <option value="">Select structure</option>
            {feeStructures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name} ({structure.feeCode})
              </option>
            ))}
          </Select>
        </Field>

        <div className="form-grid compact-form-grid compact-form-grid-4">
          <Field label="Total Amount">
            <Input
              min="0"
              step="0.01"
              type="number"
              value={form.totalAmount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  totalAmount: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Concession">
            <Input
              min="0"
              step="0.01"
              type="number"
              value={form.concessionAmount}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  concessionAmount: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Due Date">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
          </Field>
        </div>

        <div className="form-actions">
          <Button disabled={submitting || (!form.studentId && !form.classId)} type="submit">
            {submitting ? 'Assigning...' : 'Assign Fee'}
          </Button>
        </div>
      </form>
    </section>
  );
}
