'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  PermissionCatalogRecord,
  UserPermissionRecord,
  UserPermissionsFormPayload,
} from '@/utils/api';

interface UserPermissionManagerProps {
  permissionState: UserPermissionRecord | null;
  loading: boolean;
  saving: boolean;
  onSubmit: (payload: UserPermissionsFormPayload) => Promise<void>;
}

function titleizeGroup(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolvePermissionTone(
  item: PermissionCatalogRecord,
  rolePermissions: Set<string>,
  effectivePermissions: Set<string>,
) {
  const isRoleGranted = rolePermissions.has(item.code);
  const isEffective = effectivePermissions.has(item.code);

  if (isRoleGranted && isEffective) {
    return { label: 'Role Default', tone: 'neutral' as const };
  }

  if (isRoleGranted && !isEffective) {
    return { label: 'Revoked', tone: 'warning' as const };
  }

  if (!isRoleGranted && isEffective) {
    return { label: 'Granted', tone: 'success' as const };
  }

  return { label: 'Off', tone: 'neutral' as const };
}

export function UserPermissionManager({
  permissionState,
  loading,
  saving,
  onSubmit,
}: UserPermissionManagerProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    setSelectedPermissions(permissionState?.effectivePermissions ?? []);
  }, [permissionState]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionCatalogRecord[]>();

    permissionState?.catalog.forEach((item) => {
      const groupItems = groups.get(item.group) ?? [];
      groupItems.push(item);
      groups.set(item.group, groupItems);
    });

    return Array.from(groups.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [permissionState]);

  const rolePermissions = useMemo(
    () => new Set(permissionState?.rolePermissions ?? []),
    [permissionState],
  );
  const effectivePermissions = useMemo(
    () => new Set(selectedPermissions),
    [selectedPermissions],
  );

  const handleToggle = (permissionCode: string, checked: boolean) => {
    setSelectedPermissions((current) => {
      if (checked) {
        return Array.from(new Set([...current, permissionCode])).sort((left, right) =>
          left.localeCompare(right),
        );
      }

      return current.filter((item) => item !== permissionCode);
    });
  };

  const handleReset = () => {
    setSelectedPermissions(permissionState?.effectivePermissions ?? []);
  };

  const handleSubmit = async () => {
    if (!permissionState) {
      return;
    }

    const selected = new Set(selectedPermissions);
    const grantedPermissions = Array.from(selected).filter(
      (code) => !rolePermissions.has(code),
    );
    const revokedPermissions = Array.from(rolePermissions).filter(
      (code) => !selected.has(code),
    );

    await onSubmit({
      grantedPermissions,
      revokedPermissions,
    });
  };

  return (
    <section className="card panel compact-panel-stack">
      <div className="panel-heading compact-panel-heading">
        <div>
          <h2>Staff Permissions</h2>
          <p className="muted-text">
            Choose exactly which modules and actions the selected staff member can access.
          </p>
        </div>
      </div>

      {loading ? <p>Loading permission controls...</p> : null}

      {!loading && !permissionState ? (
        <p className="muted-text">
          Select a teacher or staff member from the list to manage granular permissions.
        </p>
      ) : null}

      {!loading && permissionState ? (
        <>
          <div className="subtle-card permission-overview">
            <div className="permission-overview-head">
              <div>
                <strong>{permissionState.userName}</strong>
                <p className="muted-text">
                  {selectedPermissions.length} of {permissionState.catalog.length} permissions active
                </p>
              </div>
              <Badge tone="info">{permissionState.role.replaceAll('_', ' ')}</Badge>
            </div>
          </div>

          <div className="permission-group-stack">
            {groupedPermissions.map(([group, items]) => (
              <section className="permission-group" key={group}>
                <div className="permission-group-head">
                  <div>
                    <h3>{titleizeGroup(group)}</h3>
                    <span className="muted-text">{items.length} controls</span>
                  </div>
                </div>

                <div className="permission-list">
                  {items.map((item) => {
                    const status = resolvePermissionTone(
                      item,
                      rolePermissions,
                      effectivePermissions,
                    );
                    const checked = effectivePermissions.has(item.code);

                    return (
                      <label className="permission-row" key={item.code}>
                        <input
                          checked={checked}
                          disabled={saving}
                          type="checkbox"
                          onChange={(event) =>
                            handleToggle(item.code, event.target.checked)
                          }
                        />
                        <span className="permission-row-copy">
                          <strong>{item.name}</strong>
                          <span className="muted-text">
                            {item.description || item.code}
                          </span>
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="form-actions">
            <Button disabled={saving} onClick={handleSubmit} type="button">
              {saving ? 'Saving...' : 'Save Permissions'}
            </Button>
            <Button disabled={saving} onClick={handleReset} type="button" variant="secondary">
              Reset Changes
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
