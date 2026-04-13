import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  Prisma,
  RoleType,
  TransportAssignmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateTransportAssignmentDto } from './dto/create-transport-assignment.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findDashboard(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);
    const [routes, vehicles, assignments, routeCounts, vehicleCounts] = await Promise.all([
      this.prisma.route.findMany({
        where: { schoolId },
        orderBy: [{ isActive: 'desc' }, { routeName: 'asc' }],
        take: 12,
      }),
      this.prisma.vehicle.findMany({
        where: { schoolId },
        orderBy: [{ isActive: 'desc' }, { vehicleNumber: 'asc' }],
        take: 12,
      }),
      this.prisma.transportAssignment.findMany({
        where: { schoolId },
        include: {
          academicSession: true,
          route: true,
          student: true,
          vehicle: true,
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        take: 25,
      }),
      this.prisma.transportAssignment.groupBy({
        by: ['routeId'],
        where: {
          schoolId,
          status: TransportAssignmentStatus.ACTIVE,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.transportAssignment.groupBy({
        by: ['vehicleId'],
        where: {
          schoolId,
          status: TransportAssignmentStatus.ACTIVE,
          vehicleId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const routeCountMap = new Map(
      routeCounts.map((item) => [item.routeId, item._count._all]),
    );
    const vehicleCountMap = new Map(
      vehicleCounts.map((item) => [item.vehicleId ?? '', item._count._all]),
    );
    const activeAssignments = assignments.filter(
      (item) => item.status === TransportAssignmentStatus.ACTIVE,
    );
    const estimatedMonthlyRevenue = activeAssignments.reduce((total, item) => {
      const amount = item.monthlyFeeOverride ?? item.route.monthlyFee;
      return total + (this.toNumber(amount) ?? 0);
    }, 0);

    return {
      success: true,
      message: 'Transport dashboard fetched successfully.',
      data: {
        summary: {
          activeRoutes: routes.filter((item) => item.isActive).length,
          activeVehicles: vehicles.filter((item) => item.isActive).length,
          activeAssignments: activeAssignments.length,
          estimatedMonthlyRevenue,
        },
        routes: routes.map((item) => ({
          id: item.id,
          schoolId: item.schoolId,
          routeCode: item.routeCode,
          routeName: item.routeName,
          startPoint: item.startPoint,
          endPoint: item.endPoint,
          distanceKm: this.toNumber(item.distanceKm),
          monthlyFee: this.toNumber(item.monthlyFee),
          isActive: item.isActive,
          status: item.isActive ? 'ACTIVE' : 'INACTIVE',
          activeAssignments: routeCountMap.get(item.id) ?? 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        vehicles: vehicles.map((item) => ({
          id: item.id,
          schoolId: item.schoolId,
          vehicleNumber: item.vehicleNumber,
          vehicleType: item.vehicleType,
          capacity: item.capacity,
          driverName: item.driverName,
          driverPhone: item.driverPhone,
          attendantName: item.attendantName,
          isActive: item.isActive,
          status: item.isActive ? 'ACTIVE' : 'INACTIVE',
          activeAssignments: vehicleCountMap.get(item.id) ?? 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        assignments: assignments.map((item) => ({
          id: item.id,
          schoolId: item.schoolId,
          sessionId: item.sessionId,
          startDate: item.startDate,
          endDate: item.endDate,
          pickupPoint: item.pickupPoint,
          dropPoint: item.dropPoint,
          monthlyFee: this.toNumber(item.monthlyFeeOverride ?? item.route.monthlyFee),
          status: item.status,
          session: {
            id: item.academicSession.id,
            name: item.academicSession.sessionName,
          },
          student: {
            id: item.student.id,
            name: item.student.fullName,
            studentCode: item.student.studentCode,
          },
          route: {
            id: item.route.id,
            code: item.route.routeCode,
            name: item.route.routeName,
          },
          vehicle: item.vehicle
            ? {
                id: item.vehicle.id,
                number: item.vehicle.vehicleNumber,
                type: item.vehicle.vehicleType,
              }
            : null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      },
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);
    const [sessions, students, routes, vehicles] = await Promise.all([
      this.prisma.academicSession.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        select: {
          id: true,
          sessionName: true,
          isCurrent: true,
        },
      }),
      this.prisma.student.findMany({
        where: {
          schoolId,
          status: 'ACTIVE',
          admissions: {
            some: {
              admissionStatus: {
                in: [AdmissionStatus.ACTIVE, AdmissionStatus.PROMOTED],
              },
            },
          },
        },
        orderBy: {
          fullName: 'asc',
        },
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          admissions: {
            where: {
              admissionStatus: {
                in: [AdmissionStatus.ACTIVE, AdmissionStatus.PROMOTED],
              },
            },
            take: 1,
            orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
            select: {
              academicClass: {
                select: {
                  className: true,
                },
              },
              section: {
                select: {
                  sectionName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.route.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: {
          routeName: 'asc',
        },
        select: {
          id: true,
          routeCode: true,
          routeName: true,
          monthlyFee: true,
        },
      }),
      this.prisma.vehicle.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: {
          vehicleNumber: 'asc',
        },
        select: {
          id: true,
          vehicleNumber: true,
          vehicleType: true,
          capacity: true,
        },
      }),
    ]);

    const currentSession = sessions.find((item) => item.isCurrent) ?? sessions[0] ?? null;

    return {
      success: true,
      message: 'Transport options fetched successfully.',
      data: {
        currentSessionId: currentSession?.id ?? null,
        currentSessionName: currentSession?.sessionName ?? null,
        sessions: sessions.map((item) => ({
          id: item.id,
          name: item.sessionName,
          isCurrent: item.isCurrent,
        })),
        students: students.map((item) => ({
          id: item.id,
          name: item.fullName,
          studentCode: item.studentCode,
          className: item.admissions[0]?.academicClass.className ?? null,
          sectionName: item.admissions[0]?.section?.sectionName ?? null,
        })),
        routes: routes.map((item) => ({
          id: item.id,
          routeCode: item.routeCode,
          routeName: item.routeName,
          monthlyFee: this.toNumber(item.monthlyFee),
        })),
        vehicles: vehicles.map((item) => ({
          id: item.id,
          vehicleNumber: item.vehicleNumber,
          vehicleType: item.vehicleType,
          capacity: item.capacity,
        })),
        assignmentStatuses: Object.values(TransportAssignmentStatus),
      },
    };
  }

  async createRoute(currentUser: JwtUser, dto: CreateRouteDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);

    try {
      const route = await this.prisma.route.create({
        data: {
          schoolId,
          routeCode: dto.routeCode.trim().toUpperCase(),
          routeName: dto.routeName.trim(),
          startPoint: dto.startPoint.trim(),
          endPoint: dto.endPoint.trim(),
          distanceKm:
            dto.distanceKm !== undefined ? new Prisma.Decimal(dto.distanceKm) : undefined,
          monthlyFee: new Prisma.Decimal(dto.monthlyFee),
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.write({
        action: 'transport.route.create',
        entity: 'route',
        entityId: route.id,
        actorUserId: currentUser.id,
        schoolId,
        metadata: {
          routeCode: route.routeCode,
          routeName: route.routeName,
        },
      });

      return {
        success: true,
        message: 'Transport route created successfully.',
        data: {
          id: route.id,
        },
      };
    } catch (error) {
      this.handleUniqueConstraint(error, 'A route with this code already exists.');
      throw error;
    }
  }

  async createVehicle(currentUser: JwtUser, dto: CreateVehicleDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);

    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          schoolId,
          vehicleNumber: dto.vehicleNumber.trim().toUpperCase(),
          vehicleType: dto.vehicleType?.trim() || null,
          capacity: dto.capacity,
          driverName: dto.driverName?.trim() || null,
          driverPhone: dto.driverPhone?.trim() || null,
          attendantName: dto.attendantName?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.write({
        action: 'transport.vehicle.create',
        entity: 'vehicle',
        entityId: vehicle.id,
        actorUserId: currentUser.id,
        schoolId,
        metadata: {
          vehicleNumber: vehicle.vehicleNumber,
        },
      });

      return {
        success: true,
        message: 'Vehicle created successfully.',
        data: {
          id: vehicle.id,
        },
      };
    } catch (error) {
      this.handleUniqueConstraint(error, 'A vehicle with this number already exists.');
      throw error;
    }
  }

  async createAssignment(currentUser: JwtUser, dto: CreateTransportAssignmentDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate.');
    }

    const [session, student, route, vehicle] = await Promise.all([
      this.prisma.academicSession.findFirst({
        where: {
          id: dto.sessionId,
          schoolId,
        },
      }),
      this.prisma.student.findFirst({
        where: {
          id: dto.studentId,
          schoolId,
        },
      }),
      this.prisma.route.findFirst({
        where: {
          id: dto.routeId,
          schoolId,
        },
      }),
      dto.vehicleId
        ? this.prisma.vehicle.findFirst({
            where: {
              id: dto.vehicleId,
              schoolId,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!session) {
      throw new NotFoundException('Academic session not found.');
    }

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    if (!route) {
      throw new NotFoundException('Route not found.');
    }

    if (dto.vehicleId && !vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }

    try {
      const assignment = await this.prisma.transportAssignment.create({
        data: {
          schoolId,
          sessionId: dto.sessionId,
          studentId: dto.studentId,
          routeId: dto.routeId,
          vehicleId: dto.vehicleId ?? null,
          pickupPoint: dto.pickupPoint?.trim() || null,
          dropPoint: dto.dropPoint?.trim() || null,
          monthlyFeeOverride:
            dto.monthlyFeeOverride !== undefined
              ? new Prisma.Decimal(dto.monthlyFeeOverride)
              : null,
          startDate,
          endDate,
          status: dto.status ?? TransportAssignmentStatus.ACTIVE,
        },
      });

      await this.auditService.write({
        action: 'transport.assignment.create',
        entity: 'transport-assignment',
        entityId: assignment.id,
        actorUserId: currentUser.id,
        schoolId,
        metadata: {
          studentId: dto.studentId,
          routeId: dto.routeId,
          sessionId: dto.sessionId,
          status: assignment.status,
        },
      });

      return {
        success: true,
        message: 'Transport assignment created successfully.',
        data: {
          id: assignment.id,
        },
      };
    } catch (error) {
      this.handleUniqueConstraint(
        error,
        'An assignment for this student and session already exists with the selected status.',
      );
      throw error;
    }
  }

  private resolveSchoolScope(currentUser: JwtUser, schoolIdOverride?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const schoolId = schoolIdOverride ?? currentUser.schoolId ?? null;

      if (!schoolId) {
        throw new BadRequestException('schoolId is required for this action.');
      }

      return schoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolIdOverride && schoolIdOverride !== currentUser.schoolId) {
      throw new NotFoundException('Transport data not found.');
    }

    return currentUser.schoolId;
  }

  private handleUniqueConstraint(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    return Number(value);
  }
}
