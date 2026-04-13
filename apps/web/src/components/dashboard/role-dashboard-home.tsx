'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PortalNoticeGrid } from '@/components/portal/portal-shared-pages';
import { HolidayYearCalendar } from '@/components/ui/holiday-year-calendar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  type ApiSuccessResponse,
  type HolidayRecord,
  type HomeworkRecord,
  type MessageRecord,
  type NoticeRecord,
  type TimetableEntryRecord,
  type ExamRecord,
} from '@/utils/api';

type RoleHomeState = {
  holidays: HolidayRecord[];
  homework: HomeworkRecord[];
  inbox: MessageRecord[];
  sent: MessageRecord[];
  notices: NoticeRecord[];
  timetables: TimetableEntryRecord[];
  exams: ExamRecord[];
};

const emptyRoleState: RoleHomeState = {
  holidays: [],
  homework: [],
  inbox: [],
  sent: [],
  notices: [],
  timetables: [],
  exams: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

interface RoleDashboardHomeProps {
  role: 'TEACHER' | 'STAFF';
}

export function RoleDashboardHome({ role }: RoleDashboardHomeProps) {
  const [state, setState] = useState<RoleHomeState>(emptyRoleState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadState = async () => {
      try {
        if (role === 'TEACHER') {
          const [
            inboxResponse,
            noticesResponse,
            holidaysResponse,
            homeworkResponse,
            timetableResponse,
            examsResponse,
          ] = await Promise.allSettled([
            apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/inbox'),
            apiFetch<ApiSuccessResponse<NoticeRecord[]>>('/notices/portal'),
            apiFetch<ApiSuccessResponse<HolidayRecord[]>>('/holidays/portal'),
            apiFetch<ApiSuccessResponse<HomeworkRecord[]>>('/homework?page=1&limit=6'),
            apiFetch<ApiSuccessResponse<TimetableEntryRecord[]>>('/timetables'),
            apiFetch<ApiSuccessResponse<ExamRecord[]>>('/exams?page=1&limit=6'),
          ]);

          setState({
            inbox:
              inboxResponse.status === 'fulfilled' ? inboxResponse.value.data : [],
            sent: [],
            notices:
              noticesResponse.status === 'fulfilled'
                ? noticesResponse.value.data
                : [],
            holidays:
              holidaysResponse.status === 'fulfilled'
                ? holidaysResponse.value.data
                : [],
            homework:
              homeworkResponse.status === 'fulfilled'
                ? homeworkResponse.value.data
                : [],
            timetables:
              timetableResponse.status === 'fulfilled'
                ? timetableResponse.value.data
                : [],
            exams:
              examsResponse.status === 'fulfilled' ? examsResponse.value.data : [],
          });

          return;
        }

        const [inboxResponse, noticesResponse, holidaysResponse, sentResponse] =
          await Promise.allSettled([
            apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/inbox'),
            apiFetch<ApiSuccessResponse<NoticeRecord[]>>('/notices/portal'),
            apiFetch<ApiSuccessResponse<HolidayRecord[]>>('/holidays/portal'),
            apiFetch<ApiSuccessResponse<MessageRecord[]>>('/messages/sent'),
          ]);

        setState({
          inbox: inboxResponse.status === 'fulfilled' ? inboxResponse.value.data : [],
          sent: sentResponse.status === 'fulfilled' ? sentResponse.value.data : [],
          notices:
            noticesResponse.status === 'fulfilled' ? noticesResponse.value.data : [],
          holidays:
            holidaysResponse.status === 'fulfilled' ? holidaysResponse.value.data : [],
          homework: [],
          timetables: [],
          exams: [],
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load workspace summary.',
        );
        setState(emptyRoleState);
      } finally {
        setLoading(false);
      }
    };

    void loadState();
  }, [role]);

  const summaryItems = useMemo(() => {
    const unreadInbox = state.inbox.filter((item) => !item.isRead).length;

    if (role === 'TEACHER') {
      return [
        {
          label: 'Unread Messages',
          value: String(unreadInbox),
          hint: `${state.inbox.length} total in inbox`,
        },
        {
          label: 'Homework',
          value: String(state.homework.length),
          hint: 'Recent assignments published',
        },
        {
          label: 'Timetable Slots',
          value: String(state.timetables.length),
          hint: 'Visible teaching periods',
        },
        {
          label: 'Exams',
          value: String(state.exams.length),
          hint: 'Open result workflows',
        },
        {
          label: 'Announcements',
          value: String(state.notices.length),
          hint: 'Latest staff notices',
        },
        {
          label: 'Calendar',
          value: String(state.holidays.length),
          hint: 'Upcoming holidays and events',
        },
      ];
    }

    return [
      {
        label: 'Unread Messages',
        value: String(unreadInbox),
        hint: `${state.inbox.length} total in inbox`,
      },
      {
        label: 'Sent Messages',
        value: String(state.sent.length),
        hint: 'Recent outbound communication',
      },
      {
        label: 'Announcements',
        value: String(state.notices.length),
        hint: 'Latest staff-facing updates',
      },
      {
        label: 'Calendar',
        value: String(state.holidays.length),
        hint: 'Upcoming events and closures',
      },
    ];
  }, [role, state]);

  const quickLinks =
    role === 'TEACHER'
      ? [
          { href: '/attendance', label: 'Mark attendance' },
          { href: '/homework', label: 'Manage homework' },
          { href: '/timetables', label: 'View timetable' },
          { href: '/exams', label: 'Enter marks' },
          { href: '/messages/inbox', label: 'Open inbox' },
          { href: '/announcements', label: 'Read announcements' },
        ]
      : [
          { href: '/messages/inbox', label: 'Open inbox' },
          { href: '/messages/compose', label: 'Send message' },
          { href: '/announcements', label: 'Read announcements' },
          { href: '/calendar', label: 'Check calendar' },
        ];

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label={`Loading ${role === 'TEACHER' ? 'teacher' : 'staff'} dashboard...`} />
      </section>
    );
  }

  return (
    <div className="dashboard-stack">
      {error ? (
        <section className="card panel banner banner-error">
          <p className="error-text">{error}</p>
        </section>
      ) : null}

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              {role === 'TEACHER' ? 'Teacher Workspace' : 'Staff Workspace'}
            </span>
            <h2>
              {role === 'TEACHER'
                ? 'Start with your classes, homework, and marks.'
                : 'Start with communication, updates, and school coordination.'}
            </h2>
            <p className="muted-text">
              {role === 'TEACHER'
                ? 'Your dashboard stays focused on daily classroom execution.'
                : 'Your dashboard keeps important messages, notices, and school dates close at hand.'}
            </p>
          </div>
        </div>

        <div className="chip-list">
          {quickLinks.map((item) => (
            <Link className="text-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="summary-cards-grid compact-grid">
        {summaryItems.map((item) => (
          <article className="summary-card" key={item.label}>
            <div className="summary-card-top">
              <Badge tone="info">{item.label}</Badge>
            </div>
            <strong>{item.value}</strong>
            <span>{item.hint}</span>
          </article>
        ))}
      </div>

      <div className="academic-grid">
        <section className="card panel">
          <div className="panel-heading">
            <div>
              <h2>
                {role === 'TEACHER' ? 'Recent Homework' : 'Inbox Preview'}
              </h2>
              <p className="muted-text">
                {role === 'TEACHER'
                  ? 'Latest assignments you can review and follow up on.'
                  : 'Unread and recent messages that need your attention.'}
              </p>
            </div>
          </div>

          {role === 'TEACHER' ? (
            state.homework.length ? (
              <div className="portal-notice-list">
                {state.homework.slice(0, 4).map((item) => (
                  <article className="subtle-card portal-notice-card" key={item.id}>
                    <div className="portal-notice-head">
                      <strong>{item.title}</strong>
                      <Badge tone="warning">
                        Due {formatDate(item.dueDate)}
                      </Badge>
                    </div>
                    <p className="muted-text">
                      {item.class.name}
                      {item.section ? ` • ${item.section.name}` : ''}
                    </p>
                    <p className="muted-text">
                      {item.subject.name} • {item.teacher.name}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No homework yet"
                description="Assignments you create or review will appear here."
              />
            )
          ) : state.inbox.length ? (
            <div className="portal-notice-list">
              {state.inbox.slice(0, 4).map((item) => (
                <article className="subtle-card portal-notice-card" key={item.id}>
                  <div className="portal-notice-head">
                    <strong>{item.subject ?? 'No subject'}</strong>
                    <Badge tone={item.isRead ? 'neutral' : 'info'}>
                      {item.isRead ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                  <p className="muted-text">
                    From {item.sender.name} • {formatDate(item.createdAt)}
                  </p>
                  <p className="muted-text">{item.message}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Inbox is quiet"
              description="New communication from your school team will appear here."
            />
          )}
        </section>

        <section className="card panel">
          <div className="panel-heading">
            <div>
              <h2>Announcements</h2>
              <p className="muted-text">
                Role-targeted updates published by the school.
              </p>
            </div>
          </div>

          <PortalNoticeGrid
            emptyDescription="Published staff-facing notices will appear here."
            emptyTitle="No announcements"
            items={state.notices.slice(0, 4)}
          />
        </section>
      </div>

      <section className="card panel">
        <div className="panel-heading">
          <div>
            <h2>Calendar Watch</h2>
            <p className="muted-text">
              Upcoming holidays and events that affect your week.
            </p>
          </div>
        </div>

        {state.holidays.length ? (
          <HolidayYearCalendar
            className="holiday-year-shell-compact"
            description="Marked full-year calendar with a compact holiday list."
            emptyDescription="School holidays and events will appear here."
            emptyTitle="No upcoming calendar items"
            items={state.holidays}
            title="Calendar Watch"
            showHeading={false}
          />
        ) : (
          <EmptyState
            title="No upcoming calendar items"
            description="School holidays and events will appear here."
          />
        )}
      </section>
    </div>
  );
}
