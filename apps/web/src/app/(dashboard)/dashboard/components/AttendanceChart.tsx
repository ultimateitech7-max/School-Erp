'use client';

import type { DashboardAttendancePoint } from '@/utils/api';

interface AttendanceChartProps {
  points: DashboardAttendancePoint[];
}

const chartSeries = [
  { key: 'present', label: 'Present', className: 'chart-bar-present' },
  { key: 'absent', label: 'Absent', className: 'chart-bar-absent' },
  { key: 'late', label: 'Late', className: 'chart-bar-late' },
  { key: 'leave', label: 'Leave', className: 'chart-bar-leave' },
] as const;

export function AttendanceChart({ points }: AttendanceChartProps) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) =>
      chartSeries.map((series) => point[series.key] ?? 0),
    ),
  );

  return (
    <div className="chart-panel">
      <div className="chart-legend">
        {chartSeries.map((series) => (
          <span className="chart-legend-item" key={series.key}>
            <i className={`chart-dot ${series.className}`} />
            {series.label}
          </span>
        ))}
      </div>

      {points.length === 0 ? (
        <div className="empty-state">
          <strong>No attendance data</strong>
          <p className="muted-text">Attendance records will appear here once marked.</p>
        </div>
      ) : (
        <div className="attendance-chart-grid">
          {points.map((point) => (
            <div className="attendance-chart-column" key={point.label}>
              <div className="attendance-chart-bars">
                {chartSeries.map((series) => (
                  <div
                    aria-label={`${series.label}: ${point[series.key]}`}
                    className={`attendance-chart-bar ${series.className}`}
                    key={series.key}
                    style={{
                      height: `${Math.max(
                        (point[series.key] / maxValue) * 160,
                        point[series.key] > 0 ? 12 : 6,
                      )}px`,
                    }}
                    title={`${series.label}: ${point[series.key]}`}
                  />
                ))}
              </div>
              <span className="attendance-chart-label">{point.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
