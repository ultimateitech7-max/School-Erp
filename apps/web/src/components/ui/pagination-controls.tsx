'use client';

import { Button } from './button';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  limit,
  total,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="pagination-bar">
      <Button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        startIcon={<ChevronLeftIcon />}
        type="button"
        variant="secondary"
      >
        Previous
      </Button>
      <span className="pagination-label">
        Page {page} of {totalPages}
      </span>
      <Button
        disabled={page >= totalPages}
        endIcon={<ChevronRightIcon />}
        onClick={() => onPageChange(page + 1)}
        type="button"
        variant="secondary"
      >
        Next
      </Button>
    </div>
  );
}
