'use client';

import { Button } from './button';
import { Modal } from './modal';
import { AlertIcon } from './icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      description={description}
      footer={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            startIcon={<AlertIcon />}
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <div className="ui-confirm">
        <div className="ui-confirm-icon">
          <AlertIcon />
        </div>
        <p className="muted-text">{description}</p>
      </div>
    </Modal>
  );
}
