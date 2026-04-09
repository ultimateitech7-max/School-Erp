'use client';

import { useRouter } from 'next/navigation';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AdmissionFilters } from './components/AdmissionFilters';
import { AdmissionForm } from './components/AdmissionForm';
import { AdmissionTable } from './components/AdmissionTable';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useSchoolScope } from '@/hooks/use-school-scope';
import { getStoredAuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  createQueryString,
  type AdmissionApplicationRecord,
  type AdmissionApplicationStatus,
  type AdmissionFormPayload,
  type ApiMeta,
  type ApiSuccessResponse,
} from '@/utils/api';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getStatusTone(status: AdmissionApplicationStatus) {
  if (status === 'ENROLLED') {
    return 'success';
  }

  if (status === 'APPROVED') {
    return 'success';
  }

  if (status === 'REJECTED') {
    return 'danger';
  }

  if (status === 'UNDER_REVIEW') {
    return 'warning';
  }

  if (status === 'APPLIED') {
    return 'info';
  }

  return 'neutral';
}

function getStatusLabel(status: AdmissionApplicationStatus) {
  if (status === 'ENROLLED') {
    return 'Enrolled';
  }

  if (status === 'UNDER_REVIEW') {
    return 'Under Review';
  }

  return status.charAt(0) + status.slice(1).toLowerCase();
}

function getNextStatuses(status: AdmissionApplicationStatus) {
  if (status === 'INQUIRY') {
    return ['APPLIED', 'REJECTED'] as AdmissionApplicationStatus[];
  }

  if (status === 'APPLIED') {
    return ['UNDER_REVIEW', 'REJECTED'] as AdmissionApplicationStatus[];
  }

  if (status === 'UNDER_REVIEW') {
    return ['APPROVED', 'REJECTED'] as AdmissionApplicationStatus[];
  }

  return [] as AdmissionApplicationStatus[];
}

const statusTimeline: AdmissionApplicationStatus[] = [
  'INQUIRY',
  'APPLIED',
  'UNDER_REVIEW',
  'APPROVED',
  'ENROLLED',
  'REJECTED',
];

export default function AdmissionsPage() {
  const router = useRouter();
  const authSession = useMemo(() => getStoredAuthSession(), []);
  const [admissions, setAdmissions] = useState<AdmissionApplicationRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [confirmEnrollOpen, setConfirmEnrollOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdmissionApplicationStatus | ''>('');
  const deferredSearch = useDeferredValue(searchInput);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [selectedAdmission, setSelectedAdmission] =
    useState<AdmissionApplicationRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState<AdmissionApplicationStatus>('INQUIRY');
  const [remarksDraft, setRemarksDraft] = useState('');
  const { selectedSchoolId } = useSchoolScope();

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch, statusFilter]);

  useEffect(() => {
    setLoading(true);

    void apiFetch<ApiSuccessResponse<AdmissionApplicationRecord[]>>(
      `/admissions${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        status: statusFilter || undefined,
      })}`,
    )
      .then((response) => {
        setAdmissions(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setAdmissions([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load admission applications.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [deferredSearch, page, reloadIndex, statusFilter]);

  const canCreate =
    authSession?.user.role === 'SCHOOL_ADMIN' ||
    Boolean(authSession?.user.schoolId) ||
    Boolean(selectedSchoolId);
  const hasActiveFilters = Boolean(deferredSearch || statusFilter);
  const nextStatuses = selectedAdmission ? getNextStatuses(selectedAdmission.status) : [];
  const canEnrollSelectedAdmission =
    selectedAdmission?.status === 'APPROVED' && !selectedAdmission.studentId;

  const handleCreate = async (payload: AdmissionFormPayload) => {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<AdmissionApplicationRecord>>(
        '/admissions',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setPage(1);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to create admission application.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = async (admission: AdmissionApplicationRecord) => {
    setDetailLoading(true);
    setSelectedAdmission(null);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<AdmissionApplicationRecord>>(
        `/admissions/${admission.id}`,
      );

      setSelectedAdmission(response.data);
      setStatusDraft(response.data.status);
      setRemarksDraft(response.data.remarks ?? '');
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to fetch admission details.',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (status: AdmissionApplicationStatus) => {
    if (!selectedAdmission) {
      return;
    }

    setUpdatingStatus(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<AdmissionApplicationRecord>>(
        `/admissions/${selectedAdmission.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            remarks: remarksDraft.trim() || undefined,
          }),
        },
      );

      setSelectedAdmission(response.data);
      setStatusDraft(response.data.status);
      setRemarksDraft(response.data.remarks ?? '');
      setReloadIndex((current) => current + 1);
      setMessage({
        type: 'success',
        text: response.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to update admission status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedAdmission) {
      return;
    }

    setEnrolling(true);
    setMessage(null);

    try {
      const response = await apiFetch<
        ApiSuccessResponse<{
          admission: AdmissionApplicationRecord;
          student: {
            id: string;
            name: string;
            registrationNumber: string | null;
            studentCode: string;
          };
        }>
      >(`/admissions/${selectedAdmission.id}/enroll`, {
        method: 'POST',
      });

      setSelectedAdmission(response.data.admission);
      setConfirmEnrollOpen(false);
      setReloadIndex((current) => current + 1);
      setMessage({
        type: 'success',
        text: `${response.message} Redirecting to student profile...`,
      });

      setTimeout(() => {
        router.push(`/students/${response.data.student.id}`);
      }, 400);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to enroll admission.',
      });
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="students-page">
      {message ? (
        <Banner tone={message.type === 'success' ? 'success' : 'error'}>
          <strong>{message.type === 'success' ? 'Success' : 'Something went wrong'}</strong>
          <p>{message.text}</p>
        </Banner>
      ) : null}

      {!canCreate ? (
        <Banner tone="info">
          <strong>School context required</strong>
          <p>
            Platform-scoped super admins can review admission applications, but creating one
            requires a school-scoped session.
          </p>
        </Banner>
      ) : null}

      <div className="dashboard-two-column">
        <AdmissionForm
          disabled={!canCreate}
          submitting={submitting}
          onSubmit={handleCreate}
        />

        <div className="stacked-panels">
          <AdmissionFilters
            hasActiveFilters={hasActiveFilters}
            loading={loading}
            search={searchInput}
            status={statusFilter}
            onReset={() => {
              setSearchInput('');
              setStatusFilter('');
              setPage(1);
            }}
            onSearchChange={setSearchInput}
            onStatusChange={setStatusFilter}
          />

          <AdmissionTable
            admissions={admissions}
            hasActiveFilters={hasActiveFilters}
            loading={loading}
            meta={meta}
            onPageChange={setPage}
            onView={handleView}
          />
        </div>
      </div>

      <Modal
        description="Review complete application details and move the student through the workflow."
        open={Boolean(selectedAdmission) || detailLoading}
        title="Admission Detail"
        onClose={() => {
          if (updatingStatus) {
            return;
          }

          setSelectedAdmission(null);
          setDetailLoading(false);
        }}
      >
        {detailLoading ? (
          <div className="ui-empty-state">
            <Spinner />
            <p className="muted-text">Loading admission details...</p>
          </div>
        ) : selectedAdmission ? (
          <div className="stacked-panels">
            <div className="detail-grid">
              <div className="detail-card">
                <span className="eyebrow">Student</span>
                <strong>{selectedAdmission.studentName}</strong>
                <p className="muted-text">{selectedAdmission.classApplied}</p>
              </div>
              <div className="detail-card">
                <span className="eyebrow">Workflow Status</span>
                <Badge tone={getStatusTone(selectedAdmission.status)}>
                  {getStatusLabel(selectedAdmission.status)}
                </Badge>
                <p className="muted-text">Created {formatDate(selectedAdmission.createdAt)}</p>
              </div>
            </div>

            <div className="detail-card">
              <span className="eyebrow">Workflow Timeline</span>
              <div className="inline-badge-row">
                {statusTimeline.map((status) => {
                  const isCurrent = selectedAdmission.status === status;
                  const isReached =
                    statusTimeline.indexOf(selectedAdmission.status) >=
                      statusTimeline.indexOf(status) &&
                    selectedAdmission.status !== 'REJECTED';
                  const tone = isCurrent
                    ? getStatusTone(status)
                    : isReached
                      ? 'info'
                      : 'neutral';

                  return (
                    <Badge
                      className={isCurrent ? 'timeline-badge-active' : undefined}
                      key={status}
                      tone={tone}
                    >
                      {getStatusLabel(status)}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="eyebrow">Parents</span>
                <strong>{selectedAdmission.fatherName}</strong>
                <p className="muted-text">{selectedAdmission.motherName}</p>
              </div>
              <div className="detail-card">
                <span className="eyebrow">Contact</span>
                <strong>{selectedAdmission.phone}</strong>
                <p className="muted-text">{selectedAdmission.email ?? 'No email provided'}</p>
              </div>
            </div>

            <div className="detail-card">
              <span className="eyebrow">Address</span>
              <p>{selectedAdmission.address}</p>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="eyebrow">Date of Birth</span>
                <strong>{formatDate(selectedAdmission.dob)}</strong>
              </div>
              <div className="detail-card">
                <span className="eyebrow">Previous School</span>
                <strong>{selectedAdmission.previousSchool ?? 'Not provided'}</strong>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span className="eyebrow">Linked Student</span>
                <strong>{selectedAdmission.student?.name ?? 'Not enrolled yet'}</strong>
                <p className="muted-text">
                  {selectedAdmission.student?.registrationNumber ??
                    selectedAdmission.student?.studentCode ??
                    'A student profile will be created after enrollment.'}
                </p>
              </div>
              <div className="detail-card">
                <span className="eyebrow">School</span>
                <strong>{selectedAdmission.school?.name ?? 'School scoped'}</strong>
                <p className="muted-text">
                  {selectedAdmission.school?.schoolCode ?? selectedAdmission.schoolId}
                </p>
              </div>
            </div>

            <div className="simple-form">
              <Field label="Update Status">
                <Select
                  disabled={
                    updatingStatus ||
                    enrolling ||
                    nextStatuses.length === 0 ||
                    selectedAdmission.status === 'ENROLLED'
                  }
                  value={statusDraft}
                  onChange={(event) =>
                    setStatusDraft(event.target.value as AdmissionApplicationStatus)
                  }
                >
                  <option value={selectedAdmission.status}>
                    {getStatusLabel(selectedAdmission.status)}
                  </option>
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field hint="Optional" label="Remarks">
                <Textarea
                  disabled={updatingStatus || enrolling}
                  rows={3}
                  value={remarksDraft}
                  onChange={(event) => setRemarksDraft(event.target.value)}
                />
              </Field>
            </div>

            <div className="table-actions">
              <button
                className="primary-button"
                disabled={
                  updatingStatus ||
                  enrolling ||
                  statusDraft === selectedAdmission.status ||
                  !nextStatuses.includes(statusDraft)
                }
                onClick={() => void handleUpdateStatus(statusDraft)}
                type="button"
              >
                {updatingStatus ? 'Updating...' : 'Save Status'}
              </button>

              {nextStatuses.includes('APPROVED') ? (
                <button
                  className="secondary-button"
                  disabled={updatingStatus || enrolling}
                  onClick={() => void handleUpdateStatus('APPROVED')}
                  type="button"
                >
                  Approve
                </button>
              ) : null}

              {nextStatuses.includes('REJECTED') ? (
                <button
                  className="secondary-button"
                  disabled={updatingStatus || enrolling}
                  onClick={() => void handleUpdateStatus('REJECTED')}
                  type="button"
                >
                  Reject
                </button>
              ) : null}

              {canEnrollSelectedAdmission ? (
                <button
                  className="primary-button"
                  disabled={updatingStatus || enrolling}
                  onClick={() => setConfirmEnrollOpen(true)}
                  type="button"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Student'}
                </button>
              ) : null}

              {selectedAdmission.studentId ? (
                <button
                  className="secondary-button"
                  onClick={() => router.push(`/students/${selectedAdmission.studentId}`)}
                  type="button"
                >
                  View Student
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        description="A new student profile and current-session enrollment will be created from this admission."
        footer={
          <div className="table-actions">
            <button
              className="secondary-button"
              disabled={enrolling}
              onClick={() => setConfirmEnrollOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={enrolling || !selectedAdmission}
              onClick={() => void handleEnroll()}
              type="button"
            >
              {enrolling ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        }
        open={confirmEnrollOpen}
        title="Convert Admission to Student"
        onClose={() => {
          if (enrolling) {
            return;
          }

          setConfirmEnrollOpen(false);
        }}
      >
        <div className="stacked-panels">
          <div className="detail-card">
            <span className="eyebrow">Student</span>
            <strong>{selectedAdmission?.studentName}</strong>
            <p className="muted-text">
              {selectedAdmission?.classApplied} • {selectedAdmission?.phone}
            </p>
          </div>
          <Banner tone="info">
            <strong>Ready to enroll</strong>
            <p>
              This will create a real student record, assign a permanent registration
              number, and create the current academic session enrollment.
            </p>
          </Banner>
        </div>
      </Modal>
    </div>
  );
}
