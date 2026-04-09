'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AcademicJourneyCard } from './components/AcademicJourneyCard';
import { AttendanceSummaryCard } from './components/AttendanceSummaryCard';
import { EnrollmentHistoryTable } from './components/EnrollmentHistoryTable';
import { FeeSummaryCard } from './components/FeeSummaryCard';
import { HistoryHeader } from './components/HistoryHeader';
import { PromotionHistoryTable } from './components/PromotionHistoryTable';
import { ResultSummaryCard } from './components/ResultSummaryCard';
import { StudentHistoryTabs, type StudentHistoryTabId } from './components/StudentHistoryTabs';
import { StudentProfileSummary } from './components/StudentProfileSummary';
import { StudentTimeline } from './components/StudentTimeline';
import { EmptyState } from '@/components/ui/empty-state';
import {
  apiFetch,
  type ApiSuccessResponse,
  type StudentHistoryPayload,
} from '@/utils/api';

export default function StudentHistoryPage() {
  const params = useParams<{ id: string }>();
  const studentId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [activeTab, setActiveTab] = useState<StudentHistoryTabId>('overview');
  const [history, setHistory] = useState<StudentHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      return;
    }

    setLoading(true);

    void apiFetch<ApiSuccessResponse<StudentHistoryPayload>>(
      `/students/${studentId}/history`,
    )
      .then((response) => {
        setHistory(response.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load student history.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId]);

  if (loading) {
    return (
      <section className="card panel">
        <strong>Loading student history...</strong>
      </section>
    );
  }

  if (!history) {
    return (
      <EmptyState
        description={message ?? 'The requested student history could not be loaded.'}
        title="Student history unavailable."
      />
    );
  }

  return (
    <div className="students-page history-page">
      <HistoryHeader student={history.student} />

      <section className="card panel">
        <StudentHistoryTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'overview' ? (
          <div className="history-stack">
            <AcademicJourneyCard
              enrollmentHistory={history.enrollmentHistory}
              promotionHistory={history.promotionHistory}
              student={history.student}
            />
            <StudentProfileSummary student={history.student} />
          </div>
        ) : null}

        {activeTab === 'timeline' ? (
          <StudentTimeline
            enrollmentHistory={history.enrollmentHistory}
            promotionHistory={history.promotionHistory}
            resultSummary={history.resultSummary}
          />
        ) : null}

        {activeTab === 'academics' ? (
          <div className="history-stack">
            <EnrollmentHistoryTable records={history.enrollmentHistory} />
            <PromotionHistoryTable records={history.promotionHistory} />
          </div>
        ) : null}

        {activeTab === 'attendance' ? (
          <AttendanceSummaryCard summary={history.attendanceSummary} />
        ) : null}

        {activeTab === 'fees' ? <FeeSummaryCard summary={history.feeSummary} /> : null}

        {activeTab === 'results' ? (
          <ResultSummaryCard summary={history.resultSummary} />
        ) : null}
      </section>

      <div className="history-page-footer">
        <Link
          className="ui-button ui-button-secondary ui-button-md"
          href={`/students/${history.student.id}`}
        >
          Return to student profile
        </Link>
      </div>
    </div>
  );
}
