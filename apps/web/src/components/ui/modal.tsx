'use client';

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        aria-modal="true"
        className={cn('ui-modal', className)}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal-header">
          <div>
            <h3>{title}</h3>
            {description ? <p className="muted-text">{description}</p> : null}
          </div>
          <button
            aria-label="Close dialog"
            className="ui-modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer ? <div className="ui-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
