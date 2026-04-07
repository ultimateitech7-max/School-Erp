'use client';

import type { AttendanceSummaryRecord } from '@/utils/api';

interface AttendanceSummaryProps {
  loading: boolean;
  summary: AttendanceSummaryRecord;
}

export function AttendanceSummary({
  loading,
  summary,
}: AttendanceSummaryProps) {
  const items = [
    { label: 'Present', value: summary.totalPresent },
    { label: 'Absent', value: summary.totalAbsent },
    { label: 'Late', value: summary.totalLate },
    { label: 'Leave', value: summary.totalLeave },
  ];

  return (
    <section className="attendance-summary-grid">
      {items.map((item) => (
        <article className="card attendance-card" key={item.label}>
          <p>{item.label}</p>
          <strong>{loading ? '...' : item.value}</strong>
        </article>
      ))}
    </section>
  );
}
