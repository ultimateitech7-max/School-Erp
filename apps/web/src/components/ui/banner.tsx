import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BannerProps {
  children: ReactNode;
  tone?: 'success' | 'error' | 'info';
  className?: string;
}

export function Banner({
  children,
  tone = 'info',
  className,
}: BannerProps) {
  return (
    <section className={cn('card panel banner', `banner-${tone}`, className)} role="status">
      {children}
    </section>
  );
}
