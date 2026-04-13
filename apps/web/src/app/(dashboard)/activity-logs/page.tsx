'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select } from '@/components/ui/field';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ActivityLogOptionsPayload,
  type ActivityLogRecord,
  type ApiMeta,
  type ApiSuccessResponse,
  type UserRole,
} from '@/utils/api';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 20,
  total: 0,
};

function formatAction(value: string) {
  return value.replaceAll(/[._]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEntity(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveActivityTone(entity: string) {
  const upper = entity.toUpperCase();

  if (upper.includes('FEE')) {
    return 'FEE';
  }

  if (upper.includes('EXAM')) {
    return 'EXAM';
  }

  if (upper.includes('STUDENT') || upper.includes('PARENT')) {
    return 'STUDENT';
  }

  return 'USER';
}

export default function ActivityLogsPage() {
  const [options, setOptions] = useState<ActivityLogOptionsPayload>({ users: [] });
  const [items, setItems] = useState<ActivityLogRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [actorUserId, setActorUserId] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(searchInput);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<ActivityLogOptionsPayload>>('/audit/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load activity filters.',
        });
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [actorUserId, deferredSearch, roleFilter]);

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(options.users.map((item) => item.role)),
      ).sort((left, right) => left.localeCompare(right)),
    [options.users],
  );

  const filteredUsers = useMemo(
    () =>
      options.users.filter((item) => (roleFilter ? item.role === roleFilter : true)),
    [options.users, roleFilter],
  );

  useEffect(() => {
    if (actorUserId && !filteredUsers.some((item) => item.id === actorUserId)) {
      setActorUserId('');
    }
  }, [actorUserId, filteredUsers]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<ActivityLogRecord[]>>(
      `/audit/logs${createQueryString({
        page,
        limit: initialMeta.limit,
        actorUserId: actorUserId || undefined,
        actorRole: !actorUserId && roleFilter ? roleFilter : undefined,
        search: deferredSearch || undefined,
      })}`,
    )
      .then((response) => {
        setItems(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setItems([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load activity logs.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [actorUserId, deferredSearch, page, roleFilter]);

  const selectedActor = useMemo(
    () => options.users.find((item) => item.id === actorUserId) ?? null,
    [actorUserId, options.users],
  );

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="card panel academic-toolbar">
        <div>
          <h2>Activity Explorer</h2>
          <p className="muted-text">
            Track all recent admin actions and drill into a specific person when needed.
          </p>
        </div>

        <div className="toolbar-actions">
          <Field label="Role">
            <Select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
            >
              <option value="">All roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Person">
            <Select
              value={actorUserId}
              onChange={(event) => setActorUserId(event.target.value)}
            >
              <option value="">All users</option>
              {filteredUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.role})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Search">
            <Input
              placeholder="Search action, module, metadata, or actor"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </Field>
        </div>
      </section>

      {selectedActor || roleFilter ? (
        <section className="card panel compact-panel-stack">
          <div className="panel-heading compact-panel-heading">
            <div>
              <h3>{selectedActor?.name ?? `${roleFilter?.replaceAll('_', ' ')} activity`}</h3>
              <p className="muted-text">
                {selectedActor
                  ? `${selectedActor.email} · ${selectedActor.role}`
                  : 'Showing all activity for the selected role.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card panel compact-panel-stack">
        <div className="panel-heading compact-panel-heading">
          <div>
            <h2>Recent Activity</h2>
            <p className="muted-text">
              Latest logged actions from the active school scope.
            </p>
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading activity logs..." />
        ) : !items.length ? (
          <EmptyState
            title="No activity logs found"
            description="Try a broader search or wait for new actions to be recorded."
          />
        ) : (
          <div className="activity-feed">
            {items.map((item) => {
              const metadata = Object.entries(item.metadata ?? {}).slice(0, 4);

              return (
                <article className="activity-item" key={item.id}>
                  <div
                    className={`activity-badge activity-badge-${resolveActivityTone(item.entity)}`}
                  >
                    {item.entity.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="activity-copy">
                    <strong>{formatAction(item.action)}</strong>
                    <p>
                      {item.actor?.name ?? 'System'} · {formatEntity(item.entity)}
                    </p>
                    {metadata.length ? (
                      <p className="muted-text">
                        {metadata
                          .map(([key, value]) => `${formatEntity(key)}: ${String(value)}`)
                          .join(' · ')}
                      </p>
                    ) : null}
                    <span>{new Date(item.timestamp).toLocaleString('en-IN')}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <PaginationControls
          limit={meta.limit}
          onPageChange={setPage}
          page={meta.page}
          total={meta.total}
        />
      </section>
    </div>
  );
}
