'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import type { ApiMeta, ExamDateSheetRecord } from '@/utils/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

interface ExamDateSheetTableProps {
  items: ExamDateSheetRecord[];
  loading: boolean;
  meta: ApiMeta;
  onPageChange: (page: number) => void;
  onPublish: (id: string) => Promise<void>;
  publishingId: string | null;
}

export function ExamDateSheetTable({
  items,
  loading,
  meta,
  onPageChange,
  onPublish,
  publishingId,
}: ExamDateSheetTableProps) {
  const handlePrint = (item: ExamDateSheetRecord) => {
    const printWindow = window.open('', '_blank', 'width=960,height=720');

    if (!printWindow) {
      return;
    }

    const rows = item.entries
      .map(
        (entry) => `
          <tr>
            <td>${entry.subject.name} (${entry.subject.code})</td>
            <td>${formatDate(entry.examDate)}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
          </tr>
        `,
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${item.examName} - ${item.class.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1, h2, p { margin: 0 0 8px; }
            .meta { margin-bottom: 24px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
            th { background: #eff6ff; }
          </style>
        </head>
        <body>
          <h1>${item.school.name}</h1>
          <p class="meta">${item.school.schoolCode}</p>
          <h2>${item.examName}</h2>
          <p class="meta">Class: ${item.class.name} (${item.class.classCode})</p>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Date</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  if (loading) {
    return (
      <section className="card panel">
        <div className="ui-empty-state">
          <strong>Loading exam schedules...</strong>
          <p className="muted-text">Preparing printable class date sheets.</p>
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        description="Create the first date sheet to plan subject-wise exam schedules."
        title="No exam date sheets found"
      />
    );
  }

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Exam Date Sheets</h2>
          <p className="muted-text">
            Review subject schedules and use print mode for notice-board ready output.
          </p>
        </div>
      </div>

      <div className="dashboard-stack">
        {items.map((item) => (
          <article className="exam-sheet-card printable-sheet" key={item.id}>
            <div className="exam-sheet-card-header">
              <div>
                <h3>{item.examName}</h3>
                <p className="muted-text">
                  {item.class.name} ({item.class.classCode}) · Created {formatDate(item.createdAt)}
                </p>
              </div>
              <div className="cluster-row">
                <Badge tone={item.isPublished ? 'success' : 'warning'}>
                  {item.isPublished ? 'Published' : 'Draft'}
                </Badge>
                {!item.isPublished ? (
                  <Button
                    disabled={publishingId === item.id}
                    onClick={() => void onPublish(item.id)}
                    type="button"
                    variant="primary"
                  >
                    {publishingId === item.id ? 'Publishing...' : 'Publish'}
                  </Button>
                ) : null}
                <Button onClick={() => handlePrint(item)} type="button" variant="secondary">
                  Print
                </Button>
              </div>
            </div>

            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <TableHeadCell>Subject</TableHeadCell>
                    <TableHeadCell>Date</TableHeadCell>
                    <TableHeadCell>Time</TableHeadCell>
                  </tr>
                </thead>
                <tbody>
                  {item.entries.map((entry) => (
                    <tr key={entry.id}>
                      <TableCell>
                        <strong>{entry.subject.name}</strong>
                        <div className="muted-text">{entry.subject.code}</div>
                      </TableCell>
                      <TableCell>{formatDate(entry.examDate)}</TableCell>
                      <TableCell>
                        {entry.startTime} - {entry.endTime}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </article>
        ))}
      </div>

      <PaginationControls
        limit={meta.limit}
        onPageChange={onPageChange}
        page={meta.page}
        total={meta.total}
      />
    </section>
  );
}
