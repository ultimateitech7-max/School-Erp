'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type ParentDashboardPayload,
  type ParentPortalDetailPayload,
} from '@/utils/api';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ParentFeesPage() {
  const searchParams = useSearchParams();
  const requestedStudentId = searchParams.get('studentId') ?? '';
  const [dashboard, setDashboard] = useState<ParentDashboardPayload | null>(null);
  const [payload, setPayload] = useState<ParentPortalDetailPayload | null>(null);
  const [studentId, setStudentId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<ApiSuccessResponse<ParentDashboardPayload>>('/parent/dashboard')
      .then((response) => {
        setDashboard(response.data);
        const defaultStudentId =
          response.data.children.find((child) => child.id === requestedStudentId)?.id ??
          response.data.children[0]?.id ??
          '';
        setStudentId((current) => current || defaultStudentId);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Failed to load children.');
      });
  }, [requestedStudentId]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void apiFetch<ApiSuccessResponse<ParentPortalDetailPayload>>(
      `/parent/fees${createQueryString({
        studentId,
        sessionId: sessionId || undefined,
      })}`,
    )
      .then((response) => {
        setPayload(response.data);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Failed to load fees.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId, sessionId]);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading fees..." />
      </section>
    );
  }

  if (!dashboard?.children.length) {
    return (
      <EmptyState
        title="No linked children"
        description={message ?? 'Link at least one child to view fees.'}
      />
    );
  }

  if (!payload?.feeSummary) {
    return (
      <EmptyState
        title="Fee summary unavailable"
        description={message ?? 'Fee summary could not be loaded.'}
      />
    );
  }

  return (
    <div className="portal-page">
      {message ? <Banner tone="error">{message}</Banner> : null}
      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Child Fees</h2>
            <p className="muted-text">{payload.student.name}</p>
          </div>
          <div className="toolbar-actions">
            <Field className="portal-filter-field" label="Child">
              <Select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
              >
                {dashboard.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="portal-filter-field" label="Academic Session">
              <Select
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              >
                <option value="">All sessions</option>
                {payload.feeSummary.bySession.map((entry) => (
                  <option key={entry.session.id} value={entry.session.id}>
                    {entry.session.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="summary-cards-grid compact-grid">
          <article className="subtle-card">
            <span className="eyebrow">Assigned</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalAssigned)}</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Paid</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalPaid)}</strong>
          </article>
          <article className="subtle-card">
            <span className="eyebrow">Due</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalDue)}</strong>
          </article>
        </div>

        {payload.paymentHistory?.length ? (
          <div className="timeline-list">
            {payload.paymentHistory.map((payment) => (
              <article className="subtle-card" key={payment.id}>
                <div className="portal-detail-row">
                  <strong>{payment.feeName}</strong>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
                <p className="muted-text">
                  Receipt {payment.receiptNo} • {payment.paymentMode}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No payment history"
            description="Payments will show here once receipts are recorded."
          />
        )}
      </section>
    </div>
  );
}
