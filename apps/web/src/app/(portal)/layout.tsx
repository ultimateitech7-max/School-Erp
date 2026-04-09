'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { LogoutButton } from '@/components/dashboard/logout-button';
import { Spinner } from '@/components/ui/spinner';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';

const parentPortalLinks = [
  { href: '/parent', label: 'Overview' },
  { href: '/parent/attendance', label: 'Attendance' },
  { href: '/parent/fees', label: 'Fees' },
  { href: '/parent/results', label: 'Results' },
];

const studentPortalLinks = [
  { href: '/student', label: 'Overview' },
  { href: '/student/attendance', label: 'Attendance' },
  { href: '/student/fees', label: 'Fees' },
  { href: '/student/results', label: 'Results' },
];

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

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

  if (!ready) {
    return (
      <div className="dashboard-loading-shell">
        <Spinner label="Loading portal..." />
      </div>
    );
  }

  const isParentPortal = session?.user.role === 'PARENT';
  const links = isParentPortal ? parentPortalLinks : studentPortalLinks;

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <div>
          <span className="eyebrow">{isParentPortal ? 'Parent Portal' : 'Student Portal'}</span>
          <h1>{session?.user.name ?? 'Portal Workspace'}</h1>
          <p className="muted-text">
            {isParentPortal
              ? 'View your linked children, attendance, fees, and results in one place.'
              : 'Track your academics, attendance, fees, and results in one place.'}
          </p>
        </div>
        <div className="portal-topbar-actions">
          <nav className="portal-nav">
            {links.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  className={`portal-nav-link${isActive ? ' portal-nav-link-active' : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
