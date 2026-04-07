'use client';

import type { UserRole, UserStatus, UserRoleOption } from '@/utils/api';

interface UserFiltersProps {
  searchInput: string;
  roleFilter: UserRole | '';
  statusFilter: UserStatus | '';
  roles: UserRoleOption[];
  onSearchChange: (value: string) => void;
  onRoleChange: (value: UserRole | '') => void;
  onStatusChange: (value: UserStatus | '') => void;
  onReset: () => void;
  showCreateReset: boolean;
}

export function UserFilters({
  searchInput,
  roleFilter,
  statusFilter,
  roles,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onReset,
  showCreateReset,
}: UserFiltersProps) {
  return (
    <section className="card panel users-toolbar">
      <div>
        <h2>Users & Staff</h2>
        <p className="muted-text">
          Manage school admins, teachers, and non-teaching staff.
        </p>
      </div>

      <div className="users-toolbar-actions">
        <input
          className="search-input"
          placeholder="Search by name, email, or phone"
          type="search"
          value={searchInput}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <select
          value={roleFilter}
          onChange={(event) => onRoleChange(event.target.value as UserRole | '')}
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusChange(event.target.value as UserStatus | '')
          }
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        {showCreateReset ? (
          <button className="secondary-button" onClick={onReset} type="button">
            New User
          </button>
        ) : null}
      </div>
    </section>
  );
}
