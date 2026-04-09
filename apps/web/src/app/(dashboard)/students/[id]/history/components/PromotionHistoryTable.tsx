'use client';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type { PromotionRecord } from '@/utils/api';

interface PromotionHistoryTableProps {
  records: PromotionRecord[];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function PromotionHistoryTable({
  records,
}: PromotionHistoryTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        description="Promotion actions will appear here once the student is promoted or detained."
        title="No promotion history found."
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Promotion History</h2>
          <p className="muted-text">
            Preserved promotion and detention records across sessions.
          </p>
        </div>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Action</TableHeadCell>
              <TableHeadCell>From</TableHeadCell>
              <TableHeadCell>To</TableHeadCell>
              <TableHeadCell>Remarks</TableHeadCell>
              <TableHeadCell>Promoted By</TableHeadCell>
              <TableHeadCell>Date</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <TableCell>
                  <Badge tone={record.action === 'PROMOTED' ? 'success' : 'warning'}>
                    {record.action === 'PROMOTED' ? 'Promoted' : 'Detained'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="table-primary-cell">
                    <strong>
                      {record.fromClass.name}
                      {record.fromSection ? ` • ${record.fromSection.name}` : ''}
                    </strong>
                    <span className="muted-text">{record.fromAcademicSession.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="table-primary-cell">
                    <strong>
                      {record.toClass.name}
                      {record.toSection ? ` • ${record.toSection.name}` : ''}
                    </strong>
                    <span className="muted-text">{record.toAcademicSession.name}</span>
                  </div>
                </TableCell>
                <TableCell>{record.remarks ?? 'No remarks'}</TableCell>
                <TableCell>{record.promotedBy?.name ?? 'System'}</TableCell>
                <TableCell>{formatDateTime(record.promotedAt)}</TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}
