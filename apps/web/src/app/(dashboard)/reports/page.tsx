'use client';

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CsvDownloadButton } from '@/components/ui/csv-download-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Select } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  apiFetch,
  createQueryString,
  type AcademicClassRecord,
  type AcademicSessionRecord,
  type ApiSuccessResponse,
  type AttendanceReportPayload,
  type FeesReportPayload,
  type ResultsReportPayload,
} from '@/utils/api';
import {
  attendanceReportCsvColumns,
  feesReportCsvColumns,
  resultsReportCsvColumns,
} from '@/utils/csv-exporters';
import { buildCsvFilename, exportRowsToCsv } from '@/utils/csv';

export default function ReportsPage() {
  const [classes, setClasses] = useState<AcademicClassRecord[]>([]);
  const [sessions, setSessions] = useState<AcademicSessionRecord[]>([]);
  const [classId, setClassId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [attendance, setAttendance] = useState<AttendanceReportPayload | null>(null);
  const [fees, setFees] = useState<FeesReportPayload | null>(null);
  const [results, setResults] = useState<ResultsReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<ApiSuccessResponse<AcademicClassRecord[]>>('/classes?page=1&limit=100'),
      apiFetch<ApiSuccessResponse<AcademicSessionRecord[]>>('/academic-sessions?page=1&limit=100'),
    ])
      .then(([classResponse, sessionResponse]) => {
        setClasses(classResponse.data);
        setSessions(sessionResponse.data);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error ? error.message : 'Failed to load report filters.',
        );
      });
  }, []);

  useEffect(() => {
    setLoading(true);

    const query = createQueryString({
      classId: classId || undefined,
      sessionId: sessionId || undefined,
    });

    void Promise.all([
      apiFetch<ApiSuccessResponse<AttendanceReportPayload>>(`/reports/attendance${query}`),
      apiFetch<ApiSuccessResponse<FeesReportPayload>>(`/reports/fees${query}`),
      apiFetch<ApiSuccessResponse<ResultsReportPayload>>(`/reports/results${query}`),
    ])
      .then(([attendanceResponse, feesResponse, resultsResponse]) => {
        setAttendance(attendanceResponse.data);
        setFees(feesResponse.data);
        setResults(resultsResponse.data);
      })
      .catch((error) => {
        setAttendance(null);
        setFees(null);
        setResults(null);
        setMessage(
          error instanceof Error ? error.message : 'Failed to load reports.',
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [classId, sessionId]);

  const exportAttendanceCsv = async () => {
    const count = exportRowsToCsv(
      attendance?.classes ?? [],
      attendanceReportCsvColumns,
      buildCsvFilename('attendance-report'),
    );
    setMessage(`Downloaded ${count} attendance report row${count === 1 ? '' : 's'} as CSV.`);
  };

  const exportFeesCsv = async () => {
    const count = exportRowsToCsv(
      fees?.classes ?? [],
      feesReportCsvColumns,
      buildCsvFilename('fees-report'),
    );
    setMessage(`Downloaded ${count} fee report row${count === 1 ? '' : 's'} as CSV.`);
  };

  const exportResultsCsv = async () => {
    const count = exportRowsToCsv(
      results?.exams ?? [],
      resultsReportCsvColumns,
      buildCsvFilename('results-report'),
    );
    setMessage(`Downloaded ${count} result report row${count === 1 ? '' : 's'} as CSV.`);
  };

  return (
    <div className="dashboard-stack">
      <section className="card panel academic-toolbar">
        <div>
          <h2>Operational Reports</h2>
          <p className="muted-text">
            Review attendance, fees, and result performance with class and session filters.
          </p>
        </div>

        <div className="toolbar-actions">
          <Field label="Academic Session">
            <Select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">All sessions</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Class">
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.className}
                </option>
              ))}
            </Select>
          </Field>

          <Button onClick={() => window.print()} type="button" variant="secondary">
            Print / Export
          </Button>
        </div>
      </section>

      {message ? <Banner tone="error">{message}</Banner> : null}

      {loading ? (
        <section className="card panel">
          <Spinner label="Loading reports..." />
        </section>
      ) : !attendance || !fees || !results ? (
        <EmptyState
          title="Reports unavailable"
          description={message ?? 'Report data could not be loaded.'}
        />
      ) : (
        <>
          <div className="summary-cards-grid compact-grid">
            <article className="summary-card">
              <div className="summary-card-top">
                <Badge tone="info">Attendance</Badge>
              </div>
              <p>Present percentage</p>
              <strong>{attendance.summary.percentage}%</strong>
              <span>
                {attendance.summary.present} present • {attendance.summary.absent} absent
              </span>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <Badge tone="success">Fees</Badge>
              </div>
              <p>Total paid</p>
              <strong>{fees.summary.totalPaid.toLocaleString('en-IN')}</strong>
              <span>Due {fees.summary.totalDue.toLocaleString('en-IN')}</span>
            </article>

            <article className="summary-card">
              <div className="summary-card-top">
                <Badge tone="warning">Results</Badge>
              </div>
              <p>Average performance</p>
              <strong>{results.summary.averagePercentage}%</strong>
              <span>{results.summary.totalExams} exams analysed</span>
            </article>
          </div>

          <div className="academic-grid">
            <section className="card panel">
              <div className="panel-heading">
                <div>
                  <h2>Attendance Summary</h2>
                  <p className="muted-text">Class-wise attendance totals.</p>
                </div>
                <CsvDownloadButton
                  label="Download CSV"
                  loadingLabel="Exporting..."
                  onDownload={exportAttendanceCsv}
                />
              </div>
              {attendance.classes.length ? (
                <div className="responsive-table">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Code</th>
                        <th>Total Records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.classes.map((item) => (
                        <tr key={item.classId}>
                          <td>{item.className}</td>
                          <td>{item.classCode}</td>
                          <td>{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No attendance data" description="No records matched the selected filters." />
              )}
            </section>

            <section className="card panel">
              <div className="panel-heading">
                <div>
                  <h2>Fees Summary</h2>
                  <p className="muted-text">Assigned, paid, and due amounts by class.</p>
                </div>
                <CsvDownloadButton
                  label="Download CSV"
                  loadingLabel="Exporting..."
                  onDownload={exportFeesCsv}
                />
              </div>
              {fees.classes.length ? (
                <div className="responsive-table">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Assigned</th>
                        <th>Paid</th>
                        <th>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.classes.map((item) => (
                        <tr key={item.classId}>
                          <td>{item.className}</td>
                          <td>{item.totalAssigned.toLocaleString('en-IN')}</td>
                          <td>{item.totalPaid.toLocaleString('en-IN')}</td>
                          <td>{item.totalDue.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No fee data" description="No fee assignments matched the selected filters." />
              )}
            </section>
          </div>

          <section className="card panel">
            <div className="panel-heading">
              <div>
                <h2>Result Overview</h2>
                <p className="muted-text">Average class performance by exam.</p>
              </div>
              <CsvDownloadButton
                label="Download CSV"
                loadingLabel="Exporting..."
                onDownload={exportResultsCsv}
              />
            </div>
            {results.exams.length ? (
              <div className="responsive-table">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Class</th>
                      <th>Average %</th>
                      <th>Marks Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.exams.map((item) => (
                      <tr key={item.examId}>
                        <td>{item.examName}</td>
                        <td>{item.className}</td>
                        <td>{item.averagePercentage}%</td>
                        <td>{item.marksCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No result data" description="No exam results matched the selected filters." />
            )}
          </section>
        </>
      )}
    </div>
  );
}
