'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type FeeReceiptPayload,
  type StudentPortalFeesPayload,
} from '@/utils/api';
import { downloadFeeReceipt } from '@/utils/fee-receipt';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function StudentFeesPage() {
  const [payload, setPayload] = useState<StudentPortalFeesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<StudentPortalFeesPayload>>(
      `/student/fees${createQueryString({
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
  }, [sessionId]);

  const sessions = useMemo(() => payload?.feeSummary.bySession ?? [], [payload]);

  const handleDownloadReceipt = async (paymentId: string) => {
    setDownloadingReceiptId(paymentId);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<FeeReceiptPayload>>(
        `/student/fees/payments/${paymentId}/receipt`,
      );
      downloadFeeReceipt(response.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to download receipt.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading fees..." />
      </section>
    );
  }

  if (!payload) {
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
            <h2>Fees & Payments</h2>
            <p className="muted-text">{payload.student.name}</p>
          </div>
          <Field className="portal-filter-field" label="Academic Session">
            <Select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
            >
              <option value="">All sessions</option>
              {sessions.map((entry) => (
                <option key={entry.session.id} value={entry.session.id}>
                  {entry.session.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="summary-cards-grid compact-grid portal-fee-summary-grid">
          <article className="subtle-card portal-fee-summary-card">
            <span className="eyebrow">Assigned</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalAssigned)}</strong>
          </article>
          <article className="subtle-card portal-fee-summary-card">
            <span className="eyebrow">Paid</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalPaid)}</strong>
          </article>
          <article className="subtle-card portal-fee-summary-card">
            <span className="eyebrow">Due</span>
            <strong>{formatCurrency(payload.feeSummary.overall.totalDue)}</strong>
          </article>
        </div>

        {payload.paymentHistory.length ? (
          <div className="timeline-list portal-payment-list">
            {payload.paymentHistory.map((payment) => (
              <article className="subtle-card portal-payment-item" key={payment.id}>
                <div className="portal-payment-main">
                  <div className="portal-payment-copy">
                    <strong>{payment.feeName}</strong>
                    <p className="muted-text">
                      {formatDate(payment.paymentDate)} • {payment.paymentMode} • Receipt{' '}
                      {payment.receiptNo}
                      {payment.session ? ` • ${payment.session.name}` : ''}
                    </p>
                  </div>
                  <div className="portal-payment-actions">
                    <span className="portal-payment-amount">
                      {formatCurrency(payment.amount)}
                    </span>
                    <Button
                      disabled={downloadingReceiptId === payment.id}
                      onClick={() => void handleDownloadReceipt(payment.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {downloadingReceiptId === payment.id
                        ? 'Preparing...'
                        : 'Download Receipt'}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No payments recorded"
            description="Payment history will appear after fee payments are posted."
          />
        )}
      </section>
    </div>
  );
}
