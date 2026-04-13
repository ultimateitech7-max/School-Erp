import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  AdmissionStatus,
  AttendanceStatus,
  ExamStatus,
  PaymentMode,
  Prisma,
  RoleType,
  StudentStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const DEFAULT_DAYS = 7;
const DEFAULT_MONTHS = 6;
const DEFAULT_ACTIVITY_LIMIT = 6;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findBootstrap(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const selectedDate = this.normalizeSelectedDate(query.date);
    const days = query.days ?? DEFAULT_DAYS;
    const months = query.months ?? DEFAULT_MONTHS;
    const limit = query.limit ?? DEFAULT_ACTIVITY_LIMIT;

    const [overview, attendance, fees, classes, exams] = await Promise.all([
      this.resolveDashboardData(
        'overview',
        () => this.buildOverviewData(schoolId, selectedDate, limit),
        () => this.buildEmptyOverview(schoolId, selectedDate),
      ),
      this.resolveDashboardData(
        'attendance',
        () => this.buildAttendanceData(schoolId, days),
        () => this.buildEmptyAttendance(schoolId),
      ),
      this.resolveDashboardData(
        'fees',
        () => this.buildFeesData(schoolId, months, selectedDate),
        () => this.buildEmptyFees(schoolId, selectedDate),
      ),
      this.resolveDashboardData(
        'classes',
        () => this.buildClassesData(schoolId),
        () => this.buildEmptyClasses(schoolId),
      ),
      this.resolveDashboardData(
        'exams',
        () => this.buildExamsData(schoolId, limit),
        () => this.buildEmptyExams(schoolId),
      ),
    ]);

    return {
      success: true,
      message: 'Dashboard bootstrap fetched successfully.',
      data: {
        overview,
        attendance,
        fees,
        classes,
        exams,
      },
    };
  }

  async findOverview(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const selectedDate = this.normalizeSelectedDate(query.date);

    const data = await this.resolveDashboardData(
      'overview',
      () =>
        this.buildOverviewData(
          schoolId,
          selectedDate,
          query.limit ?? DEFAULT_ACTIVITY_LIMIT,
        ),
      () => this.buildEmptyOverview(schoolId, selectedDate),
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

    const data = await this.resolveDashboardData(
      'attendance',
      () => this.buildAttendanceData(schoolId, days),
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
    const selectedDate = this.normalizeSelectedDate(query.date);

    const data = await this.resolveDashboardData(
      'fees',
      () => this.buildFeesData(schoolId, months, selectedDate),
      () => this.buildEmptyFees(schoolId, selectedDate),
    );

    return {
      success: true,
      message: 'Fee analytics fetched successfully.',
      data,
    };
  }

  async findClasses(currentUser: JwtUser, query: DashboardQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);

    const data = await this.resolveDashboardData(
      'classes',
      () => this.buildClassesData(schoolId),
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

    const data = await this.resolveDashboardData(
      'exams',
      () => this.buildExamsData(schoolId, limit),
      () => this.buildEmptyExams(schoolId),
    );

    return {
      success: true,
      message: 'Exam analytics fetched successfully.',
      data,
    };
  }

  private async buildOverviewData(
    schoolId: string | null,
    selectedDate: Date | null,
    limit: number,
  ) {
    const [todayAttendance, counts, feeTotals, recentActivities] = await Promise.all([
      this.getTodayAttendanceSummary(schoolId),
      this.getOverviewCounts(schoolId),
      this.getFeeTotals(schoolId, selectedDate),
      this.getRecentActivities(schoolId, limit),
    ]);

    return {
      schoolId,
      selectedDate: selectedDate ? this.toDateKey(selectedDate) : null,
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
  }

  private async buildAttendanceData(schoolId: string | null, days: number) {
    const [summary, chart] = await Promise.all([
      this.getTodayAttendanceSummary(schoolId),
      this.getAttendanceChart(schoolId, days),
    ]);

    return {
      schoolId,
      summary,
      chart,
    };
  }

  private async buildFeesData(
    schoolId: string | null,
    months: number,
    selectedDate: Date | null,
  ) {
    const [totals, chart] = await Promise.all([
      this.getFeeTotals(schoolId, selectedDate),
      this.getFeeCollectionChart(schoolId, months, selectedDate),
    ]);

    return {
      schoolId,
      selectedDate: selectedDate ? this.toDateKey(selectedDate) : null,
      totals,
      chart,
    };
  }

  private async buildClassesData(schoolId: string | null) {
    const distribution = await this.getClassDistribution(schoolId);

    return {
      schoolId,
      totalClasses: distribution.length,
      distribution,
    };
  }

  private async buildExamsData(schoolId: string | null, limit: number) {
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
  }

  private async getOverviewCounts(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);

    const [students, teachers, staff, classes, subjects, exams] =
      await Promise.all([
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
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: {
        ...this.buildSchoolWhere(schoolId),
        attendanceDate: today,
      },
      _count: {
        status: true,
      },
    });

    return this.buildAttendanceSummaryFromGroups(
      grouped.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
    );
  }

  private async getAttendanceChart(schoolId: string | null, days: number) {
    const endDate = this.startOfDay(new Date());
    const startDate = this.addDays(endDate, -(days - 1));
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['attendanceDate', 'status'],
      where: {
        ...this.buildSchoolWhere(schoolId),
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        attendanceDate: 'asc',
      },
      _count: {
        status: true,
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

    for (const record of grouped) {
      const key = this.toDateKey(record.attendanceDate);
      const bucket = buckets.get(key);

      if (!bucket) {
        continue;
      }

      const count = record._count.status;

      if (record.status === AttendanceStatus.PRESENT) {
        bucket.present += count;
      }

      if (record.status === AttendanceStatus.ABSENT) {
        bucket.absent += count;
      }

      if (record.status === AttendanceStatus.LATE) {
        bucket.late += count;
      }

      if (
        record.status === AttendanceStatus.LEAVE ||
        record.status === AttendanceStatus.EXCUSED
      ) {
        bucket.leave += count;
      }
    }

    return Array.from(buckets.values());
  }

  private async getFeeTotals(schoolId: string | null, selectedDate?: Date | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const paymentDateWhere = this.buildPaymentDateWhere(selectedDate ?? null);
    const [assignedAggregate, paidAggregate, paymentsCount, byMethod] =
      await Promise.all([
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
          where: {
            ...schoolWhere,
            ...paymentDateWhere,
          },
          _sum: {
            paidAmount: true,
          },
        }),
        this.prisma.feePayment.count({
          where: {
            ...schoolWhere,
            ...paymentDateWhere,
          },
        }),
        this.getFeePaymentMethodBreakdown(schoolId, selectedDate ?? null),
      ]);

    const assignedAmount = this.toNumber(assignedAggregate._sum.netAmount);
    const paidAgainstAssignments = this.toNumber(assignedAggregate._sum.paidAmount);
    const collectedAmount = this.toNumber(paidAggregate._sum.paidAmount);

    return {
      collected: collectedAmount,
      pending: Math.max(assignedAmount - paidAgainstAssignments, 0),
      assigned: assignedAmount,
      paymentCount: paymentsCount,
      byMethod,
    };
  }

  private async getFeeCollectionChart(
    schoolId: string | null,
    months: number,
    selectedDate?: Date | null,
  ) {
    if (selectedDate) {
      return this.getFeeCollectionDayChart(schoolId, selectedDate);
    }

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

  private async getFeeCollectionDayChart(schoolId: string | null, selectedDate: Date) {
    const endDate = this.addDays(this.startOfDay(selectedDate), 1);
    const startDate = this.addDays(endDate, -7);
    const payments = await this.prisma.feePayment.findMany({
      where: {
        ...this.buildSchoolWhere(schoolId),
        paymentDate: {
          gte: startDate,
          lt: endDate,
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

    for (let index = 0; index < 7; index += 1) {
      const date = this.addDays(startDate, index);
      const key = this.toDateKey(date);
      buckets.set(key, {
        label: this.formatDayLabel(date),
        total: 0,
      });
    }

    for (const payment of payments) {
      const key = this.toDateKey(payment.paymentDate);
      const bucket = buckets.get(key);

      if (!bucket) {
        continue;
      }

      bucket.total += this.toNumber(payment.paidAmount);
    }

    return Array.from(buckets.values());
  }

  private async getFeePaymentMethodBreakdown(
    schoolId: string | null,
    selectedDate: Date | null,
  ) {
    const payments = await this.prisma.feePayment.findMany({
      where: {
        ...this.buildSchoolWhere(schoolId),
        ...this.buildPaymentDateWhere(selectedDate),
      },
      select: {
        paidAmount: true,
        feeReceipt: {
          select: {
            paymentMode: true,
          },
        },
      },
    });

    const buckets = new Map<PaymentMode, { method: PaymentMode; total: number; count: number }>();

    for (const payment of payments) {
      const method = payment.feeReceipt.paymentMode;
      const bucket = buckets.get(method) ?? {
        method,
        total: 0,
        count: 0,
      };

      bucket.total += this.toNumber(payment.paidAmount);
      bucket.count += 1;
      buckets.set(method, bucket);
    }

    return Array.from(buckets.values()).sort((left, right) => right.total - left.total);
  }

  private async getClassDistribution(schoolId: string | null) {
    const schoolWhere = this.buildSchoolWhere(schoolId);
    const currentSessionId = await this.resolveCurrentSessionId(schoolId);

    const classes = await this.prisma.academicClass.findMany({
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
    });
    const admissions = await this.prisma.admission.groupBy({
      by: ['classId'],
      where: {
        ...schoolWhere,
        admissionStatus: AdmissionStatus.ACTIVE,
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
      },
      _count: {
        classId: true,
      },
    });

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

  private buildEmptyOverview(schoolId: string | null, selectedDate?: Date | null) {
    return {
      schoolId,
      selectedDate: selectedDate ? this.toDateKey(selectedDate) : null,
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
        byMethod: [],
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

  private buildEmptyFees(schoolId: string | null, selectedDate?: Date | null) {
    return {
      schoolId,
      selectedDate: selectedDate ? this.toDateKey(selectedDate) : null,
      totals: {
        collected: 0,
        pending: 0,
        assigned: 0,
        paymentCount: 0,
        byMethod: [],
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

  private buildAttendanceSummaryFromGroups(
    groups: Array<{ status: AttendanceStatus; count: number }>,
  ) {
    const summary = {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };

    for (const group of groups) {
      summary.total += group.count;

      if (group.status === AttendanceStatus.PRESENT) {
        summary.present += group.count;
      }

      if (group.status === AttendanceStatus.ABSENT) {
        summary.absent += group.count;
      }

      if (group.status === AttendanceStatus.LATE) {
        summary.late += group.count;
      }

      if (
        group.status === AttendanceStatus.LEAVE ||
        group.status === AttendanceStatus.EXCUSED
      ) {
        summary.leave += group.count;
      }
    }

    return summary;
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

  private normalizeSelectedDate(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : this.startOfDay(parsed);
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

  private buildPaymentDateWhere(selectedDate: Date | null) {
    if (!selectedDate) {
      return {};
    }

    return {
      paymentDate: {
        gte: selectedDate,
        lt: this.addDays(selectedDate, 1),
      },
    } satisfies Prisma.FeePaymentWhereInput;
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
