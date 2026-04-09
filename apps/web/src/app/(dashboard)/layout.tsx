'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/academic-sessions': 'Academic Sessions',
  '/admissions': 'Admissions',
  '/attendance': 'Attendance',
  '/promotions': 'Promotions',
  '/parents': 'Parents',
  '/users': 'Users & Staff',
  '/fees': 'Fees',
  '/classes': 'Classes',
  '/sections': 'Sections',
  '/subjects': 'Subjects',
  '/timetables': 'Timetables',
  '/exam-date-sheets': 'Exam Date Sheets',
  '/homework': 'Homework',
  '/reports': 'Reports',
  '/holidays': 'Holiday Calendar',
  '/messages/inbox': 'Inbox',
  '/messages/sent': 'Sent Messages',
  '/messages/compose': 'Compose Message',
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
  '/promotions': 'Manage student progression, detention, preview checks, and history safely.',
  '/parents': 'Manage guardians, parent portal access, and linked children cleanly.',
  '/users': 'Manage staff access, role assignment, and administrative control.',
  '/fees': 'Track collection health, dues, and payment operations across the school.',
  '/classes': 'Build class structures, assign subjects, and manage academic setup.',
  '/sections': 'Configure sections, room details, and class organization.',
  '/subjects': 'Maintain subject catalog and curriculum mapping cleanly.',
  '/timetables': 'Build weekly class schedules and track teacher allocations clearly.',
  '/exam-date-sheets': 'Plan exam schedules by class with printable academic date sheets.',
  '/homework': 'Assign and review classroom work with due dates and class targeting.',
  '/reports': 'Review attendance, fees, and result performance with printable summaries.',
  '/holidays': 'Track upcoming school breaks, events, and academic calendar dates.',
  '/messages/inbox': 'Review incoming communication and unread updates.',
  '/messages/sent': 'Track outgoing messages and delivery visibility.',
  '/messages/compose': 'Send role-safe messages inside your school workspace.',
  '/notices': 'Publish targeted school announcements for dashboards and portals.',
  '/exams': 'Coordinate exams, marks entry, and result visibility from one place.',
  '/settings': 'Customize school profile, branding, and enabled modules.',
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

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
      <DashboardSidebar />
      <section className="dashboard-main">
        <header className="card page-header">
          <div>
            <span className="eyebrow">{greeting}</span>
            <h1>{titles[pathname] ?? 'School OS'}</h1>
            <p>{descriptions[pathname] ?? 'Operate your school from a refined admin workspace.'}</p>
          </div>
          <div className="page-header-meta">
            <NotificationBell />
            {session?.user.role ? (
              <Badge tone="info">{session.user.role.replace('_', ' ')}</Badge>
            ) : null}
            {session?.user.schoolId ? <Badge>School scoped</Badge> : <Badge>Platform scoped</Badge>}
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}
