import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma, RoleType, StudentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAttendanceReport(currentUser: JwtUser, query: ReportQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    await this.validateClassAndSession(schoolId, query.classId, query.sessionId);

    const where: Prisma.AttendanceRecordWhereInput = {
      schoolId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
    };

    const total = await this.prisma.attendanceRecord.count({ where });
    const present = await this.prisma.attendanceRecord.count({
      where: { ...where, status: AttendanceStatus.PRESENT },
    });
    const absent = await this.prisma.attendanceRecord.count({
      where: { ...where, status: AttendanceStatus.ABSENT },
    });
    const late = await this.prisma.attendanceRecord.count({
      where: { ...where, status: AttendanceStatus.LATE },
    });
    const leave = await this.prisma.attendanceRecord.count({
      where: { ...where, status: AttendanceStatus.LEAVE },
    });
    const byClass = await this.prisma.attendanceRecord.groupBy({
      by: ['classId'],
      where,
      _count: {
        _all: true,
      },
    });

    const classes = byClass.length
      ? await this.prisma.academicClass.findMany({
          where: {
            id: {
              in: byClass.map((entry) => entry.classId),
            },
          },
          select: {
            id: true,
            className: true,
            classCode: true,
          },
        })
      : [];

    return {
      success: true,
      message: 'Attendance report fetched successfully.',
      data: {
        summary: {
          total,
          present,
          absent,
          late,
          leave,
          percentage: total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0,
        },
        classes: byClass.map((entry) => {
          const academicClass = classes.find((item) => item.id === entry.classId);

          return {
            classId: entry.classId,
            className: academicClass?.className ?? 'Unknown class',
            classCode: academicClass?.classCode ?? '',
            total: entry._count._all,
          };
        }),
      },
    };
  }

  async getFeesReport(currentUser: JwtUser, query: ReportQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    await this.validateClassAndSession(schoolId, query.classId, query.sessionId);

    const where: Prisma.FeeAssignmentWhereInput = {
      schoolId,
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(query.classId
        ? {
            feeStructure: {
              classId: query.classId,
            },
          }
        : {}),
    };

    const assignments = await this.prisma.feeAssignment.findMany({
      where,
      include: {
        feeStructure: {
          include: {
            academicClass: {
              select: {
                id: true,
                className: true,
              },
            },
          },
        },
      },
    });

    const summary = assignments.reduce(
      (memo, assignment) => ({
        totalAssigned: memo.totalAssigned + Number(assignment.netAmount),
        totalPaid: memo.totalPaid + Number(assignment.paidAmount),
      }),
      {
        totalAssigned: 0,
        totalPaid: 0,
      },
    );

    const classMap = new Map<string, { className: string; totalAssigned: number; totalPaid: number }>();
    for (const assignment of assignments) {
      const classId = assignment.feeStructure.classId ?? 'unassigned';
      const current = classMap.get(classId) ?? {
        className: assignment.feeStructure.academicClass?.className ?? 'General',
        totalAssigned: 0,
        totalPaid: 0,
      };
      current.totalAssigned += Number(assignment.netAmount);
      current.totalPaid += Number(assignment.paidAmount);
      classMap.set(classId, current);
    }

    return {
      success: true,
      message: 'Fees report fetched successfully.',
      data: {
        summary: {
          totalAssigned: Number(summary.totalAssigned.toFixed(2)),
          totalPaid: Number(summary.totalPaid.toFixed(2)),
          totalDue: Number(Math.max(summary.totalAssigned - summary.totalPaid, 0).toFixed(2)),
        },
        classes: [...classMap.entries()].map(([classId, value]) => ({
          classId,
          className: value.className,
          totalAssigned: Number(value.totalAssigned.toFixed(2)),
          totalPaid: Number(value.totalPaid.toFixed(2)),
          totalDue: Number(Math.max(value.totalAssigned - value.totalPaid, 0).toFixed(2)),
        })),
      },
    };
  }

  async getResultsReport(currentUser: JwtUser, query: ReportQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    await this.validateClassAndSession(schoolId, query.classId, query.sessionId);

    const exams = await this.prisma.exam.findMany({
      where: {
        schoolId,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
      },
      include: {
        examSubjects: {
          include: {
            marks: {
              select: {
                obtainedMarks: true,
              },
            },
          },
        },
        academicClass: {
          select: {
            id: true,
            className: true,
          },
        },
      },
      orderBy: [{ startDate: 'desc' }],
    });

    const examSummaries = exams.map((exam) => {
      const totalMarks = exam.examSubjects.reduce(
        (sum, subject) => sum + Number(subject.maxMarks),
        0,
      );
      const obtainedMarks = exam.examSubjects.reduce(
        (sum, subject) =>
          sum +
          subject.marks.reduce(
            (markSum, mark) => markSum + Number(mark.obtainedMarks ?? 0),
            0,
          ),
        0,
      );

      return {
        examId: exam.id,
        examName: exam.examName,
        className: exam.academicClass?.className ?? 'All classes',
        averagePercentage:
          totalMarks > 0 ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) : 0,
        marksCount: exam.examSubjects.reduce(
          (sum, subject) => sum + subject.marks.length,
          0,
        ),
      };
    });

    const overallAverage =
      examSummaries.length > 0
        ? Number(
            (
              examSummaries.reduce((sum, item) => sum + item.averagePercentage, 0) /
              examSummaries.length
            ).toFixed(2),
          )
        : 0;

    return {
      success: true,
      message: 'Results report fetched successfully.',
      data: {
        summary: {
          totalExams: exams.length,
          averagePercentage: overallAverage,
        },
        exams: examSummaries,
      },
    };
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
      throw new ForbiddenException('You cannot access another school.');
    }
    return currentUser.schoolId;
  }

  private async validateClassAndSession(schoolId: string, classId?: string, sessionId?: string) {
    const [academicClass, session] = await Promise.all([
      classId
        ? this.prisma.academicClass.findFirst({
            where: { id: classId, schoolId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
      sessionId
        ? this.prisma.academicSession.findFirst({
            where: { id: sessionId, schoolId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (classId && !academicClass) {
      throw new NotFoundException('Class not found.');
    }
    if (sessionId && !session) {
      throw new NotFoundException('Academic session not found.');
    }
  }
}
