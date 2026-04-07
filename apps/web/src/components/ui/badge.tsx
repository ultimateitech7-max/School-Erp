import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge-${tone}`, className)}>{children}</span>
  );
}
