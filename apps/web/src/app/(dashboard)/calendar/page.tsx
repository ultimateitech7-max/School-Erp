'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { HolidayYearCalendar } from '@/components/ui/holiday-year-calendar';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch, type ApiSuccessResponse, type HolidayRecord } from '@/utils/api';

export default function CalendarPage() {
  const [items, setItems] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void apiFetch<ApiSuccessResponse<HolidayRecord[]>>('/holidays')
      .then((response) => {
        setItems(response.data);
      })
      .catch((loadError) => {
        setItems([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load calendar items.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="card panel">
        <Spinner label="Loading calendar..." />
      </section>
    );
  }

  return (
    <section className="card panel">
      {error ? <Banner tone="error">{error}</Banner> : null}

      <HolidayYearCalendar
        description="Review the full school year with holidays and events marked directly on the calendar."
        emptyDescription="Upcoming holidays and events will appear here."
        emptyTitle="No calendar items"
        items={items}
        title="School Calendar"
      />
    </section>
  );
}
