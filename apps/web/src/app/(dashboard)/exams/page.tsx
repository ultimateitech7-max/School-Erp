'use client';

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ExamForm } from './components/ExamForm';
import { ExamTable } from './components/ExamTable';
import { MarksEntryForm } from './components/MarksEntryForm';
import { ResultsTable } from './components/ResultsTable';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  apiFetch,
  createQueryString,
  type ApiMeta,
  type ApiSuccessResponse,
  type ExamFormPayload,
  type ExamMarkRecord,
  type ExamRecord,
  type ExamResultsPayload,
  type ExamsOptionsPayload,
  type ExamStatus,
  type ExamType,
  type MarksEntryPayload,
  type StudentResultsPayload,
} from '@/utils/api';
import { getStoredAuthSession, type AuthSession } from '@/utils/auth-storage';
import { examCsvColumns, examResultCsvColumns } from '@/utils/csv-exporters';
import { buildCsvFilename, exportPaginatedApiCsv, exportRowsToCsv } from '@/utils/csv';

const initialMeta: ApiMeta = {
  page: 1,
  limit: 10,
  total: 0,
};

const emptyOptions: ExamsOptionsPayload = {
  currentSessionId: '',
  currentSessionName: '',
  examTypes: ['UNIT', 'MIDTERM', 'FINAL', 'PRACTICAL', 'OTHER'],
  examStatuses: ['DRAFT', 'SCHEDULED', 'ONGOING', 'PUBLISHED', 'CLOSED'],
  classes: [],
  subjects: [],
  students: [],
};

export default function ExamsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [options, setOptions] = useState<ExamsOptionsPayload>(emptyOptions);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta>(initialMeta);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingExamResults, setLoadingExamResults] = useState(false);
  const [loadingStudentResults, setLoadingStudentResults] = useState(false);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamRecord | null>(null);
  const [pendingDeleteExam, setPendingDeleteExam] = useState<ExamRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [examMarks, setExamMarks] = useState<ExamMarkRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResultsPayload | null>(null);
  const [studentResults, setStudentResults] = useState<StudentResultsPayload | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [statusFilter, setStatusFilter] = useState<ExamStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<ExamType | ''>('');
  const [page, setPage] = useState(1);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [deferredSearch, statusFilter, typeFilter]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setLoadingOptions(true);

    void apiFetch<ApiSuccessResponse<ExamsOptionsPayload>>('/exams/options')
      .then((response) => {
        setOptions(response.data);
      })
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load exam options.',
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

    setLoadingExams(true);

    void apiFetch<ApiSuccessResponse<ExamRecord[]>>(
      `/exams${createQueryString({
        page,
        limit: initialMeta.limit,
        search: deferredSearch,
        status: statusFilter || undefined,
        examType: typeFilter || undefined,
      })}`,
    )
      .then((response) => {
        setExams(response.data);
        setMeta(response.meta ?? initialMeta);
      })
      .catch((error) => {
        setExams([]);
        setMeta(initialMeta);
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to load exams.',
        });
      })
      .finally(() => {
        setLoadingExams(false);
      });
  }, [deferredSearch, page, reloadIndex, session, statusFilter, typeFilter]);

  useEffect(() => {
    if (!selectedExam) {
      setExamResults(null);
      setExamMarks([]);
      return;
    }

    setLoadingExamResults(true);

    void Promise.all([
      apiFetch<ApiSuccessResponse<ExamResultsPayload>>(`/exams/${selectedExam.id}/results`),
      apiFetch<ApiSuccessResponse<{ exam: ExamRecord; marks: ExamMarkRecord[] }>>(
        `/exams/${selectedExam.id}/marks`,
      ),
    ])
      .then(([resultsResponse, marksResponse]) => {
        setExamResults(resultsResponse.data);
        setExamMarks(marksResponse.data.marks);
      })
      .catch((error) => {
        setExamResults(null);
        setExamMarks([]);
        setMessage({
          type: 'error',
          text:
            error instanceof Error ? error.message : 'Failed to load exam results.',
        });
      })
      .finally(() => {
        setLoadingExamResults(false);
      });
  }, [reloadIndex, selectedExam]);

  useEffect(() => {
    if (!selectedStudentId) {
      setStudentResults(null);
      return;
    }

    setLoadingStudentResults(true);

    void apiFetch<ApiSuccessResponse<StudentResultsPayload>>(
      `/students/${selectedStudentId}/results`,
    )
      .then((response) => {
        setStudentResults(response.data);
      })
      .catch((error) => {
        setStudentResults(null);
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load student results.',
        });
      })
      .finally(() => {
        setLoadingStudentResults(false);
      });
  }, [selectedStudentId]);

  const canManageExams =
    session?.user.role === 'SUPER_ADMIN' ||
    session?.user.role === 'SCHOOL_ADMIN' ||
    session?.user.role === 'TEACHER';
  const canConfigureExams =
    session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'SCHOOL_ADMIN';

  const filteredStudents = useMemo(() => {
    if (!selectedExam?.class?.id) {
      return options.students;
    }

    return options.students.filter((student) => student.classId === selectedExam.class?.id);
  }, [options.students, selectedExam]);

  const handleSubmitExam = async (payload: ExamFormPayload) => {
    setSubmittingExam(true);
    setMessage(null);

    try {
      const response = editingExam
        ? await apiFetch<ApiSuccessResponse<ExamRecord>>(`/exams/${editingExam.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<ApiSuccessResponse<ExamRecord>>('/exams', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingExam(null);
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : editingExam
              ? 'Failed to update exam.'
              : 'Failed to create exam.',
      });
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleDeleteExam = async (exam: ExamRecord) => {
    setPendingDeleteExam(exam);
    setMessage(null);
  };

  const confirmDeleteExam = async () => {
    if (!pendingDeleteExam) {
      return;
    }

    setDeletingExamId(pendingDeleteExam.id);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ deleted: boolean }>>(
        `/exams/${pendingDeleteExam.id}`,
        {
          method: 'DELETE',
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setEditingExam((current) =>
        current?.id === pendingDeleteExam.id ? null : current,
      );
      setSelectedExam((current) =>
        current?.id === pendingDeleteExam.id ? null : current,
      );
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to delete exam.',
      });
    } finally {
      setDeletingExamId(null);
      setPendingDeleteExam(null);
    }
  };

  const handleSubmitMarks = async (payload: MarksEntryPayload) => {
    if (!selectedExam) {
      return;
    }

    setSubmittingMarks(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ entriesSaved: number }>>(
        `/exams/${selectedExam.id}/marks`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      setMessage({
        type: 'success',
        text: response.message,
      });
      setReloadIndex((current) => current + 1);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save marks.',
      });
      throw error;
    } finally {
      setSubmittingMarks(false);
    }
  };

  const handleExportExamsCsv = async () => {
    try {
      const count = await exportPaginatedApiCsv<ExamRecord>({
        path: '/exams',
        params: {
          search: deferredSearch || undefined,
          status: statusFilter || undefined,
          examType: typeFilter || undefined,
        },
        columns: examCsvColumns,
        filename: buildCsvFilename('exams'),
      });

      setMessage({
        type: 'success',
        text: `Downloaded ${count} exam record${count === 1 ? '' : 's'} as CSV.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export exams.',
      });
    }
  };

  const handleExportResultsCsv = async () => {
    const resultRows = studentResults?.results ?? examResults?.results ?? [];
    const count = exportRowsToCsv(
      resultRows,
      examResultCsvColumns,
      buildCsvFilename(studentResults ? 'student-results' : 'exam-results'),
    );

    setMessage({
      type: 'success',
      text: `Downloaded ${count} result row${count === 1 ? '' : 's'} as CSV.`,
    });
  };

  if (!session) {
    return (
      <section className="card panel">
        <p>Loading session...</p>
      </section>
    );
  }

  if (!canManageExams) {
    return (
      <section className="card panel">
        <h2>Access Restricted</h2>
        <p className="muted-text">You do not have permission to access exams.</p>
      </section>
    );
  }

  return (
    <div className="academic-page">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Exams & Results</h2>
          <p className="muted-text">
            Manage exam schedules, marks entry, and result publication.
          </p>
        </div>

        <div className="toolbar-actions">
          <input
            className="search-input"
            placeholder="Search by exam name or code"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ExamType | '')}
          >
            <option value="">All types</option>
            {options.examTypes.map((examType) => (
              <option key={examType} value={examType}>
                {examType}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ExamStatus | '')}
          >
            <option value="">All statuses</option>
            {options.examStatuses.map((examStatus) => (
              <option key={examStatus} value={examStatus}>
                {examStatus}
              </option>
            ))}
          </select>
          {editingExam && canConfigureExams ? (
            <button
              className="secondary-button"
              onClick={() => setEditingExam(null)}
              type="button"
            >
              Clear Edit
            </button>
          ) : null}
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportExamsCsv}
          />
        </div>
      </section>

      {message ? (
        <section className="card panel">
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>
            {message.text}
          </p>
        </section>
      ) : null}

      <div className={canConfigureExams ? 'academic-grid' : 'dashboard-stack'}>
        {canConfigureExams ? (
          <ExamForm
            initialValue={editingExam}
            isSubmitting={submittingExam}
            onCancel={() => setEditingExam(null)}
            onSubmit={handleSubmitExam}
            options={options}
          />
        ) : (
          <section className="card panel">
            <div className="panel-heading">
              <div>
                <h2>Exam Workspace</h2>
                <p className="muted-text">
                  Review exam schedules, open result workflows, and complete marks entry.
                </p>
              </div>
            </div>
          </section>
        )}
        <ExamTable
          canManage={canConfigureExams}
          deletingExamId={deletingExamId}
          exams={exams}
          loading={loadingOptions || loadingExams}
          meta={meta}
          onDelete={handleDeleteExam}
          onEdit={setEditingExam}
          onPageChange={setPage}
          onSelect={setSelectedExam}
          selectedExamId={selectedExam?.id ?? null}
        />
      </div>

      <div className="academic-grid">
        <MarksEntryForm
          exam={selectedExam}
          existingMarks={examMarks}
          isSubmitting={submittingMarks}
          onSubmit={handleSubmitMarks}
          options={options}
        />

        <section className="card panel">
          <div className="panel-heading">
            <div>
              <h2>Student Result Lookup</h2>
              <p className="muted-text">
                Fetch report cards and computed grades for a student.
              </p>
            </div>
          </div>

          <label>
            <span>Student</span>
            <select
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              <option value="">Select student</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.studentCode})
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      <ResultsTable
        actions={
          <CsvDownloadButton
            label="Download CSV"
            loadingLabel="Exporting..."
            onDownload={handleExportResultsCsv}
          />
        }
        examResults={examResults}
        loadingExamResults={loadingExamResults}
        loadingStudentResults={loadingStudentResults}
        studentResults={studentResults}
      />

      {canConfigureExams ? (
        <ConfirmDialog
          confirmLabel="Delete exam"
          description={
            pendingDeleteExam
              ? `Delete ${pendingDeleteExam.examName}? This will remove the exam from active planning and result views.`
              : 'Delete this exam?'
          }
          loading={Boolean(pendingDeleteExam && deletingExamId === pendingDeleteExam.id)}
          open={Boolean(pendingDeleteExam)}
          onClose={() => setPendingDeleteExam(null)}
          onConfirm={() => void confirmDeleteExam()}
          title="Delete exam"
        />
      ) : null}
    </div>
  );
}
