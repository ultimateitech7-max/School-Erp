import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state ui-empty-state', className)}>
      {icon ? <div className="ui-empty-icon">{icon}</div> : null}
      <strong>{title}</strong>
      <p className="muted-text">{description}</p>
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </div>
  );
}
