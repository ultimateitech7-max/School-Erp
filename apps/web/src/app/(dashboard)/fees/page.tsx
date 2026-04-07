'use client';

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AssignFeeForm } from './components/AssignFeeForm';
import { FeeStructureForm } from './components/FeeStructureForm';
import { FeesTable } from './components/FeesTable';
import { PaymentForm } from './components/PaymentForm';
import { PaymentHistory } from './components/PaymentHistory';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type AssignFeePayload,
  type FeeAssignmentStatus,
  type FeeStructureFormPayload,
  type FeeStructureRecord,
  type FeesOptionsPayload,
  type PaymentRecord,
  type RecordPaymentPayload,
  type StudentFeeRecord,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: FeesOptionsPayload = {
  currentSessionId: '',
  currentSessionName: '',
  classes: [],
  students: [],
  feeCategories: [],
  feeFrequencies: [],
  paymentModes: [],
  assignmentStatuses: [],
};

export default function FeesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [options, setOptions] = useState<FeesOptionsPayload>(emptyOptions);
  const [feeStructures, setFeeStructures] = useState<FeeStructureRecord[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [structureMeta, setStructureMeta] = useState<ApiMeta>(initialMeta);
  const [studentFeesMeta, setStudentFeesMeta] = useState<ApiMeta>(initialMeta);
  const [paymentsMeta, setPaymentsMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingStudentFees, setLoadingStudentFees] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [structureSubmitting, setStructureSubmitting] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeeAssignmentStatus | ''>('');
  const [structurePage, setStructurePage] = useState(1);
  const [studentFeePage, setStudentFeePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setStructurePage(1);
      setStudentFeePage(1);
      setPaymentPage(1);
    });
  }, [deferredSearch, selectedStudentId, statusFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<FeesOptionsPayload>>('/fees/options')
      .then((response) => {
        setOptions(response.data);
        setSelectedStudentId((current) => current || response.data.students[0]?.id || '');
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load fee options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingStructures(true);

    void apiFetch<ApiSuccessResponse<FeeStructureRecord[]>>(
      `/fees/structure${createQueryString({
        page: structurePage,
        limit: initialMeta.limit,
        search: deferredSearch,
      })}`,
    )
      .then((response) => {
        setFeeStructures(response.data);
        setStructureMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setFeeStructures([]);
        setStructureMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load fee structures.',
        });
      })
      .finally(() => {
        setLoadingStructures(false);
      });
  }, [deferredSearch, reloadIndex, session, structurePage]);

  useEffect(() => {
    if (!session || !selectedStudentId) {
      setStudentFees([]);
      setStudentFeesMeta(initialMeta);
      setLoadingStudentFees(false);
      return;
    }

    setLoadingStudentFees(true);

    void apiFetch<ApiSuccessResponse<StudentFeeRecord[]>>(
      `/fees/student/${selectedStudentId}${createQueryString({
        page: studentFeePage,
        limit: initialMeta.limit,
        search: deferredSearch,
        status: statusFilter || undefined,
      })}`,
    )
      .then((response) => {
        setStudentFees(response.data);
        setStudentFeesMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setStudentFees([]);
        setStudentFeesMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load student fees.',
        });
      })
      .finally(() => {
        setLoadingStudentFees(false);
      });
  }, [deferredSearch, reloadIndex, selectedStudentId, session, statusFilter, studentFeePage]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingPayments(true);

    void apiFetch<ApiSuccessResponse<PaymentRecord[]>>(
      `/fees/payments${createQueryString({
        page: paymentPage,
        limit: initialMeta.limit,
        search: deferredSearch,
        studentId: selectedStudentId || undefined,
      })}`,
    )
      .then((response) => {
        setPayments(response.data);
        setPaymentsMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setPayments([]);
        setPaymentsMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load payments.',
        });
      })
      .finally(() => {
        setLoadingPayments(false);
      });
  }, [deferredSearch, paymentPage, reloadIndex, selectedStudentId, session]);

  const paymentCandidates = useMemo(
    () => studentFees.filter((item) => item.dueAmount > 0),
    [studentFees],
  );

  const handleCreateStructure = async (payload: FeeStructureFormPayload) => {
    setStructureSubmitting(true);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<FeeStructureRecord>>('/fees/structure', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: 'Fee structure created successfully.',
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to create fee structure.',
      });
    } finally {
      setStructureSubmitting(false);
    }
  };

  const handleAssignFee = async (payload: AssignFeePayload) => {
    setAssignSubmitting(true);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<StudentFeeRecord>>('/fees/assign', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: 'Fee assigned successfully.',
      });
      setSelectedStudentId(payload.studentId);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to assign fee.',
      });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRecordPayment = async (payload: RecordPaymentPayload) => {
    setPaymentSubmitting(true);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<PaymentRecord>>('/fees/payment', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: 'Payment recorded successfully.',
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to record payment.',
      });
    } finally {
      setPaymentSubmitting(false);
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
          Please sign in again to continue managing fees.
        </p>
      </section>
    );
  }

  const canManageFees =
    session.user.role === 'SUPER_ADMIN' || session.user.role === 'SCHOOL_ADMIN';

  if (!canManageFees) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to manage fees.
        </p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Fees Management</h2>
          <p className="muted-text">
            Create structures, assign fees, record payments, and track dues.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by fee, receipt, or student"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          >
            <option value="">All students</option>
            {options.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name} ({student.studentCode})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as FeeAssignmentStatus | '')
            }
          >
            <option value="">All statuses</option>
            {options.assignmentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </section>

      {message ? (
        <section
          className={`card panel banner banner-${message.type}`}
          role="status"
        >
          {message.text}
        </section>
      ) : null}

      <div className="academic-grid fees-grid">
        <FeeStructureForm
          options={options}
          submitting={structureSubmitting || loadingOptions}
          onSubmit={handleCreateStructure}
        />
        <AssignFeeForm
          options={options}
          feeStructures={feeStructures}
          submitting={assignSubmitting || loadingStructures || loadingOptions}
          onSubmit={handleAssignFee}
        />
        <PaymentForm
          options={options}
          studentFees={paymentCandidates}
          submitting={paymentSubmitting || loadingStudentFees || loadingOptions}
          onSubmit={handleRecordPayment}
        />
      </div>

      <div className="fees-results-grid">
        <FeesTable
          fees={studentFees}
          loading={loadingStudentFees}
          meta={studentFeesMeta}
          onPageChange={setStudentFeePage}
        />
        <PaymentHistory
          payments={payments}
          loading={loadingPayments}
          meta={paymentsMeta}
          onPageChange={setPaymentPage}
        />
      </div>
    </div>
  );
}
