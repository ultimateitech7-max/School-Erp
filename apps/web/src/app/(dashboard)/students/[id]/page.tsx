'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PromotionHistoryTable } from '../../promotions/components/PromotionHistoryTable';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  apiFetch,
  type ApiMeta,
  type ApiSuccessResponse,
  type PromotionRecord,
  type StudentRecord,
} from '@/utils/api';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [activeTab, setActiveTab] = useState<'profile' | 'promotions'>('profile');
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [promotions, setPromotions] = useState<PromotionRecord[]>([]);
  const [promotionMeta, setPromotionMeta] = useState<ApiMeta>(initialMeta);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [loadingPromotions, setLoadingPromotions] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    setLoadingStudent(true);

    void apiFetch<ApiSuccessResponse<StudentRecord>>(`/students/${studentId}`)
      .then((response) => {
        setStudent(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error ? error.message : 'Failed to load student.',
        );
      })
      .finally(() => {
        setLoadingStudent(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    setLoadingPromotions(true);

    void apiFetch<ApiSuccessResponse<PromotionRecord[]>>(
      `/promotions/student/${studentId}?page=1&limit=10`,
    )
      .then((response) => {
        setPromotions(response.data);
        setPromotionMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setPromotions([]);
        setPromotionMeta(initialMeta);
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load promotion history.',
        );
      })
      .finally(() => {
        setLoadingPromotions(false);
      });
  }, [studentId]);

  if (loadingStudent) {
    return (
      <section className="card panel">
        <strong>Loading student profile...</strong>
      </section>
    );
  }

  if (!student) {
    return (
      <EmptyState
        description={message ?? 'The requested student could not be loaded.'}
        title="Student not found."
      />
    );
  }

  return (
    <div className="students-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Student Detail</p>
          <h1>{student.name}</h1>
          <p>
            {student.registrationNumber ?? student.studentCode}
            {student.registrationNumber ? ` • ${student.studentCode}` : ''}
            {student.admissionNo ? ` • ${student.admissionNo}` : ''}
          </p>
        </div>
        <div className="page-header-meta">
          <Badge tone={student.status === 'ACTIVE' ? 'success' : 'warning'}>
            {student.status}
          </Badge>
          <Link
            className="ui-button ui-button-secondary ui-button-md"
            href={`/students/${student.id}/history`}
          >
            View History
          </Link>
          <Link className="ui-button ui-button-secondary ui-button-md" href="/students">
            Back to Students
          </Link>
        </div>
      </section>

      <section className="card panel">
        <div className="promotion-tabs">
          <button
            className={`promotion-tab ${activeTab === 'profile' ? 'promotion-tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            Profile
          </button>
          <button
            className={`promotion-tab ${activeTab === 'promotions' ? 'promotion-tab-active' : ''}`}
            onClick={() => setActiveTab('promotions')}
            type="button"
          >
            Promotion History
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div className="summary-cards-grid">
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="success">Registration</Badge>
              </div>
              <strong>{student.registrationNumber ?? '-'}</strong>
              <span>Permanent student registration</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Email</Badge>
              </div>
              <strong>{student.email ?? '-'}</strong>
              <span>Student email</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Phone</Badge>
              </div>
              <strong>{student.phone ?? '-'}</strong>
              <span>Student contact</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Class</Badge>
              </div>
              <strong>{student.class?.name ?? '-'}</strong>
              <span>{student.section?.name ?? 'No section'}</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Session</Badge>
              </div>
              <strong>{student.sessionId ?? '-'}</strong>
              <span>Current academic session id</span>
            </article>
          </div>
        ) : null}

        {activeTab === 'promotions' ? (
          <PromotionHistoryTable
            description="Complete preserved promotion trail for this student."
            loading={loadingPromotions}
            meta={promotionMeta}
            records={promotions}
            showStudentColumn={false}
            title="Student Promotion History"
          />
        ) : null}
      </section>
    </div>
  );
}
