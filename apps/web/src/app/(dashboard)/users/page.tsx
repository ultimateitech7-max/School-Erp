'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { UserFilters } from './components/UserFilters';
import { UserForm } from './components/UserForm';
import { UserTable } from './components/UserTable';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type UserFormPayload,
  type UserOptionsPayload,
  type UserRecord,
  type UserRole,
  type UserStatus,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { userCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: UserOptionsPayload = {
  currentSchoolId: null,
  roles: [],
  userTypes: [],
  schools: [],
};

export default function UsersPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [options, setOptions] = useState<UserOptionsPayload>(emptyOptions);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState<string | null>(
    null,
  );
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<UserOptionsPayload>>('/users/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load user options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, [session]);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch, roleFilter, statusFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingUsers(true);

    void apiFetch<ApiSuccessResponse<UserRecord[]>>(
      `/users${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      })}`,
    )
      .then((response) => {
        setUsers(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setUsers([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load users.',
        });
      })
      .finally(() => {
        setLoadingUsers(false);
      });
  }, [deferredSearch, page, reloadIndex, roleFilter, session, statusFilter]);

  const handleSubmit = async (payload: UserFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = editingUser
        ? await apiFetch<ApiSuccessResponse<UserRecord>>(`/users/${editingUser.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<ApiSuccessResponse<UserRecord>>('/users', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingUser(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingUser
              ? 'Failed to update user.'
              : 'Failed to create user.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: UserRecord) => {
    setPendingDeleteUser(user);
    setMessage(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteUser) {
      return;
    }

    setDeletingUserId(pendingDeleteUser.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/users/${pendingDeleteUser.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingUser((current) =>
        current?.id === pendingDeleteUser.id ? null : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete user.',
      });
    } finally {
      setDeletingUserId(null);
      setPendingDeleteUser(null);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    setStatusUpdatingUserId(user.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<UserRecord>>(
        `/users/${user.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isActive: !user.isActive,
          }),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingUser((current) =>
        current?.id === user.id ? response.data : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to update user status.',
      });
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  const handleExportCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<UserRecord>({
        path: '/users',
        params: {
          search: deferredSearch || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
        columns: userCsvColumns,
        filename: buildCsvFilename(`users-${roleFilter || 'all'}-${statusFilter || 'all'}`),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} user record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export users.',
      });
    }
  };

  if (!sessionLoaded) {
    return (
      <section className="card panel">
        <p>Loading session...</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="card panel">
        <h2>Session Expired</h2>
        <p className="muted-text">
          Please sign in again to continue managing users and staff.
        </p>
      </section>
    );
  }

  const canAccessUsers =
    session.user.role === 'SUPER_ADMIN' || session.user.role === 'SCHOOL_ADMIN';

  if (!canAccessUsers) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to manage users and staff.
        </p>
      </section>
    );
  }

  return (
    <div className="users-page">
      <UserFilters
        actions={
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportCsv}
          />
        }
        searchInput={searchInput}
        roleFilter={roleFilter}
        roles={options.roles}
        statusFilter={statusFilter}
        onSearchChange={setSearchInput}
        onRoleChange={setRoleFilter}
        onStatusChange={setStatusFilter}
        onReset={() => setEditingUser(null)}
        showCreateReset={Boolean(editingUser)}
      />

      {message ? (
        <section
          className={`card panel banner banner-${message.type}`}
          role="status"
        >
          {message.text}
        </section>
      ) : null}

      <div className="users-grid">
        <UserForm
          mode={editingUser ? 'edit' : 'create'}
          options={options}
          canManageAcrossSchools={session.user.role === 'SUPER_ADMIN'}
          initialUser={editingUser}
          submitting={submitting || loadingOptions}
          onSubmit={handleSubmit}
          onCancel={editingUser ? () => setEditingUser(null) : undefined}
        />

        <UserTable
          currentUserRole={session.user.role}
          users={users}
          loading={loadingUsers}
          meta={meta}
          deletingUserId={deletingUserId}
          statusUpdatingUserId={statusUpdatingUserId}
          onEdit={setEditingUser}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Deactivate user"
        description={
          pendingDeleteUser
            ? `Deactivate ${pendingDeleteUser.name}? You can reactivate this user later from the status action.`
            : 'Deactivate this user?'
        }
        loading={Boolean(pendingDeleteUser && deletingUserId === pendingDeleteUser.id)}
        open={Boolean(pendingDeleteUser)}
        onClose={() => setPendingDeleteUser(null)}
        onConfirm={() => void confirmDelete()}
        title="Deactivate user"
      />
    </div>
  );
}
