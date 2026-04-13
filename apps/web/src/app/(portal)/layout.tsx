'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { LogoutButton } from '@/components/dashboard/logout-button';
import { Spinner } from '@/components/ui/spinner';
import {
  AttendanceIcon,
  CalendarIcon,
  DashboardIcon,
  ExamsIcon,
  FeesIcon,
  HomeworkIcon,
  MenuIcon,
  MessageIcon,
  NoticeIcon,
} from '@/components/ui/icons';
import { useSchoolBranding } from '@/hooks/use-school-branding';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const parentPortalLinks = [
  { href: '/parent', label: 'Overview', icon: DashboardIcon },
  { href: '/parent/attendance', label: 'Attendance', icon: AttendanceIcon },
  { href: '/parent/fees', label: 'Fees', icon: FeesIcon },
  { href: '/parent/exams', label: 'Exams', icon: ExamsIcon },
  { href: '/parent/homework', label: 'Homework', icon: HomeworkIcon },
  { href: '/parent/notices', label: 'Notices', icon: NoticeIcon },
  { href: '/parent/holidays', label: 'Holidays', icon: CalendarIcon },
  { href: '/parent/messages', label: 'Messages', icon: MessageIcon },
];

const studentPortalLinks = [
  { href: '/student', label: 'Overview', icon: DashboardIcon },
  { href: '/student/attendance', label: 'Attendance', icon: AttendanceIcon },
  { href: '/student/fees', label: 'Fees', icon: FeesIcon },
  { href: '/student/exams', label: 'Exams', icon: ExamsIcon },
  { href: '/student/homework', label: 'Homework', icon: HomeworkIcon },
  { href: '/student/notices', label: 'Notices', icon: NoticeIcon },
  { href: '/student/holidays', label: 'Holidays', icon: CalendarIcon },
  { href: '/student/messages', label: 'Messages', icon: MessageIcon },
];

const parentTitles: Record<string, string> = {
  '/parent': 'Parent Dashboard',
  '/parent/attendance': 'Attendance',
  '/parent/fees': 'Fees',
  '/parent/exams': 'Exams',
  '/parent/results': 'Results',
  '/parent/homework': 'Homework',
  '/parent/notices': 'Notices',
  '/parent/holidays': 'Holidays',
  '/parent/messages': 'Messages',
};

const studentTitles: Record<string, string> = {
  '/student': 'Student Dashboard',
  '/student/attendance': 'Attendance',
  '/student/fees': 'Fees',
  '/student/exams': 'Exams',
  '/student/results': 'Results',
  '/student/homework': 'Homework',
  '/student/notices': 'Notices',
  '/student/holidays': 'Holidays',
  '/student/messages': 'Messages',
};

const parentDescriptions: Record<string, string> = {
  '/parent': 'Track your linked children, attendance, fees, and school updates from one place.',
  '/parent/attendance': 'Review linked child attendance and daily presence trends.',
  '/parent/fees': 'Track dues, payments, and receipt history for linked children.',
  '/parent/exams': 'Review upcoming date sheets and completed exams for linked children.',
  '/parent/results': 'Review exam results and report-card performance clearly.',
  '/parent/homework': 'Stay updated with assigned homework and due dates.',
  '/parent/notices': 'Read published school notices and parent-facing updates.',
  '/parent/holidays': 'Keep an eye on school holidays and event closures.',
  '/parent/messages': 'Send and review communication from the portal workspace.',
};

const studentDescriptions: Record<string, string> = {
  '/student': 'Track your academics, attendance, fees, and school updates from one place.',
  '/student/attendance': 'Review your attendance summary and recent records.',
  '/student/fees': 'Track fee status, receipts, and payment history.',
  '/student/exams': 'Review upcoming date sheets and completed exams from one place.',
  '/student/results': 'Review published marks, exams, and result summaries.',
  '/student/homework': 'Keep up with current homework, due dates, and subjects.',
  '/student/notices': 'Read student-facing notices and school announcements.',
  '/student/holidays': 'Review school holidays and upcoming event closures.',
  '/student/messages': 'Send and review portal messages from one place.',
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const { branding } = useSchoolBranding(session);

  useEffect(() => {
    const storedSession = getStoredAuthSession();
    const token = storedSession?.accessToken ?? localStorage.getItem('accessToken');

    if (!token) {
      router.replace('/login');
      return;
    }

    if (
      storedSession?.user.role !== 'PARENT' &&
      storedSession?.user.role !== 'STUDENT'
    ) {
      router.replace('/');
      return;
    }

    setSession(storedSession);
    setReady(true);
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="dashboard-loading-shell">
        <Spinner label="Loading portal..." />
      </div>
    );
  }

  const isParentPortal = session?.user.role === 'PARENT';
  const links = isParentPortal ? parentPortalLinks : studentPortalLinks;
  const titleMap = isParentPortal ? parentTitles : studentTitles;
  const descriptionMap = isParentPortal
    ? parentDescriptions
    : studentDescriptions;
  const currentTitle = titleMap[pathname] ?? (isParentPortal ? 'Parent Portal' : 'Student Portal');
  const currentDescription =
    descriptionMap[pathname] ??
    (isParentPortal
      ? 'Manage your linked children and stay aligned with school activity.'
      : 'Stay on top of your academics and school activity.');
  const portalLabel = isParentPortal ? 'Parent Portal' : 'Student Portal';
  const roleSummary = isParentPortal
    ? 'Parent access with child-focused visibility'
    : 'Student access with personal academic visibility';

  return (
    <div className="dashboard-shell">
      <button
        aria-label="Open navigation"
        className="sidebar-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MenuIcon />
      </button>

      <div
        className={`sidebar-overlay${open ? ' sidebar-overlay-open' : ''}`}
        onClick={() => setOpen(false)}
        role="presentation"
      />

      <aside className={`sidebar card${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-rail">
          <div className="sidebar-rail-nav">
            {links.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  aria-label={item.label}
                  className={`sidebar-rail-link${isActive ? ' sidebar-rail-link-active' : ''}`}
                  href={item.href}
                  key={`rail-${item.href}`}
                  title={item.label}
                >
                  <Icon className="nav-link-icon" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="sidebar-expanded">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">
              {branding?.logoUrl ? (
                <img
                  alt={`${branding.schoolName} logo`}
                  className="school-brand-logo"
                  src={branding.logoUrl}
                />
              ) : (
                <DashboardIcon />
              )}
            </div>
            <div className="sidebar-brand-copy">
              <span className="eyebrow">
                {branding?.schoolCode?.toUpperCase() ?? portalLabel}
              </span>
              <h2>{branding?.schoolName ?? portalLabel}</h2>
              <p className="muted-text">
                {branding?.website?.replace(/^https?:\/\//, '') ?? roleSummary}
              </p>
            </div>
          </div>

          <div className="sidebar-profile">
            <div className="sidebar-avatar">
              {session?.user.name?.slice(0, 1).toUpperCase() ?? 'P'}
            </div>
            <div className="sidebar-profile-copy">
              <strong>{session?.user.name ?? 'Portal User'}</strong>
              <p className="muted-text">{portalLabel}</p>
            </div>
          </div>

          <nav className="nav-list">
            {links.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  className={`nav-link${isActive ? ' nav-link-active' : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="nav-link-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="card page-header">
          <div className="page-header-copy">
            <span className="eyebrow">{portalLabel}</span>
            <h1>{currentTitle}</h1>
            <p>{currentDescription}</p>
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
                      'Portal access'}
                  </span>
                </div>
              </div>
            ) : null}
            <NotificationBell />
          </div>
        </header>

        <main className="portal-main">{children}</main>
      </section>
    </div>
  );
}
