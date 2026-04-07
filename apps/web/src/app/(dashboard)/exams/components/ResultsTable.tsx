'use client';

import { useMemo, useState } from 'react';
import type { ExamResultsPayload, StudentResultsPayload } from '@/utils/api';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';

interface ResultsTableProps {
  examResults: ExamResultsPayload | null;
  studentResults: StudentResultsPayload | null;
  loadingExamResults: boolean;
  loadingStudentResults: boolean;
}

export function ResultsTable({
  examResults,
  studentResults,
  loadingExamResults,
  loadingStudentResults,
}: ResultsTableProps) {
  const [view, setView] = useState<'exam' | 'student'>('exam');

  const rows = useMemo(() => {
    return view === 'student'
      ? studentResults?.results ?? []
      : examResults?.results ?? [];
  }, [examResults, studentResults, view]);

  const loading = view === 'student' ? loadingStudentResults : loadingExamResults;

  return (
    <section className="card panel">
      <div className="panel-heading">
        <div>
          <h2>Results</h2>
          <p className="muted-text">
            View aggregated totals, percentages, and final grades.
          </p>
        </div>

        <div className="toolbar-actions">
          <button
            className={view === 'exam' ? 'primary-button' : 'secondary-button'}
            onClick={() => setView('exam')}
            type="button"
          >
            Exam View
          </button>
          <button
            className={view === 'student' ? 'primary-button' : 'secondary-button'}
            onClick={() => setView('student')}
            type="button"
          >
            Student View
          </button>
        </div>
      </div>

      {loading ? <p>Loading results...</p> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          description="Exam and student result data will appear here after marks are recorded."
          title="No result records available."
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <TableHeadCell>Student</TableHeadCell>
                <TableHeadCell>Exam</TableHeadCell>
                <TableHeadCell>Total</TableHeadCell>
                <TableHeadCell>Obtained</TableHeadCell>
                <TableHeadCell>Percentage</TableHeadCell>
                <TableHeadCell>Grade</TableHeadCell>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <TableCell>
                    <strong>{row.student.name}</strong>
                    <div className="muted-text">{row.student.studentCode}</div>
                  </TableCell>
                  <TableCell>
                    <strong>{row.exam.examName}</strong>
                    <div className="muted-text">{row.exam.examCode}</div>
                  </TableCell>
                  <TableCell>{row.totalMarks}</TableCell>
                  <TableCell>{row.obtainedMarks}</TableCell>
                  <TableCell>{row.percentage.toFixed(2)}%</TableCell>
                  <TableCell>{row.overallGrade ?? '-'}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : null}
    </section>
  );
}
