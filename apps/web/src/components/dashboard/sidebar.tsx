'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';
import { useAuth } from '@/hooks/use-auth';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import {
  AcademicIcon,
  AttendanceIcon,
  DashboardIcon,
  ExamsIcon,
  FeesIcon,
  LogoutIcon,
  MenuIcon,
  SettingsIcon,
  StudentsIcon,
  UsersIcon,
} from '@/components/ui/icons';

const baseNavItems = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/students', label: 'Students', icon: StudentsIcon },
  { href: '/attendance', label: 'Attendance', icon: AttendanceIcon },
];
const adminNavItems = [
  { href: '/users', label: 'Users & Staff', icon: UsersIcon },
  { href: '/fees', label: 'Fees', icon: FeesIcon },
  { href: '/classes', label: 'Classes', icon: AcademicIcon },
  { href: '/sections', label: 'Sections', icon: AcademicIcon },
  { href: '/subjects', label: 'Subjects', icon: AcademicIcon },
  { href: '/exams', label: 'Exams & Results', icon: ExamsIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function DashboardSidebar() {
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

  const navItems = useMemo(
    () =>
      session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'SCHOOL_ADMIN'
        ? [...baseNavItems, ...adminNavItems]
        : baseNavItems,
    [session?.user.role],
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
            {navItems.map((item) => {
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
              <DashboardIcon />
            </div>
            <div className="sidebar-brand-copy">
              <span className="eyebrow">School OS</span>
              <h2>Operations Hub</h2>
              <p className="muted-text">Premium admin workspace</p>
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
            {navItems.map((item) => {
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
