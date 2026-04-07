'use client';

import type { ApiMeta, UserRecord, UserRole } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface UserTableProps {
  currentUserRole: UserRole;
  users: UserRecord[];
  loading: boolean;
  meta: ApiMeta;
  deletingUserId: string | null;
  statusUpdatingUserId: string | null;
  onEdit: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
  onToggleStatus: (user: UserRecord) => void;
  onPageChange: (page: number) => void;
}

function canManageUser(currentUserRole: UserRole, user: UserRecord) {
  if (currentUserRole === 'SUPER_ADMIN') {
    return true;
  }

  return user.role === 'TEACHER' || user.role === 'STAFF';
}

export function UserTable({
  currentUserRole,
  users,
  loading,
  meta,
  deletingUserId,
  statusUpdatingUserId,
  onEdit,
  onDelete,
  onToggleStatus,
  onPageChange,
}: UserTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Users List</h2>
          <p className="muted-text">
            {meta.total} record{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? <p>Loading users...</p> : null}

      {!loading && users.length === 0 ? (
        <EmptyState
          description="Adjust your filters or add a new user."
          title="No users found."
        />
      ) : null}

      {!loading && users.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Name</TableHeadCell>
                  <TableHeadCell>Email</TableHeadCell>
                  <TableHeadCell>Phone</TableHeadCell>
                  <TableHeadCell>Role</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const canManage = canManageUser(currentUserRole, user);

                  return (
                    <tr key={user.id}>
                      <TableCell>
                        <div className="table-primary-cell">
                          <strong>{user.name}</strong>
                          {user.designation ? (
                            <span className="muted-text">{user.designation}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone ?? '-'}</TableCell>
                      <TableCell>
                        <Badge tone={user.role === 'SUPER_ADMIN' ? 'danger' : 'info'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={user.isActive ? 'success' : 'warning'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="table-actions">
                          {canManage ? (
                            <>
                              <Button
                                onClick={() => onEdit(user)}
                                type="button"
                                variant="secondary"
                              >
                                Edit
                              </Button>

                              <Button
                                disabled={statusUpdatingUserId === user.id}
                                onClick={() => onToggleStatus(user)}
                                type="button"
                                variant="secondary"
                              >
                                {statusUpdatingUserId === user.id
                                  ? 'Saving...'
                                  : user.isActive
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </Button>

                              {user.isActive ? (
                                <Button
                                  disabled={deletingUserId === user.id}
                                  onClick={() => onDelete(user)}
                                  type="button"
                                  variant="danger"
                                >
                                  {deletingUserId === user.id
                                    ? 'Deleting...'
                                    : 'Delete'}
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <span className="muted-text">Restricted</span>
                          )}
                        </div>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>

          <PaginationControls
            limit={meta.limit}
            page={meta.page}
            total={meta.total}
            onPageChange={onPageChange}
          />
        </>
      ) : null}
    </section>
  );
}
