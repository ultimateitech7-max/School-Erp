import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span className={cn('ui-spinner-wrap', className)}>
      <span aria-hidden="true" className="ui-spinner" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
