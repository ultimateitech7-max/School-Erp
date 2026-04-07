'use client';

import type { DashboardClassDistributionRecord } from '@/utils/api';

interface ClassDistributionChartProps {
  items: DashboardClassDistributionRecord[];
}

export function ClassDistributionChart({ items }: ClassDistributionChartProps) {
  const maxValue = Math.max(1, ...items.map((item) => item.totalStudents));

  return (
    <div className="distribution-list">
      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No class distribution data</strong>
          <p className="muted-text">Student class allocation will appear here.</p>
        </div>
      ) : (
        items.map((item) => (
          <div className="distribution-row" key={item.id}>
            <div className="distribution-row-copy">
              <strong>{item.className}</strong>
              <span>{item.classCode}</span>
            </div>
            <div className="distribution-row-bar">
              <div
                className="distribution-row-fill"
                style={{
                  width: `${Math.max((item.totalStudents / maxValue) * 100, 6)}%`,
                }}
              />
            </div>
            <span className="distribution-row-value">{item.totalStudents}</span>
          </div>
        ))
      )}
    </div>
  );
}
