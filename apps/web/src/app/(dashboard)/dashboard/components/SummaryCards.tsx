'use client';

import { Badge } from '@/components/ui/badge';

interface SummaryCardItem {
  label: string;
  value: string;
  hint: string;
}

interface SummaryCardsProps {
  items: SummaryCardItem[];
}

export function SummaryCards({ items }: SummaryCardsProps) {
  return (
    <section className="summary-cards-grid">
      {items.map((item, index) => (
        <article className="card summary-card" key={item.label}>
          <div className="summary-card-top">
            <Badge tone="info">Metric {String(index + 1).padStart(2, '0')}</Badge>
            <span className="summary-card-trend">Live</span>
          </div>
          <p>{item.label}</p>
          <strong>{item.value}</strong>
          <span>{item.hint}</span>
        </article>
      ))}
    </section>
  );
}
