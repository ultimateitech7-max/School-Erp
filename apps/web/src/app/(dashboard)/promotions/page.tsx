'use client';

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BulkPromotionForm } from './components/BulkPromotionForm';
import { PromotionFilters } from './components/PromotionFilters';
import { PromotionHistoryTable } from './components/PromotionHistoryTable';
import { PromotionPreviewTable } from './components/PromotionPreviewTable';
import { SinglePromotionForm } from './components/SinglePromotionForm';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableCell,
  TableHeadCell,
  TableWrap,
} from '@/components/ui/table';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type BulkPromoteStudentsPayload,
  type BulkPromotionResult,
  type PromotionAction,
  type PromotionEligibleStudentRecord,
  type PromotionOptionsPayload,
  type PromotionPreviewPayload,
  type PromotionPreviewResponse,
  type PromotionRecord,
  type PromoteStudentPayload,
} from '@/utils/api';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: PromotionOptionsPayload = {
  currentSessionId: null,
  academicSessions: [],
  classes: [],
};

type PromotionTab = 'eligible' | 'preview' | 'history';

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState<PromotionTab>('eligible');
  const [options, setOptions] = useState<PromotionOptionsPayload>(emptyOptions);
  const [eligibleStudents, setEligibleStudents] = useState<
    PromotionEligibleStudentRecord[]
  >([]);
  const [history, setHistory] = useState<PromotionRecord[]>([]);
  const [eligibleMeta, setEligibleMeta] = useState<ApiMeta>(initialMeta);
  const [historyMeta, setHistoryMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewingBulk, setPreviewingBulk] = useState(false);
  const [previewingSingle, setPreviewingSingle] = useState(false);
  const [submittingSingle, setSubmittingSingle] = useState(false);
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [historySearchInput, setHistorySearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const deferredHistorySearch = useDeferredValue(historySearchInput);
  const [fromAcademicSessionId, setFromAcademicSessionId] = useState('');
  const [fromClassId, setFromClassId] = useState('');
  const [fromSectionId, setFromSectionId] = useState('');
  const [historyAction, setHistoryAction] = useState<'ALL' | PromotionAction>('ALL');
  const [historySessionId, setHistorySessionId] = useState('');
  const [historyClassId, setHistoryClassId] = useState('');
  const [eligiblePage, setEligiblePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [singleStudent, setSingleStudent] =
    useState<PromotionEligibleStudentRecord | null>(null);
  const [bulkPreview, setBulkPreview] = useState<PromotionPreviewResponse | null>(
    null,
  );
  const [recentlyPromotedStudentIds, setRecentlyPromotedStudentIds] = useState<string[]>(
    [],
  );
  const [resultModal, setResultModal] = useState<{
    title: string;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const clearBulkPreview = useCallback(() => {
    setBulkPreview(null);
  }, []);

  const currentSession = useMemo(
    () =>
      options.academicSessions.find(
        (session) => session.id === options.currentSessionId,
      ) ?? null,
    [options.academicSessions, options.currentSessionId],
  );

  useEffect(() => {
    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<PromotionOptionsPayload>>('/promotions/options')
      .then((response) => {
        setOptions(response.data);
        setFromAcademicSessionId(
          (current) => current || response.data.currentSessionId || '',
        );
        setHistorySessionId(
          (current) => current || response.data.currentSessionId || '',
        );
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load promotion options.',
        });
      })
      .finally(() => {
        setLoadingOptions(false);
      });
  }, []);

  useEffect(() => {
    startTransition(() => {
      setEligiblePage(1);
    });
  }, [deferredSearch, fromAcademicSessionId, fromClassId, fromSectionId]);

  useEffect(() => {
    startTransition(() => {
      setHistoryPage(1);
    });
  }, [deferredHistorySearch, historyAction, historySessionId, historyClassId]);

  useEffect(() => {
    setSelectedStudentIds([]);
    clearBulkPreview();
  }, [eligibleStudents, clearBulkPreview]);

  useEffect(() => {
    clearBulkPreview();
  }, [selectedStudentIds, clearBulkPreview]);

  useEffect(() => {
    if (!fromAcademicSessionId || !fromClassId) {
      setEligibleStudents([]);
      setEligibleMeta(initialMeta);
      setLoadingEligible(false);
      return;
    }

    setLoadingEligible(true);

    void apiFetch<ApiSuccessResponse<PromotionEligibleStudentRecord[]>>(
      `/promotions/eligible${createQueryString({
        page: eligiblePage,
        limit: initialMeta.limit,
        search: deferredSearch,
        fromAcademicSessionId,
        fromClassId,
        fromSectionId: fromSectionId || undefined,
      })}`,
    )
      .then((response) => {
        setEligibleStudents(response.data);
        setEligibleMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setEligibleStudents([]);
        setEligibleMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load eligible students.',
        });
      })
      .finally(() => {
        setLoadingEligible(false);
      });
  }, [
    deferredSearch,
    eligiblePage,
    fromAcademicSessionId,
    fromClassId,
    fromSectionId,
    reloadIndex,
  ]);

  useEffect(() => {
    setLoadingHistory(true);

    const historyPath = historyClassId
      ? `/promotions/class/${historyClassId}${createQueryString({
          page: historyPage,
          limit: initialMeta.limit,
          search: deferredHistorySearch,
          toAcademicSessionId: historySessionId || undefined,
          action: historyAction === 'ALL' ? undefined : historyAction,
        })}`
      : `/promotions${createQueryString({
          page: historyPage,
          limit: initialMeta.limit,
          search: deferredHistorySearch,
          toAcademicSessionId: historySessionId || undefined,
          action: historyAction === 'ALL' ? undefined : historyAction,
        })}`;

    void apiFetch<ApiSuccessResponse<PromotionRecord[]>>(historyPath)
      .then((response) => {
        setHistory(response.data);
        setHistoryMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setHistory([]);
        setHistoryMeta(initialMeta);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load promotion history.',
        });
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [
    deferredHistorySearch,
    historyAction,
    historyClassId,
    historyPage,
    historySessionId,
    reloadIndex,
  ]);

  const selectedStudents = eligibleStudents.filter((student) =>
    selectedStudentIds.includes(student.id),
  );

  const validPreviewStudentIds = bulkPreview
    ? bulkPreview.items
        .filter((item) => item.status === 'VALID' && item.student?.id)
        .map((item) => item.student!.id)
    : [];

  const canBulkPromote =
    selectedStudents.length > 0 &&
    Boolean(fromAcademicSessionId && fromClassId) &&
    validPreviewStudentIds.length > 0;

  const handleSinglePreview = async (payload: PromotionPreviewPayload) => {
    setPreviewingSingle(true);

    try {
      const response = await apiFetch<ApiSuccessResponse<PromotionPreviewResponse>>(
        '/promotions/preview',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      return response.data;
    } finally {
      setPreviewingSingle(false);
    }
  };

  const handleSingleSubmit = async (payload: PromoteStudentPayload) => {
    setSubmittingSingle(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<PromotionRecord>>(
        '/promotions',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setRecentlyPromotedStudentIds([payload.studentId]);
      setResultModal({
        title: payload.action === 'DETAINED' ? 'Detention Saved' : 'Promotion Complete',
        total: 1,
        successful: 1,
        failed: 0,
        skipped: 0,
      });
      setSingleStudent(null);
      setActiveTab('history');
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to process single promotion.',
      });
    } finally {
      setSubmittingSingle(false);
    }
  };

  const handleBulkPreview = async (payload: PromotionPreviewPayload) => {
    setPreviewingBulk(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<PromotionPreviewResponse>>(
        '/promotions/preview',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setBulkPreview(response.data);
      setActiveTab('preview');

      if (response.data.summary.valid === 0) {
        setMessage({
          type: 'error',
          text: 'No valid students are available for this promotion run.',
        });
      } else {
        setMessage({
          type: 'success',
          text: `${response.data.summary.valid} student(s) are valid for confirmation.`,
        });
      }
    } catch (error) {
      setBulkPreview(null);
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to generate bulk promotion preview.',
      });
    } finally {
      setPreviewingBulk(false);
    }
  };

  const handleBulkSubmit = async (payload: BulkPromoteStudentsPayload) => {
    if (!bulkPreview || validPreviewStudentIds.length === 0) {
      setMessage({
        type: 'error',
        text: 'Preview the promotion and keep at least one valid student before confirming.',
      });
      return;
    }

    setSubmittingBulk(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<BulkPromotionResult>>(
        '/promotions/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            studentIds: validPreviewStudentIds,
          }),
        },
      );

      setMessage({
        type: response.data.failed > 0 ? 'error' : 'success',
        text:
          response.data.failed > 0
            ? `${response.data.promoted} promoted, ${response.data.failed} failed.`
            : response.message,
      });
      setRecentlyPromotedStudentIds(
        response.data.successes.map((item) => item.student.id),
      );
      setResultModal({
        title:
          payload.action === 'DETAINED'
            ? 'Bulk Detention Complete'
            : 'Bulk Promotion Complete',
        total: bulkPreview.summary.total,
        successful: response.data.promoted,
        failed: response.data.failed,
        skipped: bulkPreview.summary.skipped,
      });
      setSelectedStudentIds([]);
      setBulkPreview(null);
      setActiveTab('history');
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to process bulk promotion.',
      });
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleReset = () => {
    setSearchInput('');
    setFromAcademicSessionId(options.currentSessionId || '');
    setFromClassId('');
    setFromSectionId('');
    setSelectedStudentIds([]);
    clearBulkPreview();
  };

  const handleResetHistoryFilters = () => {
    setHistorySearchInput('');
    setHistoryAction('ALL');
    setHistorySessionId(options.currentSessionId || '');
    setHistoryClassId('');
  };

  const toggleSelectedStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = eligibleStudents.map((student) => student.id);
    const allSelected = visibleIds.every((studentId) =>
      selectedStudentIds.includes(studentId),
    );

    setSelectedStudentIds((current) =>
      allSelected
        ? current.filter((studentId) => !visibleIds.includes(studentId))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const allVisibleSelected =
    eligibleStudents.length > 0 &&
    eligibleStudents.every((student) => selectedStudentIds.includes(student.id));

  return (
    <div className="students-page">
      <section className="summary-cards-grid">
        <article className="card summary-card">
          <div className="summary-card-top">
            <Badge tone="info">Current Promotion Context</Badge>
            <span className="summary-card-trend">
              {loadingOptions ? 'Syncing' : currentSession ? 'Live' : 'Unset'}
            </span>
          </div>
          <p>Promotions preserve historical enrollments and create the next session record.</p>
          <strong>{currentSession?.name ?? 'No current academic session'}</strong>
          <span>
            {currentSession
              ? `${formatDisplayDate(currentSession.startDate)} to ${formatDisplayDate(currentSession.endDate)}`
              : 'Select source and target sessions to start a promotion cycle.'}
          </span>
        </article>
      </section>

      <PromotionFilters
        fromAcademicSessionId={fromAcademicSessionId}
        fromClassId={fromClassId}
        fromSectionId={fromSectionId}
        loading={loadingOptions}
        options={options}
        search={searchInput}
        onFromAcademicSessionChange={setFromAcademicSessionId}
        onFromClassChange={(value) => {
          setFromClassId(value);
          setFromSectionId('');
          clearBulkPreview();
        }}
        onFromSectionChange={(value) => {
          setFromSectionId(value);
          clearBulkPreview();
        }}
        onReset={handleReset}
        onSearchChange={setSearchInput}
      />

      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="card panel">
        <div className="promotion-tabs">
          <button
            className={`promotion-tab ${activeTab === 'eligible' ? 'promotion-tab-active' : ''}`}
            onClick={() => setActiveTab('eligible')}
            type="button"
          >
            Eligible Students
          </button>
          <button
            className={`promotion-tab ${activeTab === 'preview' ? 'promotion-tab-active' : ''}`}
            onClick={() => setActiveTab('preview')}
            type="button"
          >
            Preview
            {bulkPreview ? <Badge tone="info">{bulkPreview.summary.valid}</Badge> : null}
          </button>
          <button
            className={`promotion-tab ${activeTab === 'history' ? 'promotion-tab-active' : ''}`}
            onClick={() => setActiveTab('history')}
            type="button"
          >
            History
          </button>
        </div>

        {activeTab === 'eligible' ? (
          <div className="students-grid">
            <BulkPromotionForm
              canConfirm={canBulkPromote}
              fromAcademicSessionId={fromAcademicSessionId}
              fromClassId={fromClassId}
              fromSectionId={fromSectionId}
              hasPreview={Boolean(bulkPreview)}
              options={options}
              previewSummary={bulkPreview?.summary ?? null}
              previewing={previewingBulk}
              selectedStudents={selectedStudents}
              submitting={submittingBulk}
              onClearPreview={clearBulkPreview}
              onPreview={handleBulkPreview}
              onSubmit={handleBulkSubmit}
            />

            <section className="card panel">
              <div className="panel-heading">
                <div>
                  <h2>Eligible Students</h2>
                  <p className="muted-text">
                    {eligibleMeta.total} student{eligibleMeta.total === 1 ? '' : 's'} ready for
                    promotion review.
                  </p>
                </div>

                <div className="table-actions">
                  <button
                    className="secondary-button"
                    disabled={loadingEligible || eligibleStudents.length === 0}
                    onClick={toggleSelectAllVisible}
                    type="button"
                  >
                    {allVisibleSelected ? 'Clear Visible' : 'Select Visible'}
                  </button>
                  <button className="primary-button" disabled type="button">
                    {selectedStudents.length} selected
                  </button>
                </div>
              </div>

              {loadingEligible ? (
                <div className="empty-state ui-empty-state">
                  <strong>Loading eligible students...</strong>
                  <p className="muted-text">
                    Matching active source enrollments to the selected session, class,
                    and section.
                  </p>
                </div>
              ) : null}

              {!loadingEligible && eligibleStudents.length === 0 ? (
                <EmptyState
                  description={
                    fromAcademicSessionId && fromClassId
                      ? 'No active source enrollments match the selected filters.'
                      : 'Choose a source academic session and class to load promotable students.'
                  }
                  title="No eligible students found."
                />
              ) : null}

              {!loadingEligible && eligibleStudents.length > 0 ? (
                <>
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <TableHeadCell>
                            <input
                              checked={allVisibleSelected}
                              onChange={toggleSelectAllVisible}
                              type="checkbox"
                            />
                          </TableHeadCell>
                          <TableHeadCell>Student</TableHeadCell>
                          <TableHeadCell>Source Session</TableHeadCell>
                          <TableHeadCell>Source Class</TableHeadCell>
                          <TableHeadCell>Source Section</TableHeadCell>
                          <TableHeadCell>Actions</TableHeadCell>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleStudents.map((student) => (
                          <tr
                            key={student.id}
                            className={
                              recentlyPromotedStudentIds.includes(student.id)
                                ? 'promotion-row-highlight'
                                : undefined
                            }
                          >
                            <TableCell>
                              <input
                                checked={selectedStudentIds.includes(student.id)}
                                onChange={() => toggleSelectedStudent(student.id)}
                                type="checkbox"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="table-primary-cell">
                                <strong>{student.name}</strong>
                                <span className="muted-text">
                                  {student.studentCode}
                                  {student.sourceEnrollment?.admissionNo
                                    ? ` • ${student.sourceEnrollment.admissionNo}`
                                    : ''}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {student.sourceEnrollment?.academicSession.name ?? 'Unavailable'}
                            </TableCell>
                            <TableCell>
                              {student.sourceEnrollment?.academicClass.name ?? 'Unavailable'}
                            </TableCell>
                            <TableCell>
                              {student.sourceEnrollment?.section?.name ?? 'No section'}
                            </TableCell>
                            <TableCell>
                              <div className="table-actions">
                                <Button
                                  onClick={() => setSingleStudent(student)}
                                  type="button"
                                  variant="primary"
                                >
                                  Promote
                                </Button>
                              </div>
                            </TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>

                  <PaginationControls
                    limit={eligibleMeta.limit}
                    page={eligibleMeta.page}
                    total={eligibleMeta.total}
                    onPageChange={setEligiblePage}
                  />
                </>
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === 'preview' ? (
          <PromotionPreviewTable
            emptyDescription="Choose source filters, select students, and generate a preview to validate duplicates and source enrollments."
            emptyTitle="Preview students before confirmation."
            items={bulkPreview?.items ?? []}
            loading={previewingBulk}
            summary={bulkPreview?.summary ?? null}
          />
        ) : null}

        {activeTab === 'history' ? (
          <div className="history-filter-stack">
            <section className="card panel students-toolbar">
              <div>
                <h2>Promotion History Filters</h2>
                <p className="muted-text">
                  Filter promotion records by session, class, action, or search terms.
                </p>
              </div>

              <div className="students-toolbar-actions">
                <input
                  className="search-input"
                  placeholder="Search by student, code, or admission no"
                  type="search"
                  value={historySearchInput}
                  onChange={(event) => setHistorySearchInput(event.target.value)}
                />

                <select
                  value={historySessionId}
                  onChange={(event) => setHistorySessionId(event.target.value)}
                >
                  <option value="">All target sessions</option>
                  {options.academicSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>

                <select
                  value={historyClassId}
                  onChange={(event) => setHistoryClassId(event.target.value)}
                >
                  <option value="">All classes</option>
                  {options.classes.map((academicClass) => (
                    <option key={academicClass.id} value={academicClass.id}>
                      {academicClass.name}
                    </option>
                  ))}
                </select>

                <select
                  value={historyAction}
                  onChange={(event) =>
                    setHistoryAction(event.target.value as 'ALL' | PromotionAction)
                  }
                >
                  <option value="ALL">All actions</option>
                  <option value="PROMOTED">Promoted</option>
                  <option value="DETAINED">Detained</option>
                </select>

                <button
                  className="secondary-button"
                  onClick={handleResetHistoryFilters}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </section>

            <PromotionHistoryTable
              loading={loadingHistory}
              meta={historyMeta}
              records={history}
              onPageChange={setHistoryPage}
            />
          </div>
        ) : null}
      </section>

      <SinglePromotionForm
        open={Boolean(singleStudent)}
        options={options}
        previewing={previewingSingle}
        student={singleStudent}
        submitting={submittingSingle}
        onClose={() => setSingleStudent(null)}
        onPreview={handleSinglePreview}
        onSubmit={handleSingleSubmit}
      />

      <Modal
        open={Boolean(resultModal)}
        title={resultModal?.title ?? 'Promotion Summary'}
        description="Promotion workflow completed with preserved enrollment and promotion history."
        onClose={() => setResultModal(null)}
      >
        {resultModal ? (
          <div className="summary-cards-grid">
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Processed</Badge>
              </div>
              <strong>{resultModal.total}</strong>
              <span>Total reviewed</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="success">Successful</Badge>
              </div>
              <strong>{resultModal.successful}</strong>
              <span>Promotions saved</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="warning">Skipped</Badge>
              </div>
              <strong>{resultModal.skipped}</strong>
              <span>Already existed</span>
            </article>
            <article className="card summary-card compact-summary-card">
              <div className="summary-card-top">
                <Badge tone="danger">Failed</Badge>
              </div>
              <strong>{resultModal.failed}</strong>
              <span>Need review</span>
            </article>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
