'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { AssignFeeForm } from './components/AssignFeeForm';
import { FeeStructureForm } from './components/FeeStructureForm';
import { FeeStructureTable } from './components/FeeStructureTable';
import { FeesTable } from './components/FeesTable';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type AssignFeePayload,
  type FeeAssignmentStatus,
  type FeeStructureFormPayload,
  type FeeStructureRecord,
  type FeesOptionsPayload,
  type StudentFeeRecord,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { studentFeeCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: FeesOptionsPayload = {
  currentSessionId: '',
  currentSessionName: '',
  classes: [],
  students: [],
  feeCategories: [],
  feeFrequencies: [],
  paymentModes: [],
  assignmentStatuses: [],
};

export default function FeesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [options, setOptions] = useState<FeesOptionsPayload>(emptyOptions);
  const [feeStructures, setFeeStructures] = useState<FeeStructureRecord[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeRecord[]>([]);
  const [structureMeta, setStructureMeta] = useState<ApiMeta>(initialMeta);
  const [studentFeesMeta, setStudentFeesMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingStudentFees, setLoadingStudentFees] = useState(true);
  const [structureSubmitting, setStructureSubmitting] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [deletingStructureId, setDeletingStructureId] = useState<string | null>(null);
  const [editingStructure, setEditingStructure] = useState<FeeStructureRecord | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [structureSearchInput, setStructureSearchInput] = useState('');
  const [assignmentSearchInput, setAssignmentSearchInput] = useState('');
  const deferredStructureSearch = useDeferredValue(structureSearchInput);
  const deferredAssignmentSearch = useDeferredValue(assignmentSearchInput);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeeAssignmentStatus | ''>('');
  const [structurePage, setStructurePage] = useState(1);
  const [studentFeePage, setStudentFeePage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    setStructurePage(1);
  }, [deferredStructureSearch]);

  useEffect(() => {
    setStudentFeePage(1);
  }, [deferredAssignmentSearch, selectedStudentId, statusFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<FeesOptionsPayload>>('/fees/options')
      .then((response) => {
        setOptions(response.data);
        setSelectedStudentId((current) => current || response.data.students[0]?.id || '');
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load fee options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingStructures(true);

    void apiFetch<ApiSuccessResponse<FeeStructureRecord[]>>(
      `/fees/structure${createQueryString({
        page: structurePage,
        limit: initialMeta.limit,
        search: deferredStructureSearch || undefined,
      })}`,
    )
      .then((response) => {
        setFeeStructures(response.data);
        setStructureMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setFeeStructures([]);
        setStructureMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load fee structures.',
        });
      })
      .finally(() => {
        setLoadingStructures(false);
      });
  }, [deferredStructureSearch, reloadIndex, session, structurePage]);

  useEffect(() => {
    if (!session || !selectedStudentId) {
      setStudentFees([]);
      setStudentFeesMeta(initialMeta);
      setLoadingStudentFees(false);
      return;
    }

    setLoadingStudentFees(true);

    void apiFetch<ApiSuccessResponse<StudentFeeRecord[]>>(
      `/fees/student/${selectedStudentId}${createQueryString({
        page: studentFeePage,
        limit: initialMeta.limit,
        search: deferredAssignmentSearch || undefined,
        status: statusFilter || undefined,
      })}`,
    )
      .then((response) => {
        setStudentFees(response.data);
        setStudentFeesMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setStudentFees([]);
        setStudentFeesMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load student fees.',
        });
      })
      .finally(() => {
        setLoadingStudentFees(false);
      });
  }, [
    deferredAssignmentSearch,
    reloadIndex,
    selectedStudentId,
    session,
    statusFilter,
    studentFeePage,
  ]);

  const handleCreateOrUpdateStructure = async (payload: FeeStructureFormPayload) => {
    setStructureSubmitting(true);
    setMessage(null);

    try {
      const response = editingStructure
        ? await apiFetch<ApiSuccessResponse<FeeStructureRecord>>(
            `/fees/structure/${editingStructure.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload),
            },
          )
        : await apiFetch<ApiSuccessResponse<FeeStructureRecord>>('/fees/structure', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingStructure(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingStructure
              ? 'Failed to update fee structure.'
              : 'Failed to create fee structure.',
      });
    } finally {
      setStructureSubmitting(false);
    }
  };

  const handleDeleteStructure = async (structure: FeeStructureRecord) => {
    setDeletingStructureId(structure.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `/fees/structure/${structure.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      if (editingStructure?.id === structure.id) {
        setEditingStructure(null);
      }
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to delete fee structure.',
      });
    } finally {
      setDeletingStructureId(null);
    }
  };

  const handleAssignFee = async (payload: AssignFeePayload) => {
    setAssignSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<StudentFeeRecord>>('/fees/assign', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage({
        type: 'success',
        text: response.message,
      });

      if (payload.studentId) {
        setSelectedStudentId(payload.studentId);
      }

      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to assign fee.',
      });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleExportStudentFeesCsv = async () => {
    if (!selectedStudentId) {
      setMessage({
        type: 'error',
        text: 'Select a student before exporting fee assignments.',
      });
      return;
    }

    try {
      const count = await exportPaginatedApiCsv<StudentFeeRecord>({
        path: `/fees/student/${selectedStudentId}`,
        params: {
          search: deferredAssignmentSearch || undefined,
          status: statusFilter || undefined,
        },
        columns: studentFeeCsvColumns,
        filename: buildCsvFilename('student-fees'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} fee assignment${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to export student fees.',
      });
    }
  };

  if (!sessionLoaded) {
    return (
      <section className="card panel">
        <p>Loading session...</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="card panel">
        <h2>Session Expired</h2>
        <p className="muted-text">
          Please sign in again to continue managing fees.
        </p>
      </section>
    );
  }

  const canManageFees =
    session.user.role === 'SUPER_ADMIN' || session.user.role === 'SCHOOL_ADMIN';

  if (!canManageFees) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">
          You do not have permission to manage fees.
        </p>
      </section>
    );
  }

  return (
    <div className="academic-page fee-management-shell">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="card panel compact-panel-stack fee-management-hero">
        <div className="panel-heading compact-panel-heading fee-management-head">
          <div>
            <h2>Fees Management</h2>
            <p className="muted-text">
              Create fee structures, assign them with proper class or section scope, and review student dues.
            </p>
          </div>

          <div className="chip-list">
            <Badge tone="info">Collection moved to Fee Submissions</Badge>
          </div>
        </div>

        <div className="fee-management-toolbar">
          <Field className="fee-management-toolbar-search" label="Structure Search">
            <Input
              placeholder="Search fee structure by name or code"
              type="search"
              value={structureSearchInput}
              onChange={(event) => setStructureSearchInput(event.target.value)}
            />
          </Field>

          <Field label="Student Fees Search">
            <Input
              placeholder="Search assigned fee by fee name or code"
              type="search"
              value={assignmentSearchInput}
              onChange={(event) => setAssignmentSearchInput(event.target.value)}
            />
          </Field>

          <Field label="Student">
            <Select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              <option value="">Select student</option>
              {options.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.studentCode})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as FeeAssignmentStatus | '')
              }
            >
              <option value="">All statuses</option>
              {options.assignmentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <div className="academic-grid fees-grid fees-grid-split fee-management-forms">
        <FeeStructureForm
          initialValue={editingStructure}
          onCancel={() => setEditingStructure(null)}
          onSubmit={handleCreateOrUpdateStructure}
          options={options}
          submitting={structureSubmitting || loadingOptions}
        />
        <AssignFeeForm
          feeStructures={feeStructures}
          onSubmit={handleAssignFee}
          options={options}
          submitting={assignSubmitting || loadingStructures || loadingOptions}
        />
      </div>

      <div className="fees-results-grid">
        <FeesTable
          actions={
            <CsvDownloadButton
              label="Download CSV"
              loadingLabel="Exporting..."
              onDownload={handleExportStudentFeesCsv}
            />
          }
          fees={studentFees}
          loading={loadingStudentFees}
          meta={studentFeesMeta}
          onPageChange={setStudentFeePage}
        />

        <FeeStructureTable
          deletingId={deletingStructureId}
          editingId={editingStructure?.id ?? null}
          items={feeStructures}
          loading={loadingStructures}
          meta={structureMeta}
          onDelete={(item) => void handleDeleteStructure(item)}
          onEdit={setEditingStructure}
          onPageChange={setStructurePage}
        />
      </div>
    </div>
  );
}
