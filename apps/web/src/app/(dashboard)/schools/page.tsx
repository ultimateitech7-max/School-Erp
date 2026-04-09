'use client';

import type { FormEvent } from 'react';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useSchoolScope } from '@/hooks/use-school-scope';
import { getStoredAuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type SchoolFormPayload,
  type SchoolRecord,
} from '@/utils/api';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const initialForm: SchoolFormPayload = {
  name: '',
  code: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function SchoolsPage() {
  const session = useMemo(() => getStoredAuthSession(), []);
  const { selectedSchoolId, setSelectedSchoolId } = useSchoolScope();
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [form, setForm] = useState<SchoolFormPayload>(initialForm);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<SchoolRecord[]>>(
      `/schools${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
      })}`,
    )
      .then((response) => {
        setSchools(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setSchools([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load schools.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [deferredSearch, page, reloadIndex]);

  const canManageSchools = session?.user.role === 'SUPER_ADMIN';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<{
        school: SchoolRecord;
        adminUser: NonNullable<SchoolRecord['adminUser']>;
      }>('/schools', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setMessage({
        type: 'success',
        text: `School created successfully. School admin ${response.adminUser.email} is ready.`,
      });
      setForm(initialForm);
      setSelectedSchoolId(response.school.id);
      setPage(1);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create school.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManageSchools) {
    return (
      <section className="card panel">
        <Banner tone="error">Only Super Admin can manage schools.</Banner>
      </section>
    );
  }

  return (
    <div className="users-page">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="summary-cards-grid">
        <article className="card summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Platform Scope</Badge>
            <span className="summary-card-trend">Live</span>
          </div>
          <p>Total schools onboarded</p>
          <strong>{meta.total}</strong>
          <span>Create new schools and switch context from the header selector.</span>
        </article>
        <article className="card summary-card">
          <div className="summary-card-top">
            <Badge tone={selectedSchoolId ? 'success' : 'warning'}>
              {selectedSchoolId ? 'Selected School' : 'Selection Pending'}
            </Badge>
            <span className="summary-card-trend">{selectedSchoolId ? 'Scoped' : 'Choose one'}</span>
          </div>
          <p>Current working school</p>
          <strong>
            {schools.find((school) => school.id === selectedSchoolId)?.name ??
              'No school selected'}
          </strong>
          <span>School-specific modules use the header selector automatically.</span>
        </article>
      </section>

      <section className="users-grid">
        <article className="card panel">
          <div className="students-toolbar-copy">
            <h2>Create School</h2>
            <p>Provision a new school workspace and its default school admin.</p>
          </div>

          <form className="detail-list" onSubmit={handleSubmit}>
            <Field label="School Name">
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Springfield Public School"
                required
                value={form.name}
              />
            </Field>

            <Field hint="Used for subdomain and internal code." label="School Code">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
                  }))
                }
                placeholder="springfield"
                required
                value={form.code}
              />
            </Field>

            <Field label="Admin Name">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminName: event.target.value,
                  }))
                }
                placeholder="School Admin"
                required
                value={form.adminName}
              />
            </Field>

            <Field label="Admin Email">
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminEmail: event.target.value,
                  }))
                }
                placeholder="admin@springfield.edu"
                required
                type="email"
                value={form.adminEmail}
              />
            </Field>

            <Field hint="Minimum 8 characters." label="Admin Password">
              <Input
                minLength={8}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminPassword: event.target.value,
                  }))
                }
                placeholder="Create a secure password"
                required
                type="password"
                value={form.adminPassword}
              />
            </Field>

            <div className="form-actions">
              <Button disabled={submitting} type="submit">
                {submitting ? 'Creating...' : 'Create School'}
              </Button>
            </div>
          </form>
        </article>

        <article className="card panel">
          <div className="students-toolbar">
            <div className="students-toolbar-copy">
              <h2>Schools</h2>
              <p>Search active tenants and switch straight into their school scope.</p>
            </div>
            <Field className="students-toolbar-search" label="Search schools">
              <Input
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by school name or code"
                value={searchInput}
              />
            </Field>
          </div>

          {loading ? (
            <div className="panel-empty">
              <Spinner label="Loading schools..." />
            </div>
          ) : schools.length === 0 ? (
            <div className="empty-state">
              <strong>No schools found</strong>
              <p>Create the first school or broaden your search.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>School</th>
                      <th>Code</th>
                      <th>School Admin</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th className="align-right-cell">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((school) => (
                      <tr key={school.id}>
                        <td>
                          <div className="table-primary-cell">
                            <strong>{school.name}</strong>
                            <span>{school.subdomain}</span>
                          </div>
                        </td>
                        <td>{school.schoolCode}</td>
                        <td>
                          <div className="table-primary-cell">
                            <strong>{school.adminUser?.name ?? 'Not provisioned'}</strong>
                            <span>{school.adminUser?.email ?? 'No school admin found'}</span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={school.isActive ? 'success' : 'neutral'}>
                            {school.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>{formatDate(school.createdAt)}</td>
                        <td className="align-right-cell">
                          <div className="table-action-row">
                            <Button
                              onClick={() => setSelectedSchoolId(school.id)}
                              type="button"
                              variant={selectedSchoolId === school.id ? 'secondary' : 'ghost'}
                            >
                              {selectedSchoolId === school.id ? 'Selected' : 'Work In School'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span className="pagination-label">
                  Page {meta.page} of {Math.max(1, Math.ceil(meta.total / meta.limit))}
                </span>
                <div className="table-action-row">
                  <Button
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    type="button"
                    variant="ghost"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={page >= Math.ceil(meta.total / meta.limit)}
                    onClick={() => setPage((current) => current + 1)}
                    type="button"
                    variant="ghost"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
