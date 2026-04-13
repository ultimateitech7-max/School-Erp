'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';
import type { SchoolBrandingView } from '@/hooks/use-school-branding';
import { useAuth } from '@/hooks/use-auth';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import type { UserRole } from '@/utils/api';
import {
  AcademicIcon,
  AttendanceIcon,
  CalendarIcon,
  DashboardIcon,
  ExamsIcon,
  FeesIcon,
  HomeworkIcon,
  LogoutIcon,
  MenuIcon,
  MessageIcon,
  NoticeIcon,
  ReportIcon,
  SettingsIcon,
  StudentsIcon,
  UsersIcon,
} from '@/components/ui/icons';

interface NavItem {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
  roles: UserRole[];
  requiredPermissions?: string[];
}

const dashboardNavItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: DashboardIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'],
  },
  {
    href: '/activity-logs',
    label: 'Activity Logs',
    icon: ReportIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
  {
    href: '/schools',
    label: 'Schools',
    icon: UsersIcon,
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/students',
    label: 'Students',
    icon: StudentsIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['students.read'],
  },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: AttendanceIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    requiredPermissions: ['attendance.read'],
  },
  {
    href: '/academic-sessions',
    label: 'Academic Sessions',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/admissions',
    label: 'Admissions',
    icon: StudentsIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['students.read'],
  },
  {
    href: '/parents',
    label: 'Parents',
    icon: UsersIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['students.read'],
  },
  {
    href: '/promotions',
    label: 'Promotions',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/users',
    label: 'Users & Staff',
    icon: UsersIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
  {
    href: '/fees',
    label: 'Fees',
    icon: FeesIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
  {
    href: '/fee-submissions',
    label: 'Fee Submissions',
    icon: FeesIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['fees.manage'],
  },
  {
    href: '/classes',
    label: 'Classes',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/sections',
    label: 'Sections',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/subjects',
    label: 'Subjects',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/timetables',
    label: 'Timetables',
    icon: AcademicIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    requiredPermissions: ['academics.read'],
  },
  {
    href: '/exam-date-sheets',
    label: 'Exam Date Sheets',
    icon: ExamsIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['exams.read'],
  },
  {
    href: '/homework',
    label: 'Homework',
    icon: HomeworkIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    requiredPermissions: ['homework.read'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: ReportIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['reports.read'],
  },
  {
    href: '/holidays',
    label: 'Holidays',
    icon: CalendarIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['calendar.read'],
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: CalendarIcon,
    roles: ['TEACHER', 'STAFF'],
    requiredPermissions: ['calendar.read'],
  },
  {
    href: '/notices',
    label: 'Notices',
    icon: NoticeIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    requiredPermissions: ['communication.read'],
  },
  {
    href: '/announcements',
    label: 'Announcements',
    icon: NoticeIcon,
    roles: ['TEACHER', 'STAFF'],
  },
  {
    href: '/messages/inbox',
    label: 'Messages',
    icon: MessageIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'],
  },
  {
    href: '/exams',
    label: 'Exams & Results',
    icon: ExamsIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    requiredPermissions: ['exams.read'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  },
];

interface DashboardSidebarProps {
  branding?: SchoolBrandingView | null;
}

export function DashboardSidebar({ branding }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [session, setSession] = useState<AuthSession | null>(() =>
    getStoredAuthSession(),
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const resolvedNavItems = useMemo(
    () => {
      if (!session?.user.role) {
        return [];
      }

      const grantedPermissions = new Set(session.permissions ?? []);

      return dashboardNavItems.filter((item) => {
        if (!item.roles.includes(session.user.role)) {
          return false;
        }

        if (!item.requiredPermissions?.length) {
          return true;
        }

        return item.requiredPermissions.every((permission) =>
          grantedPermissions.has(permission),
        );
      });
    },
    [session?.permissions, session?.user.role],
  );

  return (
    <>
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
            {resolvedNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/' && pathname === '/dashboard') ||
                (item.href !== '/' && pathname.startsWith(item.href));
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

          <button
            aria-label="Sign out"
            className="sidebar-rail-link sidebar-rail-logout"
            onClick={() => void logout()}
            type="button"
          >
            <LogoutIcon className="nav-link-icon" />
          </button>
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
                {branding?.schoolCode?.toUpperCase() ?? 'School Workspace'}
              </span>
              <h2>{branding?.schoolName ?? 'Operations Hub'}</h2>
              <p className="muted-text">
                {branding?.website?.replace(/^https?:\/\//, '') ??
                  'Premium admin workspace'}
              </p>
            </div>
          </div>

          <div className="sidebar-profile">
            <div className="sidebar-avatar">
              {session?.user.name?.slice(0, 1).toUpperCase() ?? 'A'}
            </div>
            <div className="sidebar-profile-copy">
              <strong>{session?.user.name ?? 'Administrator'}</strong>
              <span className="muted-text">
                {session?.user.role?.replace('_', ' ') ?? 'School team'}
              </span>
            </div>
          </div>

          <nav className="nav-list">
            {resolvedNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/' && pathname === '/dashboard') ||
                (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  className={`nav-link${isActive ? ' nav-link-active' : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="nav-link-icon" />
                  <span className="nav-link-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
