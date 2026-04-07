'use client';

import type { DashboardFeePoint } from '@/utils/api';

interface FeeChartProps {
  points: DashboardFeePoint[];
}

export function FeeChart({ points }: FeeChartProps) {
  const width = 640;
  const height = 220;
  const padding = 32;
  const maxValue = Math.max(1, ...points.map((point) => point.total));

  const polylinePoints = points
    .map((point, index) => {
      const x =
        padding +
        (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
      const y =
        height - padding - (point.total / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = points.length
    ? `${padding},${height - padding} ${polylinePoints} ${
        width - padding
      },${height - padding}`
    : '';

  return (
    <div className="chart-panel">
      {points.length === 0 ? (
        <div className="empty-state">
          <strong>No payment history</strong>
          <p className="muted-text">Fee collection trends will appear here.</p>
        </div>
      ) : (
        <>
          <svg
            className="line-chart"
            viewBox={`0 0 ${width} ${height}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="feeChartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(15, 118, 110, 0.28)" />
                <stop offset="100%" stopColor="rgba(15, 118, 110, 0.03)" />
              </linearGradient>
            </defs>

            <path
              className="line-chart-area"
              d={`M ${areaPoints}`}
              fill="url(#feeChartFill)"
            />
            <polyline
              className="line-chart-path"
              fill="none"
              points={polylinePoints}
            />

            {points.map((point, index) => {
              const x =
                padding +
                (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
              const y =
                height - padding - (point.total / maxValue) * (height - padding * 2);

              return <circle className="line-chart-dot" cx={x} cy={y} key={point.label} r="4" />;
            })}
          </svg>

          <div className="line-chart-labels">
            {points.map((point) => (
              <div className="line-chart-label" key={point.label}>
                <strong>{point.label}</strong>
                <span>INR {point.total.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
