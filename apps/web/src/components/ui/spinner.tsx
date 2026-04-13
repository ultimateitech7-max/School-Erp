import { cn } from '@/utils/cn';

const brandLetters = ['S', 'O', 'F', 'R', 'A'] as const;

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span aria-live="polite" className={cn('ui-spinner-wrap', className)} role="status">
      <span aria-hidden="true" className="ui-spinner-wordmark">
        {brandLetters.map((letter, index) => (
          <span
            className="ui-spinner-letter"
            key={`${letter}-${index}`}
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            {letter}
          </span>
        ))}
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
