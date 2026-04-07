'use client';

import type { ApiMeta, SectionRecord } from '@/utils/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface SectionTableProps {
  sections: SectionRecord[];
  loading: boolean;
  meta: ApiMeta;
  deletingSectionId: string | null;
  onEdit: (section: SectionRecord) => void;
  onDelete: (section: SectionRecord) => void;
  onPageChange: (page: number) => void;
}

export function SectionTable({
  sections,
  loading,
  meta,
  deletingSectionId,
  onEdit,
  onDelete,
  onPageChange,
}: SectionTableProps) {
  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Sections List</h2>
          <p className="muted-text">
            {meta.total} section{meta.total === 1 ? '' : 's'} found
          </p>
        </div>
      </div>

      {loading ? <p>Loading sections...</p> : null}

      {!loading && sections.length === 0 ? (
        <EmptyState
          description="Add a section or adjust the active filters."
          title="No sections found."
        />
      ) : null}

      {!loading && sections.length > 0 ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <TableHeadCell>Section</TableHeadCell>
                  <TableHeadCell>Class</TableHeadCell>
                  <TableHeadCell>Room</TableHeadCell>
                  <TableHeadCell>Capacity</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Actions</TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <tr key={section.id}>
                    <TableCell>{section.sectionName}</TableCell>
                    <TableCell>
                      {section.class.className} ({section.class.classCode})
                    </TableCell>
                    <TableCell>{section.roomNo ?? '-'}</TableCell>
                    <TableCell>{section.capacity ?? '-'}</TableCell>
                    <TableCell>
                      <Badge tone={section.isActive ? 'success' : 'warning'}>
                        {section.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          onClick={() => onEdit(section)}
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        {section.isActive ? (
                          <Button
                            disabled={deletingSectionId === section.id}
                            onClick={() => onDelete(section)}
                            type="button"
                            variant="danger"
                          >
                            {deletingSectionId === section.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </Button>
                        ) : null}
                      </div>
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
