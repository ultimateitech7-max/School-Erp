'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableCell, TableHeadCell, TableWrap } from '@/components/ui/table';
import {
  apiFetch,
  type ApiSuccessResponse,
  type CreateTransportAssignmentPayload,
  type CreateTransportRoutePayload,
  type CreateTransportVehiclePayload,
  type TransportAssignmentStatus,
  type TransportDashboardPayload,
  type TransportOptionsPayload,
} from '@/utils/api';

const emptyDashboard: TransportDashboardPayload = {
  summary: {
    activeRoutes: 0,
    activeVehicles: 0,
    activeAssignments: 0,
    estimatedMonthlyRevenue: 0,
  },
  routes: [],
  vehicles: [],
  assignments: [],
};

const emptyOptions: TransportOptionsPayload = {
  currentSessionId: null,
  currentSessionName: null,
  sessions: [],
  students: [],
  routes: [],
  vehicles: [],
  assignmentStatuses: ['ACTIVE', 'INACTIVE', 'STOPPED'],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function TransportPage() {
  const [dashboard, setDashboard] = useState<TransportDashboardPayload>(emptyDashboard);
  const [options, setOptions] = useState<TransportOptionsPayload>(emptyOptions);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [routeForm, setRouteForm] = useState<CreateTransportRoutePayload>({
    routeCode: '',
    routeName: '',
    startPoint: '',
    endPoint: '',
    monthlyFee: 0,
  });
  const [vehicleForm, setVehicleForm] = useState<CreateTransportVehiclePayload>({
    vehicleNumber: '',
    vehicleType: '',
    capacity: 40,
    driverName: '',
    driverPhone: '',
    attendantName: '',
  });
  const [assignmentForm, setAssignmentForm] = useState<CreateTransportAssignmentPayload>({
    sessionId: '',
    studentId: '',
    routeId: '',
    vehicleId: '',
    pickupPoint: '',
    dropPoint: '',
    monthlyFeeOverride: undefined,
    startDate: new Date().toISOString().slice(0, 10),
    status: 'ACTIVE',
  });
  const [submittingRoute, setSubmittingRoute] = useState(false);
  const [submittingVehicle, setSubmittingVehicle] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const loadTransport = async () => {
    const [dashboardResponse, optionsResponse] = await Promise.all([
      apiFetch<ApiSuccessResponse<TransportDashboardPayload>>('/transport'),
      apiFetch<ApiSuccessResponse<TransportOptionsPayload>>('/transport/options'),
    ]);

    setDashboard(dashboardResponse.data);
    setOptions(optionsResponse.data);
    setAssignmentForm((current) => ({
      ...current,
      sessionId: current.sessionId || optionsResponse.data.currentSessionId || '',
      routeId: current.routeId || optionsResponse.data.routes[0]?.id || '',
      vehicleId: current.vehicleId || optionsResponse.data.vehicles[0]?.id || '',
    }));
  };

  useEffect(() => {
    setLoading(true);

    void loadTransport()
      .catch((error) => {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'Failed to load transport workspace.',
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleRouteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingRoute(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string }>>(
        '/transport/routes',
        {
          method: 'POST',
          body: JSON.stringify({
            ...routeForm,
            distanceKm:
              routeForm.distanceKm === undefined || Number.isNaN(routeForm.distanceKm)
                ? undefined
                : routeForm.distanceKm,
          }),
        },
      );

      setMessage({ type: 'success', text: response.message });
      setRouteForm({
        routeCode: '',
        routeName: '',
        startPoint: '',
        endPoint: '',
        monthlyFee: 0,
      });
      await loadTransport();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to create transport route.',
      });
    } finally {
      setSubmittingRoute(false);
    }
  };

  const handleVehicleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingVehicle(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string }>>(
        '/transport/vehicles',
        {
          method: 'POST',
          body: JSON.stringify({
            ...vehicleForm,
            vehicleType: vehicleForm.vehicleType?.trim() || undefined,
            driverName: vehicleForm.driverName?.trim() || undefined,
            driverPhone: vehicleForm.driverPhone?.trim() || undefined,
            attendantName: vehicleForm.attendantName?.trim() || undefined,
          }),
        },
      );

      setMessage({ type: 'success', text: response.message });
      setVehicleForm({
        vehicleNumber: '',
        vehicleType: '',
        capacity: 40,
        driverName: '',
        driverPhone: '',
        attendantName: '',
      });
      await loadTransport();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error ? error.message : 'Failed to create vehicle.',
      });
    } finally {
      setSubmittingVehicle(false);
    }
  };

  const handleAssignmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingAssignment(true);
    setMessage(null);

    try {
      const response = await apiFetch<ApiSuccessResponse<{ id: string }>>(
        '/transport/assignments',
        {
          method: 'POST',
          body: JSON.stringify({
            ...assignmentForm,
            vehicleId: assignmentForm.vehicleId?.trim() || undefined,
            pickupPoint: assignmentForm.pickupPoint?.trim() || undefined,
            dropPoint: assignmentForm.dropPoint?.trim() || undefined,
            monthlyFeeOverride:
              assignmentForm.monthlyFeeOverride === undefined ||
              Number.isNaN(assignmentForm.monthlyFeeOverride)
                ? undefined
                : assignmentForm.monthlyFeeOverride,
          }),
        },
      );

      setMessage({ type: 'success', text: response.message });
      setAssignmentForm((current) => ({
        ...current,
        studentId: '',
        pickupPoint: '',
        dropPoint: '',
        monthlyFeeOverride: undefined,
        startDate: new Date().toISOString().slice(0, 10),
        status: 'ACTIVE',
      }));
      await loadTransport();
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Failed to create transport assignment.',
      });
    } finally {
      setSubmittingAssignment(false);
    }
  };

  return (
    <div className="dashboard-stack transport-page">
      {message ? <Banner tone={message.type}>{message.text}</Banner> : null}

      <section className="summary-cards-grid transport-summary-grid">
        <article className="card summary-card compact-summary-card">
          <p>Active Routes</p>
          <strong>{dashboard.summary.activeRoutes}</strong>
          <span>Configured pickup and drop corridors</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <p>Active Vehicles</p>
          <strong>{dashboard.summary.activeVehicles}</strong>
          <span>Buses and vans currently marked active</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <p>Live Assignments</p>
          <strong>{dashboard.summary.activeAssignments}</strong>
          <span>Students mapped to routes for transport</span>
        </article>
        <article className="card summary-card compact-summary-card">
          <p>Monthly Revenue</p>
          <strong>{formatCurrency(dashboard.summary.estimatedMonthlyRevenue)}</strong>
          <span>Estimated recurring fee from active transport plans</span>
        </article>
      </section>

      <div className="transport-forms-grid">
        <section className="card panel compact-panel-stack">
          <div className="panel-heading compact-panel-heading">
            <div>
              <h2>Add Route</h2>
              <p className="muted-text">Create a route in one compact row.</p>
            </div>
          </div>
          <form className="form-grid compact-form-grid transport-form-grid" onSubmit={handleRouteSubmit}>
            <label>
              <span>Route Code</span>
              <input
                required
                type="text"
                value={routeForm.routeCode}
                onChange={(event) =>
                  setRouteForm((current) => ({ ...current, routeCode: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Route Name</span>
              <input
                required
                type="text"
                value={routeForm.routeName}
                onChange={(event) =>
                  setRouteForm((current) => ({ ...current, routeName: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Start Point</span>
              <input
                required
                type="text"
                value={routeForm.startPoint}
                onChange={(event) =>
                  setRouteForm((current) => ({ ...current, startPoint: event.target.value }))
                }
              />
            </label>
            <label>
              <span>End Point</span>
              <input
                required
                type="text"
                value={routeForm.endPoint}
                onChange={(event) =>
                  setRouteForm((current) => ({ ...current, endPoint: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Distance (km)</span>
              <input
                min="0"
                step="0.1"
                type="number"
                value={routeForm.distanceKm ?? ''}
                onChange={(event) =>
                  setRouteForm((current) => ({
                    ...current,
                    distanceKm: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label>
              <span>Monthly Fee</span>
              <input
                min="0"
                required
                step="1"
                type="number"
                value={routeForm.monthlyFee}
                onChange={(event) =>
                  setRouteForm((current) => ({
                    ...current,
                    monthlyFee: Number(event.target.value),
                  }))
                }
              />
            </label>
            <div className="transport-form-submit">
              <button className="primary-button" disabled={submittingRoute} type="submit">
                {submittingRoute ? 'Saving...' : 'Add Route'}
              </button>
            </div>
          </form>
        </section>

        <section className="card panel compact-panel-stack">
          <div className="panel-heading compact-panel-heading">
            <div>
              <h2>Add Vehicle</h2>
              <p className="muted-text">Keep vehicle details tight and usable.</p>
            </div>
          </div>
          <form className="form-grid compact-form-grid transport-form-grid" onSubmit={handleVehicleSubmit}>
            <label>
              <span>Vehicle Number</span>
              <input
                required
                type="text"
                value={vehicleForm.vehicleNumber}
                onChange={(event) =>
                  setVehicleForm((current) => ({
                    ...current,
                    vehicleNumber: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Vehicle Type</span>
              <input
                placeholder="Bus / Van"
                type="text"
                value={vehicleForm.vehicleType ?? ''}
                onChange={(event) =>
                  setVehicleForm((current) => ({ ...current, vehicleType: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Capacity</span>
              <input
                min="1"
                required
                step="1"
                type="number"
                value={vehicleForm.capacity}
                onChange={(event) =>
                  setVehicleForm((current) => ({
                    ...current,
                    capacity: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>Driver Name</span>
              <input
                type="text"
                value={vehicleForm.driverName ?? ''}
                onChange={(event) =>
                  setVehicleForm((current) => ({ ...current, driverName: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Driver Phone</span>
              <input
                type="text"
                value={vehicleForm.driverPhone ?? ''}
                onChange={(event) =>
                  setVehicleForm((current) => ({ ...current, driverPhone: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Attendant</span>
              <input
                type="text"
                value={vehicleForm.attendantName ?? ''}
                onChange={(event) =>
                  setVehicleForm((current) => ({
                    ...current,
                    attendantName: event.target.value,
                  }))
                }
              />
            </label>
            <div className="transport-form-submit">
              <button className="primary-button" disabled={submittingVehicle} type="submit">
                {submittingVehicle ? 'Saving...' : 'Add Vehicle'}
              </button>
            </div>
          </form>
        </section>

        <section className="card panel compact-panel-stack">
          <div className="panel-heading compact-panel-heading">
            <div>
              <h2>Assign Student</h2>
              <p className="muted-text">Map student, route, vehicle, and fee in one block.</p>
            </div>
          </div>
          <form className="form-grid compact-form-grid transport-form-grid" onSubmit={handleAssignmentSubmit}>
            <label>
              <span>Session</span>
              <select
                required
                value={assignmentForm.sessionId}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, sessionId: event.target.value }))
                }
              >
                <option value="">Select session</option>
                {options.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                    {session.isCurrent ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Student</span>
              <select
                required
                value={assignmentForm.studentId}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, studentId: event.target.value }))
                }
              >
                <option value="">Select student</option>
                {options.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.studentCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Route</span>
              <select
                required
                value={assignmentForm.routeId}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, routeId: event.target.value }))
                }
              >
                <option value="">Select route</option>
                {options.routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.routeName} - {route.routeCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Vehicle</span>
              <select
                value={assignmentForm.vehicleId ?? ''}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, vehicleId: event.target.value }))
                }
              >
                <option value="">No vehicle</option>
                {options.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleNumber}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Pickup Point</span>
              <input
                type="text"
                value={assignmentForm.pickupPoint ?? ''}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, pickupPoint: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Drop Point</span>
              <input
                type="text"
                value={assignmentForm.dropPoint ?? ''}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, dropPoint: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Fee Override</span>
              <input
                min="0"
                step="1"
                type="number"
                value={assignmentForm.monthlyFeeOverride ?? ''}
                onChange={(event) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    monthlyFeeOverride: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  }))
                }
              />
            </label>
            <label>
              <span>Start Date</span>
              <input
                required
                type="date"
                value={assignmentForm.startDate}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </label>
            <label>
              <span>End Date</span>
              <input
                type="date"
                value={assignmentForm.endDate ?? ''}
                onChange={(event) =>
                  setAssignmentForm((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={assignmentForm.status}
                onChange={(event) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    status: event.target.value as TransportAssignmentStatus,
                  }))
                }
              >
                {options.assignmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="transport-form-submit">
              <button className="primary-button" disabled={submittingAssignment} type="submit">
                {submittingAssignment ? 'Saving...' : 'Assign Student'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {loading ? <Banner tone="info">Loading transport workspace...</Banner> : null}

      {!loading ? (
        <>
          <div className="transport-list-grid">
            <section className="card panel compact-panel-stack">
              <div className="panel-heading compact-panel-heading">
                <div>
                  <h2>Routes</h2>
                  <p className="muted-text">Compact route register with fee and load.</p>
                </div>
              </div>

              {dashboard.routes.length === 0 ? (
                <EmptyState
                  title="No routes yet."
                  description="Create your first route to start transport planning."
                />
              ) : (
                <TableWrap className="compact-table-wrap">
                  <Table>
                    <thead>
                      <tr>
                        <TableHeadCell>Code</TableHeadCell>
                        <TableHeadCell>Route</TableHeadCell>
                        <TableHeadCell>Fee</TableHeadCell>
                        <TableHeadCell>Load</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.routes.map((route) => (
                        <tr key={route.id}>
                          <TableCell>{route.routeCode}</TableCell>
                          <TableCell>
                            <div className="table-primary-cell">
                              <strong>{route.routeName}</strong>
                              <span className="muted-text">
                                {route.startPoint} to {route.endPoint}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(route.monthlyFee)}</TableCell>
                          <TableCell>{route.activeAssignments}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </section>

            <section className="card panel compact-panel-stack">
              <div className="panel-heading compact-panel-heading">
                <div>
                  <h2>Vehicles</h2>
                  <p className="muted-text">Availability, capacity, and crew in one place.</p>
                </div>
              </div>

              {dashboard.vehicles.length === 0 ? (
                <EmptyState
                  title="No vehicles yet."
                  description="Add buses or vans so assignments can be mapped properly."
                />
              ) : (
                <TableWrap className="compact-table-wrap">
                  <Table>
                    <thead>
                      <tr>
                        <TableHeadCell>Vehicle</TableHeadCell>
                        <TableHeadCell>Driver</TableHeadCell>
                        <TableHeadCell>Capacity</TableHeadCell>
                        <TableHeadCell>Load</TableHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.vehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <TableCell>
                            <div className="table-primary-cell">
                              <strong>{vehicle.vehicleNumber}</strong>
                              <span className="muted-text">
                                {vehicle.vehicleType || 'Vehicle'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{vehicle.driverName || '-'}</TableCell>
                          <TableCell>{vehicle.capacity}</TableCell>
                          <TableCell>{vehicle.activeAssignments}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </section>
          </div>

          <section className="card panel compact-panel-stack">
            <div className="panel-heading compact-panel-heading">
              <div>
                <h2>Assignments</h2>
                <p className="muted-text">Recent transport links for students, routes, and vehicles.</p>
              </div>
            </div>

            {dashboard.assignments.length === 0 ? (
              <EmptyState
                title="No assignments yet."
                description="Assign a student to a route to start live transport tracking."
              />
            ) : (
              <TableWrap className="compact-table-wrap">
                <Table>
                  <thead>
                    <tr>
                      <TableHeadCell>Student</TableHeadCell>
                      <TableHeadCell>Session</TableHeadCell>
                      <TableHeadCell>Route</TableHeadCell>
                      <TableHeadCell>Vehicle</TableHeadCell>
                      <TableHeadCell>Pickup / Drop</TableHeadCell>
                      <TableHeadCell>Fee</TableHeadCell>
                      <TableHeadCell>Start</TableHeadCell>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <TableCell>
                          <div className="table-primary-cell">
                            <strong>{assignment.student.name}</strong>
                            <span className="muted-text">{assignment.student.studentCode}</span>
                          </div>
                        </TableCell>
                        <TableCell>{assignment.session.name}</TableCell>
                        <TableCell>
                          {assignment.route.name} ({assignment.route.code})
                        </TableCell>
                        <TableCell>{assignment.vehicle?.number ?? 'Not mapped'}</TableCell>
                        <TableCell>
                          {assignment.pickupPoint || '-'} / {assignment.dropPoint || '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(assignment.monthlyFee)}</TableCell>
                        <TableCell>{formatDate(assignment.startDate)}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
