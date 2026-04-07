import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  AdmissionStatus,
  AttendanceStatus,
  ExamStatus,
  Prisma,
  RoleType,
  StudentStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const DASHBOARD_TTL_SECONDS = 60;
const DEFAULT_DAYS = 7;
const DEFAULT_MONTHS = 6;
const DEFAULT_ACTIVITY_LIMIT = 6;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async findOverview(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const cacheKey = this.buildCacheKey('overview', schoolId ?? 'all', {
      limit: query.limit ?? DEFAULT_ACTIVITY_LIMIT,
    });

    const data = await this.resolveDashboardData(
      'overview',
      () =>
        this.redisService.remember(
          cacheKey,
          DASHBOARD_TTL_SECONDS,
          async () => {
            const [todayAttendance, recentActivities, counts, feeTotals] =
              await Promise.all([
                this.getTodayAttendanceSummary(schoolId),
                this.getRecentActivities(
                  schoolId,
                  query.limit ?? DEFAULT_ACTIVITY_LIMIT,
                ),
                this.getOverviewCounts(schoolId),
                this.getFeeTotals(schoolId),
              ]);

            return {
              schoolId,
              totals: {
                students: counts.students,
                teachers: counts.teachers,
                staff: counts.staff,
                classes: counts.classes,
                subjects: counts.subjects,
                exams: counts.exams,
              },
              attendanceToday: todayAttendance,
              fees: feeTotals,
              recentActivities,
            };
          },
        ),
      () => this.buildEmptyOverview(schoolId),
    );

    return {
      success: true,
      message: 'Dashboard overview fetched successfully.',
      data,
    };
  }

  async findAttendance(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const days = query.days ?? DEFAULT_DAYS;
    const cacheKey = this.buildCacheKey('attendance', schoolId ?? 'all', { days });

    const data = await this.resolveDashboardData(
      'attendance',
      () =>
        this.redisService.remember(
          cacheKey,
          DASHBOARD_TTL_SECONDS,
          async () => {
            const [summary, chart] = await Promise.all([
              this.getTodayAttendanceSummary(schoolId),
              this.getAttendanceChart(schoolId, days),
            ]);

            return {
              schoolId,
              summary,
              chart,
            };
          },
        ),
      () => this.buildEmptyAttendance(schoolId),
    );

    return {
      success: true,
      message: 'Attendance analytics fetched successfully.',
      data,
    };
  }

  async findFees(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const months = query.months ?? DEFAULT_MONTHS;
    const cacheKey = this.buildCacheKey('fees', schoolId ?? 'all', { months });

    const data = await this.resolveDashboardData(
      'fees',
      () =>
        this.redisService.remember(
          cacheKey,
          DASHBOARD_TTL_SECONDS,
          async () => {
            const [totals, chart] = await Promise.all([
              this.getFeeTotals(schoolId),
              this.getFeeCollectionChart(schoolId, months),
            ]);

            return {
              schoolId,
              totals,
              chart,
            };
          },
        ),
      () => this.buildEmptyFees(schoolId),
    );

    return {
      success: true,
      message: 'Fee analytics fetched successfully.',
      data,
    };
  }

  async findClasses(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const cacheKey = this.buildCacheKey('classes', schoolId ?? 'all', {});

    const data = await this.resolveDashboardData(
      'classes',
      () =>
        this.redisService.remember(
          cacheKey,
          DASHBOARD_TTL_SECONDS,
          async () => {
            const distribution = await this.getClassDistribution(schoolId);

            return {
              schoolId,
              totalClasses: distribution.length,
              distribution,
            };
          },
        ),
      () => this.buildEmptyClasses(schoolId),
    );

    return {
      success: true,
      message: 'Class analytics fetched successfully.',
      data,
    };
  }

  async findExams(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const limit = query.limit ?? DEFAULT_ACTIVITY_LIMIT;
    const cacheKey = this.buildCacheKey('exams', schoolId ?? 'all', { limit });

    const data = await this.resolveDashboardData(
      'exams',
      () =>
        this.redisService.remember(
          cacheKey,
          DASHBOARD_TTL_SECONDS,
          async () => {
            const [summary, recentExams] = await Promise.all([
              this.getExamSummary(schoolId),
              this.prisma.exam.findMany({
                where: this.buildSchoolWhere(schoolId),
                orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
                take: limit,
                include: {
                  academicClass: {
                    select: {
                      id: true,
                      className: true,
                      classCode: true,
                    },
                  },
                },
              }),
            ]);

            return {
              schoolId,
              summary,
              recentExams: recentExams.map((exam) => ({
                id: exam.id,
                examCode: exam.examCode,
                examName: exam.examName,
                status: exam.status,
                startDate: exam.startDate,
                endDate: exam.endDate,
                class: exam.academicClass
                  ? {
                      id: exam.academicClass.id,
                      name: exam.academicClass.className,
                      classCode: exam.academicClass.classCode,
                    }
                  : null,
              })),
            };
          },
        ),
      () => this.buildEmptyExams(schoolId),
    );

    return {
      success: true,
      message: 'Exam analytics fetched successfully.',
      data,
    };
  }

  private async getOverviewCounts(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);

    const [students, teachers, staff, classes, subjects, exams] = await Promise.all([
      this.prisma.student.count({
        where: {
          ...schoolWhere,
          status: {
            not: StudentStatus.INACTIVE,
          },
        },
      }),
      this.prisma.user.count({
        where: {
          ...schoolWhere,
          isActive: true,
          userType: UserType.TEACHER,
        },
      }),
      this.prisma.user.count({
        where: {
          ...schoolWhere,
          isActive: true,
          userType: UserType.STAFF,
        },
      }),
      this.prisma.academicClass.count({
        where: {
          ...schoolWhere,
          isActive: true,
        },
      }),
      this.prisma.subject.count({
        where: {
          ...schoolWhere,
          isActive: true,
        },
      }),
      this.prisma.exam.count({
        where: schoolWhere,
      }),
    ]);

    return {
      students,
      teachers,
      staff,
      classes,
      subjects,
      exams,
    };
  }

  private async getTodayAttendanceSummary(schoolId: string | null) {
    const today = this.startOfDay(new Date());
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        ...this.buildSchoolWhere(schoolId),
        attendanceDate: today,
      },
      select: {
        status: true,
      },
    });

    return this.buildAttendanceSummary(records.map((record) => record.status));
  }

  private async getAttendanceChart(schoolId: string | null, days: number) {
    const endDate = this.startOfDay(new Date());
    const startDate = this.addDays(endDate, -(days - 1));
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        ...this.buildSchoolWhere(schoolId),
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        attendanceDate: true,
        status: true,
      },
      orderBy: {
        attendanceDate: 'asc',
      },
    });

    const buckets = new Map<
      string,
      {
        label: string;
        present: number;
        absent: number;
        late: number;
        leave: number;
      }
    >();

    for (let index = 0; index < days; index += 1) {
      const date = this.addDays(startDate, index);
      const key = this.toDateKey(date);
      buckets.set(key, {
        label: this.formatDayLabel(date),
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      });
    }

    for (const record of records) {
      const key = this.toDateKey(record.attendanceDate);
      const bucket = buckets.get(key);

      if (!bucket) {
        continue;
      }

      if (record.status === AttendanceStatus.PRESENT) {
        bucket.present += 1;
      }

      if (record.status === AttendanceStatus.ABSENT) {
        bucket.absent += 1;
      }

      if (record.status === AttendanceStatus.LATE) {
        bucket.late += 1;
      }

      if (
        record.status === AttendanceStatus.LEAVE ||
        record.status === AttendanceStatus.EXCUSED
      ) {
        bucket.leave += 1;
      }
    }

    return Array.from(buckets.values());
  }

  private async getFeeTotals(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const [assignedAggregate, paidAggregate, paymentsCount] = await Promise.all([
      this.prisma.feeAssignment.aggregate({
        where: {
          ...schoolWhere,
          status: {
            not: 'CANCELLED',
          },
        },
        _sum: {
          netAmount: true,
          paidAmount: true,
        },
      }),
      this.prisma.feePayment.aggregate({
        where: schoolWhere,
        _sum: {
          paidAmount: true,
        },
      }),
      this.prisma.feePayment.count({
        where: schoolWhere,
      }),
    ]);

    const assignedAmount = this.toNumber(assignedAggregate._sum.netAmount);
    const paidAgainstAssignments = this.toNumber(assignedAggregate._sum.paidAmount);
    const collectedAmount = this.toNumber(paidAggregate._sum.paidAmount);

    return {
      collected: collectedAmount,
      pending: Math.max(assignedAmount - paidAgainstAssignments, 0),
      assigned: assignedAmount,
      paymentCount: paymentsCount,
    };
  }

  private async getFeeCollectionChart(schoolId: string | null, months: number) {
    const currentMonth = this.startOfMonth(new Date());
    const startDate = this.addMonths(currentMonth, -(months - 1));
    const payments = await this.prisma.feePayment.findMany({
      where: {
        ...this.buildSchoolWhere(schoolId),
        paymentDate: {
          gte: startDate,
        },
      },
      select: {
        paymentDate: true,
        paidAmount: true,
      },
      orderBy: {
        paymentDate: 'asc',
      },
    });

    const buckets = new Map<string, { label: string; total: number }>();

    for (let index = 0; index < months; index += 1) {
      const monthDate = this.addMonths(startDate, index);
      const key = this.toMonthKey(monthDate);
      buckets.set(key, {
        label: this.formatMonthLabel(monthDate),
        total: 0,
      });
    }

    for (const payment of payments) {
      const key = this.toMonthKey(payment.paymentDate);
      const bucket = buckets.get(key);

      if (!bucket) {
        continue;
      }

      bucket.total += this.toNumber(payment.paidAmount);
    }

    return Array.from(buckets.values());
  }

  private async getClassDistribution(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const currentSessionId = await this.resolveCurrentSessionId(schoolId);

    const [classes, admissions] = await Promise.all([
      this.prisma.academicClass.findMany({
        where: {
          ...schoolWhere,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          classCode: true,
        },
      }),
      this.prisma.admission.groupBy({
        by: ['classId'],
        where: {
          ...schoolWhere,
          admissionStatus: AdmissionStatus.ACTIVE,
          ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        },
        _count: {
          classId: true,
        },
      }),
    ]);

    const counts = new Map(
      admissions.map((item) => [item.classId, item._count.classId]),
    );

    return classes.map((academicClass) => ({
      id: academicClass.id,
      classCode: academicClass.classCode,
      className: academicClass.className,
      totalStudents: counts.get(academicClass.id) ?? 0,
    }));
  }

  private async getExamSummary(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const [examGroups, reportCardAggregate] = await Promise.all([
      this.prisma.exam.groupBy({
        by: ['status'],
        where: schoolWhere,
        _count: {
          status: true,
        },
      }),
      this.prisma.reportCard.aggregate({
        where: schoolWhere,
        _avg: {
          percentage: true,
        },
      }),
    ]);

    const counts = {
      total: 0,
      draft: 0,
      scheduled: 0,
      ongoing: 0,
      published: 0,
      closed: 0,
    };

    for (const group of examGroups) {
      counts.total += group._count.status;

      if (group.status === ExamStatus.DRAFT) {
        counts.draft = group._count.status;
      }

      if (group.status === ExamStatus.SCHEDULED) {
        counts.scheduled = group._count.status;
      }

      if (group.status === ExamStatus.ONGOING) {
        counts.ongoing = group._count.status;
      }

      if (group.status === ExamStatus.PUBLISHED) {
        counts.published = group._count.status;
      }

      if (group.status === ExamStatus.CLOSED) {
        counts.closed = group._count.status;
      }
    }

    return {
      ...counts,
      averagePercentage: this.toNumber(reportCardAggregate._avg.percentage),
    };
  }

  private async getRecentActivities(schoolId: string | null, limit: number) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const [students, users, payments, exams] = await Promise.all([
      this.prisma.student.findMany({
        where: schoolWhere,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          createdAt: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          ...schoolWhere,
          schoolId: schoolId ?? undefined,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        include: {
          role: {
            select: {
              roleName: true,
            },
          },
        },
      }),
      this.prisma.feePayment.findMany({
        where: schoolWhere,
        orderBy: {
          paymentDate: 'desc',
        },
        take: limit,
        include: {
          feeAssignment: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  studentCode: true,
                },
              },
              feeStructure: {
                select: {
                  feeName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.exam.findMany({
        where: schoolWhere,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        select: {
          id: true,
          examName: true,
          examCode: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return [
      ...students.map((student) => ({
        id: `student-${student.id}`,
        type: 'student',
        title: student.fullName,
        description: `Student profile created (${student.studentCode}).`,
        timestamp: student.createdAt,
      })),
      ...users.map((user) => ({
        id: `user-${user.id}`,
        type: 'user',
        title: user.fullName,
        description: `${user.role.roleName} account added to the school.`,
        timestamp: user.createdAt,
      })),
      ...payments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: 'payment',
        title: payment.feeAssignment.student.fullName,
        description: `${this.toCurrency(payment.paidAmount)} collected for ${payment.feeAssignment.feeStructure.feeName}.`,
        timestamp: payment.paymentDate,
      })),
      ...exams.map((exam) => ({
        id: `exam-${exam.id}`,
        type: 'exam',
        title: exam.examName,
        description: `${exam.examCode} created with status ${exam.status.toLowerCase()}.`,
        timestamp: exam.createdAt,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  private resolveSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('A school-scoped authenticated user is required.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException(
        'You can only access dashboard data from your own school.',
      );
    }

    return currentUser.schoolId;
  }

  private async resolveDashboardData<T>(
    key: string,
    resolver: () => Promise<T>,
    fallback: () => T,
  ) {
    try {
      return await resolver();
    } catch (error) {
      if (!this.isRecoverableDashboardError(error)) {
        throw error;
      }

      this.logger.warn(
        `Dashboard ${key} fallback activated: ${this.getErrorMessage(error)}`,
      );
      return fallback();
    }
  }

  private buildSchoolWhere(schoolId: string | null): { schoolId?: string } {
    return schoolId ? { schoolId } : {};
  }

  private buildEmptyOverview(schoolId: string | null) {
    return {
      schoolId,
      totals: {
        students: 0,
        teachers: 0,
        staff: 0,
        classes: 0,
        subjects: 0,
        exams: 0,
      },
      attendanceToday: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      },
      fees: {
        collected: 0,
        pending: 0,
        assigned: 0,
        paymentCount: 0,
      },
      recentActivities: [],
    };
  }

  private buildEmptyAttendance(schoolId: string | null) {
    return {
      schoolId,
      summary: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      },
      chart: [],
    };
  }

  private buildEmptyFees(schoolId: string | null) {
    return {
      schoolId,
      totals: {
        collected: 0,
        pending: 0,
        assigned: 0,
        paymentCount: 0,
      },
      chart: [],
    };
  }

  private buildEmptyClasses(schoolId: string | null) {
    return {
      schoolId,
      totalClasses: 0,
      distribution: [],
    };
  }

  private buildEmptyExams(schoolId: string | null) {
    return {
      schoolId,
      summary: {
        total: 0,
        draft: 0,
        scheduled: 0,
        ongoing: 0,
        published: 0,
        closed: 0,
        averagePercentage: 0,
      },
      recentExams: [],
    };
  }

  private isRecoverableDashboardError(error: unknown) {
    const message = this.getErrorMessage(error).toLowerCase();

    return [
      "can't reach database server",
      'database server',
      'prisma',
      'redis',
      'econnrefused',
      'connection',
      'timed out',
      'timeout',
      'closed the connection',
    ].some((token) => message.includes(token));
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async resolveCurrentSessionId(schoolId: string | null) {
    if (!schoolId) {
      return null;
    }

    const currentSession = await this.prisma.academicSession.findFirst({
      where: {
        schoolId,
        isCurrent: true,
        isActive: true,
      },
      orderBy: {
        startDate: 'desc',
      },
      select: {
        id: true,
      },
    });

    return currentSession?.id ?? null;
  }

  private buildAttendanceSummary(statuses: AttendanceStatus[]) {
    const summary = {
      total: statuses.length,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };

    for (const status of statuses) {
      if (status === AttendanceStatus.PRESENT) {
        summary.present += 1;
      }

      if (status === AttendanceStatus.ABSENT) {
        summary.absent += 1;
      }

      if (status === AttendanceStatus.LATE) {
        summary.late += 1;
      }

      if (status === AttendanceStatus.LEAVE || status === AttendanceStatus.EXCUSED) {
        summary.leave += 1;
      }
    }

    return summary;
  }

  private buildCacheKey(
    key: string,
    scope: string,
    query: Record<string, string | number | null | undefined>,
  ) {
    const searchParams = new URLSearchParams();

    for (const [queryKey, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(queryKey, String(value));
      }
    }

    return `dashboard:${scope}:${key}:${searchParams.toString() || 'default'}`;
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private toCurrency(value: Prisma.Decimal | number | null | undefined) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(this.toNumber(value));
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addDays(date: Date, amount: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  private toDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatDayLabel(date: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  }

  private formatMonthLabel(date: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      year: '2-digit',
    }).format(date);
  }
}
