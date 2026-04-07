'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  UserFormPayload,
  UserOptionsPayload,
  UserRecord,
  UserRole,
  UserStatus,
} from '@/utils/api';

interface UserFormProps {
  mode: 'create' | 'edit';
  options: UserOptionsPayload;
  canManageAcrossSchools: boolean;
  initialUser?: UserRecord | null;
  submitting: boolean;
  onSubmit: (payload: UserFormPayload) => Promise<void>;
  onCancel?: () => void;
}

interface UserFormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  designation: string;
  schoolId: string;
  status: UserStatus;
}

const initialFormState: UserFormState = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'TEACHER',
  designation: '',
  schoolId: '',
  status: 'ACTIVE',
};

export function UserForm({
  mode,
  options,
  canManageAcrossSchools,
  initialUser,
  submitting,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [form, setForm] = useState<UserFormState>(initialFormState);

  useEffect(() => {
    if (!initialUser) {
      setForm({
        ...initialFormState,
        role: options.roles[0]?.code ?? 'TEACHER',
        schoolId: options.currentSchoolId ?? '',
      });
      return;
    }

    setForm({
      fullName: initialUser.name,
      email: initialUser.email,
      phone: initialUser.phone ?? '',
      password: '',
      role: initialUser.role,
      designation: initialUser.designation ?? '',
      schoolId: initialUser.schoolId ?? options.currentSchoolId ?? '',
      status: initialUser.status,
    });
  }, [initialUser, options.currentSchoolId, options.roles]);

  const selectedRole = useMemo(
    () => options.roles.find((role) => role.code === form.role) ?? null,
    [form.role, options.roles],
  );
  const derivedUserType = selectedRole?.userType ?? 'STAFF';
  const requiresSchool = form.role !== 'SUPER_ADMIN';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      password: form.password.trim() || undefined,
      role: form.role,
      userType: derivedUserType,
      designation: form.designation.trim() || undefined,
      isActive: form.status === 'ACTIVE',
      schoolId:
        canManageAcrossSchools && requiresSchool
          ? form.schoolId || undefined
          : options.currentSchoolId ?? undefined,
    });
  };

  return (
    <section className="card panel user-form-panel">
      <div className="panel-heading">
        <div>
          <h2>{mode === 'edit' ? 'Edit User' : 'Add User'}</h2>
          <p className="muted-text">
            Create teachers, staff, and school admins with role-based access.
          </p>
        </div>

        {mode === 'edit' && onCancel ? (
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>

      <form className="simple-form" onSubmit={handleSubmit}>
        <label>
          <span>Full Name</span>
          <input
            required
            type="text"
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                fullName: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Email</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Phone</span>
          <input
            type="text"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Password</span>
          <input
            minLength={mode === 'create' ? 8 : undefined}
            required={mode === 'create'}
            placeholder={mode === 'edit' ? 'Leave blank to keep unchanged' : ''}
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
        </label>

        <label>
          <span>Role</span>
          <select
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                role: event.target.value as UserRole,
                schoolId:
                  event.target.value === 'SUPER_ADMIN'
                    ? ''
                    : current.schoolId || options.currentSchoolId || '',
              }))
            }
          >
            {options.roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>User Type</span>
          <input readOnly type="text" value={derivedUserType} />
        </label>

        <label>
          <span>Designation</span>
          <input
            type="text"
            value={form.designation}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                designation: event.target.value,
              }))
            }
          />
        </label>

        {canManageAcrossSchools ? (
          <label>
            <span>School</span>
            <select
              disabled={!requiresSchool}
              required={requiresSchool}
              value={form.schoolId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  schoolId: event.target.value,
                }))
              }
            >
              <option value="">
                {requiresSchool ? 'Select school' : 'Platform scoped'}
              </option>
              {options.schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as UserStatus,
              }))
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        <button className="primary-button" disabled={submitting} type="submit">
          {submitting
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save Changes'
              : 'Create User'}
        </button>
      </form>
    </section>
  );
}
