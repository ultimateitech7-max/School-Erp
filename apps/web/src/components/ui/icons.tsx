import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface IconProps {
  className?: string;
}

function createIcon(path: ReactNode) {
  return function Icon({ className }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        className={cn('ui-icon', className)}
        fill="none"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        {path}
      </svg>
    );
  };
}

export const MenuIcon = createIcon(
  <>
    <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const DashboardIcon = createIcon(
  <>
    <rect height="7" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="4" y="4" />
    <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="13" y="4" />
    <rect height="11" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="4" y="13" />
    <rect height="7" rx="2" stroke="currentColor" strokeWidth="1.8" width="7" x="13" y="17" />
  </>,
);

export const StudentsIcon = createIcon(
  <>
    <path d="M12 6.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M4 10.5a2.5 2.5 0 0 1 2.5-2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M17.5 8a2.5 2.5 0 0 1 2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const UsersIcon = createIcon(
  <>
    <path d="M8.5 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M15.5 6.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4.5 18a4 4 0 0 1 8 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M13.5 18a3 3 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const AcademicIcon = createIcon(
  <>
    <path d="M4 9.5L12 5l8 4.5L12 14L4 9.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M7 11.5V16l5 3l5-3v-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </>,
);

export const FeesIcon = createIcon(
  <>
    <path d="M12 4v16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M16.5 7.5c0-1.38-1.79-2.5-4-2.5s-4 1.12-4 2.5c0 3.5 8 1.5 8 5c0 1.38-1.79 2.5-4 2.5s-4-1.12-4-2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const AttendanceIcon = createIcon(
  <>
    <rect height="16" rx="3" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="5" />
    <path d="M8 3v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M16 3v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m8.5 14 2 2 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </>,
);

export const ExamsIcon = createIcon(
  <>
    <path d="M7 4.5h7l4 4V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M14 4.5v4h4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M8.5 14h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M8.5 17h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const SettingsIcon = createIcon(
  <>
    <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M19.4 15.1c.09-.34.15-.7.15-1.1s-.06-.76-.15-1.1l2.06-1.6-2-3.46-2.48.7a7.83 7.83 0 0 0-1.9-1.1L14.7 4h-4.04l-.42 2.45c-.68.25-1.32.63-1.9 1.1l-2.48-.7-2 3.46 2.06 1.6A4.88 4.88 0 0 0 4.77 14c0 .4.06.76.15 1.1l-2.06 1.6 2 3.46 2.48-.7c.58.47 1.22.85 1.9 1.1l.42 2.45h4.04l.42-2.45c.68-.25 1.32-.63 1.9-1.1l2.48.7 2-3.46-2.06-1.6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4" />
  </>,
);

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
    <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const ChevronLeftIcon = createIcon(
  <path d="m14.5 6-5 6 5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
);

export const ChevronRightIcon = createIcon(
  <path d="m9.5 6 5 6-5 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
);

export const LogoutIcon = createIcon(
  <>
    <path d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M14 16l5-4-5-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M19 12H9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const CheckIcon = createIcon(
  <path d="m5.5 12.5 4 4 9-9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
);

export const AlertIcon = createIcon(
  <>
    <path d="M12 9v4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M12 17h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    <path d="M10.2 4.9 3.9 16a2 2 0 0 0 1.74 3h12.72A2 2 0 0 0 20.1 16L13.8 4.9a2 2 0 0 0-3.48 0Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
  </>,
);

export const NoticeIcon = createIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0v4l2 2v1H4v-1l2-2V8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const MessageIcon = createIcon(
  <>
    <path d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M8 10.5h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M8 13.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const CalendarIcon = createIcon(
  <>
    <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 3v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M16 3v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
  </>,
);

export const HomeworkIcon = createIcon(
  <>
    <path d="M7 4.5h10a2 2 0 0 1 2 2V19a1.5 1.5 0 0 1-2.46 1.15L12 16.5l-4.54 3.65A1.5 1.5 0 0 1 5 19V6.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M9 9h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M9 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const ReportIcon = createIcon(
  <>
    <path d="M5 19.5h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M8 17V11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M12 17V7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M16 17v-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);

export const DownloadIcon = createIcon(
  <>
    <path d="M12 4v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path
      d="m8.5 10.5 3.5 3.5 3.5-3.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path d="M5 19.5h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </>,
);
