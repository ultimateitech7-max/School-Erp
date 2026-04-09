'use client';

import { Badge } from '@/components/ui/badge';

export interface TimelineItemRecord {
  id: string;
  type: 'ENROLLED' | 'PROMOTED' | 'DETAINED' | 'RESULT';
  title: string;
  description: string;
  dateLabel: string;
  sortValue: string;
  meta?: string;
  tone: 'info' | 'success' | 'warning';
}

interface TimelineItemProps {
  item: TimelineItemRecord;
  isLatest: boolean;
}

export function TimelineItem({ item, isLatest }: TimelineItemProps) {
  return (
    <article
      className={`timeline-item ${isLatest ? 'timeline-item-latest' : ''}`}
    >
      <div className={`timeline-dot timeline-dot-${item.tone}`} aria-hidden="true" />
      <div className="timeline-line" aria-hidden="true" />
      <div className="timeline-card">
        <div className="timeline-card-header">
          <Badge tone={item.tone}>{item.type}</Badge>
          <span className="muted-text">{item.dateLabel}</span>
        </div>
        <strong>{item.title}</strong>
        <p className="muted-text">{item.description}</p>
        {item.meta ? <span className="timeline-meta">{item.meta}</span> : null}
      </div>
    </article>
  );
}
