'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PaymentHistory } from '../fees/components/PaymentHistory';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type FeeReceiptPayload,
  type FeesOptionsPayload,
  type PaymentRecord,
  type StudentFeeRecord,
  type StudentOptionsPayload,
  type StudentRecord,
} from '@/utils/api';
import { downloadFeeReceipt } from '@/utils/fee-receipt';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyFeeOptions: FeesOptionsPayload = {
  currentSessionId: '',
  currentSessionName: '',
  classes: [],
  students: [],
  feeCategories: [],
  feeFrequencies: [],
  paymentModes: [],
  assignmentStatuses: [],
};

const initialPaymentForm = {
  studentFeeId: '',
  amount: '',
  paymentDate: '',
  paymentMethod: 'CASH' as FeesOptionsPayload['paymentModes'][number] | 'CASH',
  reference: '',
  notes: '',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function buildStudentLabel(student: StudentRecord) {
  const identity = student.registrationNumber ?? student.admissionNo ?? student.studentCode;
  return `${student.name} · ${identity}`;
}

export default function FeeSubmissionsPage() {
  const [studentOptions, setStudentOptions] = useState<StudentOptionsPayload | null>(null);
  const [feeOptions, setFeeOptions] = useState<FeesOptionsPayload>(emptyFeeOptions);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentSnapshot, setSelectedStudentSnapshot] = useState<StudentRecord | null>(null);
  const [dueFees, setDueFees] = useState<StudentFeeRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsMeta, setPaymentsMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingDueFees, setLoadingDueFees] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [paymentPage, setPaymentPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const deferredStudentQuery = useDeferredValue(studentQuery);

  useEffect(() => {
    setLoadingOptions(true);

    void Promise.all([
      apiFetch<ApiSuccessResponse<StudentOptionsPayload>>('/students/options'),
      apiFetch<ApiSuccessResponse<FeesOptionsPayload>>('/fees/options'),
    ])
      .then(([studentOptionsResponse, feeOptionsResponse]) => {
        setStudentOptions(studentOptionsResponse.data);
        setFeeOptions(feeOptionsResponse.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load fee submission options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, []);

  const classOptions = studentOptions?.classes ?? [];
  const sectionOptions = useMemo(
    () => classOptions.find((item) => item.id === classId)?.sections ?? [],
    [classId, classOptions],
  );

  const selectedStudent = useMemo(
    () =>
      (selectedStudentSnapshot?.id === selectedStudentId
        ? selectedStudentSnapshot
        : null) ??
      students.find((item) => item.id === selectedStudentId) ??
      null,
    [selectedStudentId, selectedStudentSnapshot, students],
  );

  const activeDueFee = useMemo(
    () =>
      dueFees.find((item) => item.studentFeeId === paymentForm.studentFeeId) ?? dueFees[0] ?? null,
    [dueFees, paymentForm.studentFeeId],
  );

  const totalDueAmount = useMemo(
    () => dueFees.reduce((sum, item) => sum + item.dueAmount, 0),
    [dueFees],
  );
  const totalAssignedAmount = useMemo(
    () => dueFees.reduce((sum, item) => sum + item.netAmount, 0),
    [dueFees],
  );
  const totalPaidAmount = useMemo(
    () => dueFees.reduce((sum, item) => sum + item.paidAmount, 0),
    [dueFees],
  );

  useEffect(() => {
    if (sectionId && !sectionOptions.some((item) => item.id === sectionId)) {
      setSectionId('');
    }
  }, [sectionId, sectionOptions]);

  useEffect(() => {
    setSelectedStudentId('');
    setSelectedStudentSnapshot(null);
    setDueFees([]);
    setPaymentForm((current) => ({
      ...initialPaymentForm,
      paymentMethod: current.paymentMethod || feeOptions.paymentModes[0] || 'CASH',
    }));
  }, [classId, sectionId, feeOptions.paymentModes]);

  useEffect(() => {
    setLoadingStudents(true);

    void apiFetch<ApiSuccessResponse<StudentRecord[]>>(
      `/students${createQueryString({
        page: 1,
        limit: deferredStudentQuery.trim() ? 8 : 30,
        search: deferredStudentQuery.trim() || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
      })}`,
    )
      .then((response) => {
        setStudents(response.data);
        if (selectedStudentId) {
          const refreshedSelectedStudent =
            response.data.find((item) => item.id === selectedStudentId) ?? null;
          if (refreshedSelectedStudent) {
            setSelectedStudentSnapshot(refreshedSelectedStudent);
          }
        }
      })
      .catch((error) => {
        setStudents([]);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to search students.',
        });
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [classId, deferredStudentQuery, sectionId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setDueFees([]);
      setLoadingDueFees(false);
      return;
    }

    setLoadingDueFees(true);

    void apiFetch<ApiSuccessResponse<StudentFeeRecord[]>>(
      `/fees/student/${selectedStudentId}${createQueryString({
        page: 1,
        limit: 50,
      })}`,
    )
      .then((response) => {
        setDueFees(response.data.filter((item) => item.dueAmount > 0));
      })
      .catch((error) => {
        setDueFees([]);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load due payments.',
        });
      })
      .finally(() => {
        setLoadingDueFees(false);
      });
  }, [reloadIndex, selectedStudentId]);

  useEffect(() => {
    setPaymentForm((current) => {
      const nextStudentFeeId = dueFees.some((item) => item.studentFeeId === current.studentFeeId)
        ? current.studentFeeId
        : dueFees[0]?.studentFeeId ?? '';
      const nextDueFee =
        dueFees.find((item) => item.studentFeeId === nextStudentFeeId) ?? dueFees[0] ?? null;

      return {
        ...current,
        studentFeeId: nextStudentFeeId,
        amount:
          current.studentFeeId === nextStudentFeeId && current.amount
            ? current.amount
            : nextDueFee
              ? String(nextDueFee.dueAmount)
              : '',
        paymentMethod: current.paymentMethod || feeOptions.paymentModes[0] || 'CASH',
      };
    });
  }, [dueFees, feeOptions.paymentModes]);

  useEffect(() => {
    setLoadingPayments(true);

    void apiFetch<ApiSuccessResponse<PaymentRecord[]>>(
      `/fees/payments${createQueryString({
        page: paymentPage,
        limit: initialMeta.limit,
        search: selectedStudentId ? undefined : deferredStudentQuery.trim() || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
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
          text: error instanceof Error ? error.message : 'Failed to load payment history.',
        });
      })
      .finally(() => {
        setLoadingPayments(false);
      });
  }, [classId, deferredStudentQuery, paymentPage, reloadIndex, sectionId, selectedStudentId]);

  const handleSearchChange = (value: string) => {
    setStudentQuery(value);
    setSelectedStudentId('');
    setSelectedStudentSnapshot(null);
    setPaymentPage(1);
    setShowSuggestions(true);
  };

  const handleStudentSelect = (student: StudentRecord) => {
    setSelectedStudentId(student.id);
    setSelectedStudentSnapshot(student);
    setStudentQuery(buildStudentLabel(student));
    setShowSuggestions(false);
    setPaymentPage(1);
  };

  const handleStudentSelectById = (studentId: string) => {
    setSelectedStudentId(studentId);
    setPaymentPage(1);

    const matchedStudent = students.find((item) => item.id === studentId);
    if (matchedStudent) {
      setSelectedStudentSnapshot(matchedStudent);
      setStudentQuery(buildStudentLabel(matchedStudent));
    } else if (!studentId) {
      setSelectedStudentSnapshot(null);
      setStudentQuery('');
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.studentFeeId) {
      setMessage({
        type: 'error',
        text: 'Select a due fee before recording payment.',
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await apiFetch<ApiSuccessResponse<PaymentRecord>>('/fees/payment', {
        method: 'POST',
        body: JSON.stringify({
          studentFeeId: paymentForm.studentFeeId,
          amount: Number(paymentForm.amount),
          paymentDate: paymentForm.paymentDate || undefined,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference.trim() || undefined,
          notes: paymentForm.notes.trim() || undefined,
        }),
      });

      setMessage({
        type: 'success',
        text: 'Payment recorded successfully.',
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to record payment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async (payment: PaymentRecord) => {
    setDownloadingReceiptId(payment.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<FeeReceiptPayload>>(
        `/fees/payments/${payment.id}/receipt`,
      );
      downloadFeeReceipt(response.data);
      setMessage({
        type: 'success',
        text: `Receipt ${response.data.receiptNo} opened in print view. Save it as PDF from the dialog.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to download receipt.',
      });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  return (
    <div className="dashboard-stack">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="card panel compact-panel-stack fee-collection-desk">
        <div className="panel-heading compact-panel-heading fee-management-head">
          <div>
            <h2>Collection Desk</h2>
            <p className="muted-text">
              Search with suggestions or use class, section, and student filters for faster collection.
            </p>
          </div>

          <div className="chip-list">
            <Badge tone={selectedStudent ? 'success' : 'neutral'}>
              {selectedStudent ? `Student: ${selectedStudent.name}` : 'No student selected'}
            </Badge>
            {selectedStudent ? (
              <Badge tone={dueFees.length ? 'warning' : 'success'}>
                Due {formatCurrency(totalDueAmount)}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="fee-submission-toolbar">
          <Field className="fee-submission-search-field" label="Search Student / School ID">
            <div className="fee-student-search">
              <Input
                placeholder="Type name, student code, registration, or admission no."
                value={studentQuery}
                onBlur={() => {
                  window.setTimeout(() => setShowSuggestions(false), 120);
                }}
                onChange={(event) => handleSearchChange(event.target.value)}
                onFocus={() => setShowSuggestions(true)}
              />

              {showSuggestions && deferredStudentQuery.trim() ? (
                <div className="fee-student-suggestion-list">
                  {loadingStudents ? (
                    <div className="fee-student-suggestion-empty">Searching students...</div>
                  ) : students.length ? (
                    students.map((student) => (
                      <button
                        className="fee-student-suggestion"
                        key={student.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleStudentSelect(student)}
                        type="button"
                      >
                        <strong>{student.name}</strong>
                        <span>
                          {student.studentCode}
                          {student.admissionNo ? ` · ${student.admissionNo}` : ''}
                        </span>
                        <small>
                          {student.class?.name ?? 'Class pending'}
                          {student.section?.name ? ` · ${student.section.name}` : ''}
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="fee-student-suggestion-empty">
                      No matching student found.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </Field>

          <div className="fee-submission-or">or</div>

          <Field label="Class">
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Section">
            <Select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
              <option value="">All sections</option>
              {sectionOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Student">
            <Select
              value={selectedStudentId}
              onChange={(event) => handleStudentSelectById(event.target.value)}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.studentCode})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="chip-list">
          <Badge tone="neutral">
            {selectedStudent
              ? `Selected: ${selectedStudent.name}`
              : 'Select a student to start collection'}
          </Badge>
          {classId ? (
            <Badge tone="info">
              {classOptions.find((item) => item.id === classId)?.name ?? 'Class'}
            </Badge>
          ) : null}
          {sectionId ? (
            <Badge tone="info">
              {sectionOptions.find((item) => item.id === sectionId)?.name ?? 'Section'}
            </Badge>
          ) : null}
        </div>

        {selectedStudent ? (
          <article className="subtle-card fee-collection-selected">
            <div>
              <strong>{selectedStudent.name}</strong>
              <p className="muted-text portal-card-meta">
                {selectedStudent.studentCode}
                {selectedStudent.registrationNumber
                  ? ` · ${selectedStudent.registrationNumber}`
                  : ''}
                {selectedStudent.class?.name ? ` · ${selectedStudent.class.name}` : ''}
                {selectedStudent.section?.name ? ` / ${selectedStudent.section.name}` : ''}
              </p>
            </div>

            <div className="fee-inline-summary">
              <span>{dueFees.length} assigned dues</span>
              <span>Total {formatCurrency(totalAssignedAmount)}</span>
              <span>Paid {formatCurrency(totalPaidAmount)}</span>
              <span>Due {formatCurrency(totalDueAmount)}</span>
            </div>
          </article>
        ) : null}
      </section>

      <section className="card panel compact-panel-stack fee-payment-shell">
        <div className="panel-heading compact-panel-heading fee-management-head">
          <div>
            <h2>Submit Fee</h2>
            <p className="muted-text">
              Pick an assigned fee below, enter any payable amount, and record the receipt.
            </p>
          </div>

          {selectedStudent ? (
            <div className="chip-list">
              <Badge tone="neutral">
                {selectedStudent.class?.name ?? 'No class'}
                {selectedStudent.section?.name ? ` / ${selectedStudent.section.name}` : ''}
              </Badge>
              <Badge tone={dueFees.length ? 'warning' : 'success'}>
                Due {formatCurrency(totalDueAmount)}
              </Badge>
            </div>
          ) : null}
        </div>

        {!selectedStudent ? (
          <EmptyState
            title="Select a student"
            description="Use search suggestions or class, section, and student selectors above."
          />
        ) : loadingDueFees ? (
          <Spinner label="Loading assigned fees..." />
        ) : !dueFees.length ? (
          <EmptyState
            title="No due amount"
            description="This student does not have any pending or partial fee dues."
          />
        ) : (
          <>
            <div className="fee-assignment-grid">
              {dueFees.map((item) => {
                const isActive = item.studentFeeId === paymentForm.studentFeeId;

                return (
                  <button
                    className={`fee-assignment-card${isActive ? ' fee-assignment-card-active' : ''}`}
                    key={item.studentFeeId}
                    onClick={() =>
                      setPaymentForm((current) => ({
                        ...current,
                        studentFeeId: item.studentFeeId,
                        amount: String(item.dueAmount),
                      }))
                    }
                    type="button"
                  >
                    <div className="fee-assignment-card-top">
                      <strong>{item.feeStructure.name}</strong>
                      <Badge tone={item.status === 'PARTIAL' ? 'warning' : 'danger'}>
                        {item.status}
                      </Badge>
                    </div>
                    <div className="fee-inline-summary">
                      <span>Assigned {formatCurrency(item.netAmount)}</span>
                      <span>Paid {formatCurrency(item.paidAmount)}</span>
                      <span>Due {formatCurrency(item.dueAmount)}</span>
                      <span>By {formatDate(item.dueDate)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeDueFee ? (
              <article className="subtle-card compact-summary-card fee-payment-active-summary">
                <div className="portal-detail-row">
                  <div>
                    <strong>{activeDueFee.feeStructure.name}</strong>
                    <p className="muted-text portal-card-meta">
                      {activeDueFee.feeStructure.feeCode}
                      {activeDueFee.feeStructure.category
                        ? ` · ${activeDueFee.feeStructure.category}`
                        : ''}
                    </p>
                  </div>
                  <div className="fee-inline-summary">
                    <span>Due now {formatCurrency(activeDueFee.dueAmount)}</span>
                    <span>Paid {formatCurrency(activeDueFee.paidAmount)}</span>
                    <span>Total {formatCurrency(activeDueFee.netAmount)}</span>
                  </div>
                </div>
              </article>
            ) : null}

            <form
              className="simple-form fee-payment-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleRecordPayment();
              }}
            >
              <div className="form-grid fee-payment-form-grid">
                <Field label="Assigned Fee">
                  <Select
                    required
                    value={paymentForm.studentFeeId}
                    onChange={(event) => {
                      const nextFee =
                        dueFees.find((item) => item.studentFeeId === event.target.value) ?? null;
                      setPaymentForm((current) => ({
                        ...current,
                        studentFeeId: event.target.value,
                        amount: nextFee ? String(nextFee.dueAmount) : current.amount,
                      }));
                    }}
                  >
                    <option value="">Select assigned fee</option>
                    {dueFees.map((item) => (
                      <option key={item.studentFeeId} value={item.studentFeeId}>
                        {item.feeStructure.name} · Due {formatCurrency(item.dueAmount)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Amount"
                  hint={
                    activeDueFee
                      ? `You can pay any amount up to ${formatCurrency(activeDueFee.dueAmount)}.`
                      : undefined
                  }
                >
                  <Input
                    min="0.01"
                    required
                    step="0.01"
                    type="number"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label="Payment Method">
                  <Select
                    value={paymentForm.paymentMethod}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        paymentMethod: event.target.value as typeof paymentForm.paymentMethod,
                      }))
                    }
                  >
                    {feeOptions.paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Payment Date">
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field label="Reference / Txn ID">
                  <Input
                    value={paymentForm.reference}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field className="fee-payment-notes-field" label="Notes">
                  <Textarea
                    rows={3}
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="fee-payment-footer">
                <div className="fee-inline-summary">
                  {activeDueFee ? (
                    <>
                      <span>{activeDueFee.feeStructure.name}</span>
                      <span>Remaining {formatCurrency(activeDueFee.dueAmount)}</span>
                    </>
                  ) : null}
                </div>

                <div className="form-actions fee-payment-actions">
                  {activeDueFee ? (
                    <Button
                      onClick={() =>
                        setPaymentForm((current) => ({
                          ...current,
                          amount: String(activeDueFee.dueAmount),
                        }))
                      }
                      type="button"
                      variant="secondary"
                    >
                      Fill Full Due
                    </Button>
                  ) : null}
                  <Button disabled={submitting} type="submit">
                    {submitting ? 'Recording...' : 'Submit Fee'}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </section>

      <PaymentHistory
        downloadingReceiptId={downloadingReceiptId}
        loading={loadingPayments}
        meta={paymentsMeta}
        onDownloadReceipt={(payment) => void handleDownloadReceipt(payment)}
        onPageChange={setPaymentPage}
        payments={payments}
        actions={
          <div className="chip-list">
            <Badge tone="neutral">
              {selectedStudent
                ? `History: ${selectedStudent.name}`
                : classId || sectionId || deferredStudentQuery.trim()
                  ? 'History follows current filters'
                  : 'All recent receipts'}
            </Badge>
          </div>
        }
      />
    </div>
  );
}
