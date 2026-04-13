'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { Badge } from '@/components/ui/badge';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useSchoolBranding } from '@/hooks/use-school-branding';
import { useSchoolScope } from '@/hooks/use-school-scope';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import {
  apiFetch,
  type ApiSuccessResponse,
  type UserOptionsPayload,
  type UserRole,
} from '@/utils/api';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/academic-sessions': 'Academic Sessions',
  '/admissions': 'Admissions',
  '/attendance': 'Attendance',
  '/activity-logs': 'Activity Logs',
  '/schools': 'Schools',
  '/promotions': 'Promotions',
  '/parents': 'Parents',
  '/users': 'Users & Staff',
  '/fees': 'Fees',
  '/classes': 'Classes',
  '/sections': 'Sections',
  '/subjects': 'Subjects',
  '/timetables': 'Timetables',
  '/exam-date-sheets': 'Exam Date Sheets',
  '/fee-submissions': 'Fee Submissions',
  '/homework': 'Homework',
  '/reports': 'Reports',
  '/holidays': 'Holiday Calendar',
  '/calendar': 'School Calendar',
  '/announcements': 'Announcements',
  '/messages/inbox': 'School Chat',
  '/messages/sent': 'School Chat',
  '/messages/compose': 'School Chat',
  '/notices': 'Notice Board',
  '/exams': 'Exams & Results',
  '/settings': 'Settings',
};

const descriptions: Record<string, string> = {
  '/': 'Track school performance, finances, academics, and staff operations in one view.',
  '/dashboard': 'Review the latest analytics, performance trends, and key activities.',
  '/students': 'Manage admissions, academic placement, and student lifecycle operations.',
  '/academic-sessions': 'Create and manage school-specific academic year timelines securely.',
  '/admissions': 'Track fresh applications, approvals, and student onboarding from one place.',
  '/attendance': 'Capture daily attendance, filters, and summaries with less friction.',
  '/activity-logs': 'Review school-wide user activity and drill into person-specific actions.',
  '/schools': 'Create schools, provision school admins, and manage tenant onboarding.',
  '/promotions': 'Manage student progression, detention, preview checks, and history safely.',
  '/parents': 'Manage guardians, parent portal access, and linked children cleanly.',
  '/users': 'Manage staff access, role assignment, and administrative control.',
  '/fees': 'Create fee structures, assign dues, and manage school fee setup.',
  '/classes': 'Build class structures, assign subjects, and manage academic setup.',
  '/sections': 'Configure sections, room details, and class organization.',
  '/subjects': 'Maintain subject catalog and curriculum mapping cleanly.',
  '/timetables': 'Build weekly class schedules and track teacher allocations clearly.',
  '/exam-date-sheets': 'Plan exam schedules by class with printable academic date sheets.',
  '/fee-submissions': 'Search students quickly and submit fee payments from a dedicated desk.',
  '/homework': 'Assign and review classroom work with due dates and class targeting.',
  '/reports': 'Review attendance, fees, and result performance with printable summaries.',
  '/holidays': 'Track upcoming school breaks, events, and academic calendar dates.',
  '/calendar': 'Review upcoming holidays and school events relevant to your role.',
  '/announcements': 'Read school-wide updates, reminders, and role-targeted notices.',
  '/messages/inbox': 'Chat with any school user in one thread-based workspace.',
  '/messages/sent': 'Chat with any school user in one thread-based workspace.',
  '/messages/compose': 'Start a new chat by selecting a role and a person.',
  '/notices': 'Publish targeted school announcements for dashboards and portals.',
  '/exams': 'Coordinate exams, marks entry, and result visibility from one place.',
  '/settings': 'Customize school profile, branding, and enabled modules.',
};

function resolveTitle(pathname: string, role?: UserRole) {
  if (pathname === '/' || pathname === '/dashboard') {
    if (role === 'TEACHER') {
      return 'Teacher Dashboard';
    }

    if (role === 'STAFF') {
      return 'Staff Dashboard';
    }
  }

  return titles[pathname] ?? 'School OS';
}

function resolveDescription(pathname: string, role?: UserRole) {
  if (pathname === '/' || pathname === '/dashboard') {
    if (role === 'TEACHER') {
      return 'Stay focused on classes, attendance, homework, marks, and school communication.';
    }

    if (role === 'STAFF') {
      return 'Stay focused on communication, coordination, announcements, and school calendar updates.';
    }
  }

  return (
    descriptions[pathname] ?? 'Operate your school from a refined admin workspace.'
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<UserOptionsPayload['schools']>([]);
  const { selectedSchoolId, setSelectedSchoolId } = useSchoolScope();
  const { branding } = useSchoolBranding(session);

  useEffect(() => {
    const storedSession = getStoredAuthSession();
    const token = storedSession?.accessToken ?? localStorage.getItem('accessToken');

    if (!token) {
      router.replace('/login');
      return;
    }

    if (storedSession?.user.role === 'PARENT') {
      router.replace('/parent');
      return;
    }

    if (storedSession?.user.role === 'STUDENT') {
      router.replace('/student');
      return;
    }

    setSession(storedSession);
    setSessionLoaded(true);
  }, [router]);

  useEffect(() => {
    if (session?.user.role !== 'SUPER_ADMIN') {
      return;
    }

    void apiFetch<ApiSuccessResponse<UserOptionsPayload>>('/users/options')
      .then((response) => {
        setSchoolOptions(response.data.schools);

        if (
          !selectedSchoolId &&
          response.data.currentSchoolId &&
          response.data.schools.some((school) => school.id === response.data.currentSchoolId)
        ) {
          setSelectedSchoolId(response.data.currentSchoolId);
        }
      })
      .catch(() => {
        setSchoolOptions([]);
      });
  }, [selectedSchoolId, session?.user.role, setSelectedSchoolId]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }, []);

  if (!sessionLoaded) {
    return (
      <div className="dashboard-loading-shell">
        <Spinner label="Loading workspace..." />
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar branding={branding} />
      <section className="dashboard-main">
        <header className="card page-header">
          <div className="page-header-copy">
            <span className="eyebrow">{greeting}</span>
            <h1>{resolveTitle(pathname, session?.user.role)}</h1>
            <p>{resolveDescription(pathname, session?.user.role)}</p>
          </div>
          <div className="page-header-meta">
            {branding ? (
              <div className="page-header-school">
                <div className="school-brand-mark page-header-school-mark">
                  {branding.logoUrl ? (
                    <img
                      alt={`${branding.schoolName} logo`}
                      className="school-brand-logo"
                      src={branding.logoUrl}
                    />
                  ) : (
                    <span>{branding.schoolName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="page-header-school-copy">
                  <strong>{branding.schoolName}</strong>
                  <span className="muted-text">
                    {branding.schoolCode?.toUpperCase() ??
                      branding.website?.replace(/^https?:\/\//, '') ??
                      'School workspace'}
                  </span>
                </div>
              </div>
            ) : null}
            {session?.user.role === 'SUPER_ADMIN' ? (
              <div className="page-header-scope">
                <Field
                  className="page-header-scope-field"
                  hint="Select a school to work in school-scoped modules."
                  label="School Scope"
                >
                  <Select
                    onChange={(event) =>
                      setSelectedSchoolId(event.target.value || null)
                    }
                    value={selectedSchoolId ?? ''}
                  >
                    <option value="">Select school</option>
                    {schoolOptions.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : null}
            <NotificationBell />
            {session?.user.role ? (
              <Badge tone="info">{session.user.role.replace('_', ' ')}</Badge>
            ) : null}
            {session?.user.role === 'SUPER_ADMIN' ? (
              selectedSchoolId ? (
                <Badge>School selected</Badge>
              ) : (
                <Badge tone="warning">Select school</Badge>
              )
            ) : session?.user.schoolId ? (
              <Badge>School scoped</Badge>
            ) : (
              <Badge>Platform scoped</Badge>
            )}
          </div>
        </header>
        <div key={`${pathname}:${selectedSchoolId ?? 'platform-scope'}`}>{children}</div>
      </section>
    </div>
  );
}
