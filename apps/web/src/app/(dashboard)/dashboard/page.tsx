'use client';

import { useEffect, useMemo, useState } from 'react';
import { AttendanceChart } from './components/AttendanceChart';
import { ClassDistributionChart } from './components/ClassDistributionChart';
import { FeeChart } from './components/FeeChart';
import { RecentActivity } from './components/RecentActivity';
import { SummaryCards } from './components/SummaryCards';
import { RoleDashboardHome } from '@/components/dashboard/role-dashboard-home';
import { Badge } from '@/components/ui/badge';
import { Field, Input } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiSuccessResponse,
  type DashboardAttendanceRecord,
  type DashboardClassesRecord,
  type DashboardExamsRecord,
  type DashboardFeesRecord,
  type DashboardOverviewRecord,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const emptyOverview: DashboardOverviewRecord = {
  schoolId: null,
  selectedDate: null,
  totals: {
    students: 0,
    teachers: 0,
    staff: 0,
    classes: 0,
    subjects: 0,
    exams: 0,
  },
  attendanceToday: {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  },
  fees: {
    collected: 0,
    pending: 0,
    assigned: 0,
    paymentCount: 0,
    byMethod: [],
  },
  recentActivities: [],
};

const emptyAttendance: DashboardAttendanceRecord = {
  schoolId: null,
  summary: {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  },
  chart: [],
};

const emptyFees: DashboardFeesRecord = {
  schoolId: null,
  selectedDate: null,
  totals: {
    collected: 0,
    pending: 0,
    assigned: 0,
    paymentCount: 0,
    byMethod: [],
  },
  chart: [],
};

const emptyClasses: DashboardClassesRecord = {
  schoolId: null,
  totalClasses: 0,
  distribution: [],
};

const emptyExams: DashboardExamsRecord = {
  schoolId: null,
  summary: {
    total: 0,
    draft: 0,
    scheduled: 0,
    ongoing: 0,
    published: 0,
    closed: 0,
    averagePercentage: 0,
  },
  recentExams: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardAnalyticsPage() {
  const [session] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [selectedDate, setSelectedDate] = useState('');
  const [overview, setOverview] = useState<DashboardOverviewRecord>(emptyOverview);
  const [attendance, setAttendance] = useState<DashboardAttendanceRecord>(emptyAttendance);
  const [fees, setFees] = useState<DashboardFeesRecord>(emptyFees);
  const [classes, setClasses] = useState<DashboardClassesRecord>(emptyClasses);
  const [exams, setExams] = useState<DashboardExamsRecord>(emptyExams);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user.role === 'TEACHER' || session?.user.role === 'STAFF') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const feeQuery = createQueryString({
      date: selectedDate || undefined,
    });

    void Promise.all([
      apiFetch<ApiSuccessResponse<DashboardOverviewRecord>>(
        `/dashboard/overview${feeQuery}`,
      ),
      apiFetch<ApiSuccessResponse<DashboardAttendanceRecord>>('/dashboard/attendance'),
      apiFetch<ApiSuccessResponse<DashboardFeesRecord>>(`/dashboard/fees${feeQuery}`),
      apiFetch<ApiSuccessResponse<DashboardClassesRecord>>('/dashboard/classes'),
      apiFetch<ApiSuccessResponse<DashboardExamsRecord>>('/dashboard/exams'),
    ])
      .then(
        ([
          overviewResponse,
          attendanceResponse,
          feesResponse,
          classesResponse,
          examsResponse,
        ]) => {
          setOverview(overviewResponse.data);
          setAttendance(attendanceResponse.data);
          setFees(feesResponse.data);
          setClasses(classesResponse.data);
          setExams(examsResponse.data);
        },
      )
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard analytics.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDate, session?.user.role]);

  const feeDateLabel = selectedDate
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(`${selectedDate}T00:00:00`))
    : 'overall';

  const summaryItems = useMemo(
    () => [
      {
        label: 'Students',
        value: String(overview.totals.students),
        hint: `${overview.attendanceToday.present} present today`,
      },
      {
        label: 'Teachers',
        value: String(overview.totals.teachers),
        hint: `${overview.totals.staff} staff members active`,
      },
      {
        label: 'Classes',
        value: String(overview.totals.classes),
        hint: `${overview.totals.subjects} active subjects`,
      },
      {
        label: 'Fees Collected',
        value: formatCurrency(overview.fees.collected),
        hint: selectedDate
          ? `${overview.fees.paymentCount} payments on ${feeDateLabel}`
          : `${overview.fees.paymentCount} payments recorded`,
      },
      {
        label: 'Pending Fees',
        value: formatCurrency(overview.fees.pending),
        hint: selectedDate
          ? `${formatCurrency(overview.fees.assigned)} still assigned school-wide`
          : `${formatCurrency(overview.fees.assigned)} assigned`,
      },
      {
        label: 'Exams',
        value: String(overview.totals.exams),
        hint: `${exams.summary.published} published`,
      },
    ],
    [exams.summary.published, feeDateLabel, overview, selectedDate],
  );

  if (session?.user.role === 'TEACHER') {
    return <RoleDashboardHome role="TEACHER" />;
  }

  if (session?.user.role === 'STAFF') {
    return <RoleDashboardHome role="STAFF" />;
  }

  return (
    <section className="analytics-page">
      {error ? (
        <article className="card panel banner banner-error">
          <p className="error-text">{error}</p>
        </article>
      ) : null}

      <article className="card panel analytics-filter-panel">
        <div className="panel-heading compact-panel-heading">
          <div>
            <h2>Tracking Filters</h2>
            <p className="muted-text">
              Switch between overall view and a single-day fee collection snapshot.
            </p>
          </div>
          <div className="analytics-filter-actions">
            {selectedDate ? <Badge tone="info">{feeDateLabel}</Badge> : null}
            <Field className="analytics-date-field" label="Fee Collection Date">
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </article>

      <SummaryCards
        items={
          loading
            ? summaryItems.map((item) => ({
                ...item,
                value: '...',
              }))
            : summaryItems
        }
      />

      <div className="analytics-grid analytics-grid-main">
        <article className="card panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Attendance</span>
              <h2>Attendance Trend</h2>
              <p className="muted-text">Daily attendance status over the last 7 days.</p>
            </div>
          </div>
          <AttendanceChart points={attendance.chart} />
        </article>

        <article className="card panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Fees</span>
              <h2>Fee Collection</h2>
              <p className="muted-text">
                {selectedDate
                  ? `Collection snapshot for ${feeDateLabel} with payment-method split.`
                  : 'Recent collection trend and outstanding dues.'}
              </p>
            </div>
            <div className="analytics-method-breakdown">
              {fees.totals.byMethod.length ? (
                fees.totals.byMethod.map((item) => (
                  <div className="analytics-method-pill" key={item.method}>
                    <strong>{item.method}</strong>
                    <span>{formatCurrency(item.total)}</span>
                    <small>{item.count} payment{item.count === 1 ? '' : 's'}</small>
                  </div>
                ))
              ) : (
                <Badge tone="neutral">No payment-method data</Badge>
              )}
            </div>
          </div>
          <FeeChart points={fees.chart} />
        </article>
      </div>

      <div className="analytics-grid analytics-grid-secondary">
        <article className="card panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Classes</span>
              <h2>Student Distribution</h2>
              <p className="muted-text">Active student allocation across classes.</p>
            </div>
          </div>
          <ClassDistributionChart items={classes.distribution} />
        </article>

        <article className="card panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Activity</span>
              <h2>Recent Activity</h2>
              <p className="muted-text">
                Latest operations across students, users, fees, and exams.
              </p>
            </div>
          </div>
          <RecentActivity items={overview.recentActivities} examSummary={exams.summary} />
        </article>
      </div>
    </section>
  );
}
