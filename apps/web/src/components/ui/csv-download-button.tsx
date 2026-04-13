'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DownloadIcon } from '@/components/ui/icons';

interface CsvDownloadButtonProps {
  label?: string;
  loadingLabel?: string;
  onDownload: () => Promise<void>;
  className?: string;
}

export function CsvDownloadButton({
  label = 'Download CSV',
  loadingLabel = 'Preparing CSV...',
  onDownload,
  className,
}: CsvDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      await onDownload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={className}
      disabled={loading}
      onClick={() => void handleClick()}
      startIcon={<DownloadIcon />}
      type="button"
      variant="secondary"
    >
      {loading ? loadingLabel : label}
    </Button>
  );
}
