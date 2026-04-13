'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ApiMeta, PaymentRecord } from '@/utils/api';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  loading: boolean;
  meta: ApiMeta;
  onPageChange: (page: number) => void;
  onDownloadReceipt?: (payment: PaymentRecord) => void;
  downloadingReceiptId?: string | null;
  actions?: ReactNode;
}

export function PaymentHistory({
  payments,
  loading,
  meta,
  onPageChange,
  onDownloadReceipt,
  downloadingReceiptId,
  actions,
}: PaymentHistoryProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Payment History</h2>
          <p className="muted-text">
            {meta.total} payment{meta.total === 1 ? '' : 's'} recorded
          </p>
        </div>
        {actions}
      </div>

      {loading ? <p>Loading payments...</p> : null}

      {!loading && payments.length === 0 ? (
        <EmptyState
          description="Record a payment to generate receipts."
          title="No payments found."
        />
      ) : null}

      {!loading && payments.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Receipt</TableHeadCell>
                  <TableHeadCell>Student</TableHeadCell>
                  <TableHeadCell>Fee</TableHeadCell>
                  <TableHeadCell>Amount</TableHeadCell>
                  <TableHeadCell>Method</TableHeadCell>
                  <TableHeadCell>Date</TableHeadCell>
                  <TableHeadCell>Receipt File</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{payment.receiptNo}</strong>
                        <span className="muted-text">{payment.reference ?? '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{payment.student.name}</TableCell>
                    <TableCell>{payment.feeStructure.name}</TableCell>
                    <TableCell>{payment.amount.toFixed(2)}</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                    <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {onDownloadReceipt ? (
                        <Button
                          disabled={downloadingReceiptId === payment.id}
                          onClick={() => onDownloadReceipt(payment)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {downloadingReceiptId === payment.id
                            ? 'Preparing...'
                            : 'Download Receipt'}
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          <PaginationControls
            limit={meta.limit}
            page={meta.page}
            total={meta.total}
            onPageChange={onPageChange}
          />
        </>
      ) : null}
    </section>
  );
}
