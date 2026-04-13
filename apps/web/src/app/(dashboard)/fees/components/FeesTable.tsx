'use client';

import type { ReactNode } from 'react';
import type { ApiMeta, StudentFeeRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface FeesTableProps {
  fees: StudentFeeRecord[];
  loading: boolean;
  meta: ApiMeta;
  onPageChange: (page: number) => void;
  actions?: ReactNode;
}

export function FeesTable({
  fees,
  loading,
  meta,
  onPageChange,
  actions,
}: FeesTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Student Fees</h2>
          <p className="muted-text">
            {meta.total} assignment{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
        {actions}
      </div>

      {loading ? <p>Loading fees...</p> : null}

      {!loading && fees.length === 0 ? (
        <EmptyState
          description="Assign a fee to start tracking dues."
          title="No fee assignments found."
        />
      ) : null}

      {!loading && fees.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Student</TableHeadCell>
                  <TableHeadCell>Fee</TableHeadCell>
                  <TableHeadCell>Total</TableHeadCell>
                  <TableHeadCell>Paid</TableHeadCell>
                  <TableHeadCell>Due</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.studentFeeId}>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{fee.student.name}</strong>
                        <span className="muted-text">{fee.student.studentCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="table-primary-cell">
                        <strong>{fee.feeStructure.name}</strong>
                        <span className="muted-text">{fee.feeStructure.feeCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>{fee.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>{fee.paidAmount.toFixed(2)}</TableCell>
                    <TableCell>{fee.dueAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge tone={fee.status === 'PAID' ? 'success' : fee.status === 'PARTIAL' ? 'warning' : 'danger'}>
                        {fee.status}
                      </Badge>
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
