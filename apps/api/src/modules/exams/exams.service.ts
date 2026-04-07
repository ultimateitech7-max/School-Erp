import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  ExamStatus,
  ExamType,
  Prisma,
  RoleType,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateMarkDto } from './dto/create-mark.dto';
import { ExamQueryDto } from './dto/exam-query.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';

const EXAM_LIST_TTL_SECONDS = 60 * 5;
const EXAM_RESULTS_TTL_SECONDS = 60 * 3;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const examInclude = Prisma.validator<Prisma.ExamInclude>()({
  academicClass: {
    select: {
      id: true,
      className: true,
      classCode: true,
    },
  },
  academicSession: {
    select: {
      id: true,
      sessionName: true,
      isCurrent: true,
      isActive: true,
    },
  },
  examSubjects: {
    include: {
      subject: {
        select: {
          id: true,
          subjectName: true,
          subjectCode: true,
          subjectType: true,
        },
      },
    },
    orderBy: {
      subject: {
        subjectName: 'asc',
      },
    },
  },
});

const reportCardInclude = Prisma.validator<Prisma.ReportCardInclude>()({
  exam: {
    include: examInclude,
  },
  student: {
    select: {
      id: true,
      fullName: true,
      studentCode: true,
      email: true,
    },
  },
});

type ExamWithDetails = Prisma.ExamGetPayload<{
  include: typeof examInclude;
}>;

type ReportCardWithDetails = Prisma.ReportCardGetPayload<{
  include: typeof reportCardInclude;
}>;

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);
    const currentSession = await this.resolveAcademicSession(schoolId);

    const [classes, subjects, students] = await Promise.all([
      this.prisma.academicClass.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          classCode: true,
        },
      }),
      this.prisma.subject.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ subjectName: 'asc' }],
        select: {
          id: true,
          subjectName: true,
          subjectCode: true,
          subjectType: true,
        },
      }),
      this.prisma.student.findMany({
        where: {
          schoolId,
          status: {
            not: StudentStatus.INACTIVE,
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
              admissionStatus: AdmissionStatus.ACTIVE,
              sessionId: currentSession.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              classId: true,
              sectionId: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Exam options fetched successfully.',
      data: {
        currentSessionId: currentSession.id,
        currentSessionName: currentSession.sessionName,
        examTypes: [
          ExamType.UNIT,
          ExamType.MIDTERM,
          ExamType.FINAL,
          ExamType.PRACTICAL,
          ExamType.OTHER,
        ],
        examStatuses: [
          ExamStatus.DRAFT,
          ExamStatus.SCHEDULED,
          ExamStatus.ONGOING,
          ExamStatus.PUBLISHED,
          ExamStatus.CLOSED,
        ],
        classes: classes.map((academicClass) => ({
          id: academicClass.id,
          name: academicClass.className,
          classCode: academicClass.classCode,
        })),
        subjects: subjects.map((subject) => ({
          id: subject.id,
          name: subject.subjectName,
          subjectCode: subject.subjectCode,
          subjectType: subject.subjectType,
        })),
        students: students.map((student) => ({
          id: student.id,
          name: student.fullName,
          studentCode: student.studentCode,
          classId: student.admissions[0]?.classId ?? null,
          sectionId: student.admissions[0]?.sectionId ?? null,
        })),
      },
    };
  }

  async createExam(currentUser: JwtUser, dto: CreateExamDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const session = await this.resolveAcademicSession(schoolId, dto.sessionId);
    const classId = dto.classId
      ? await this.ensureClassInSchool(schoolId, dto.classId)
      : null;
    const examCode =
      dto.examCode?.trim().toUpperCase() ??
      (await this.generateExamCode(schoolId, session.id));

    await this.ensureUniqueExamCode(schoolId, session.id, examCode);
    this.ensureValidDateRange(dto.startDate, dto.endDate);
    await this.ensureSubjectsInSchool(
      schoolId,
      dto.subjects.map((subject) => subject.subjectId),
    );

    const exam = await this.prisma.$transaction(
      async (tx) => {
        const createdExam = await tx.exam.create({
          data: {
            schoolId,
            sessionId: session.id,
            classId,
            examCode,
            examName: dto.examName.trim(),
            examType: dto.examType ?? ExamType.UNIT,
            startDate: this.normalizeDate(dto.startDate),
            endDate: this.normalizeDate(dto.endDate),
            status: dto.status ?? ExamStatus.SCHEDULED,
          },
        });

        await tx.examSubject.createMany({
          data: dto.subjects.map((subject) => ({
            schoolId,
            examId: createdExam.id,
            subjectId: subject.subjectId,
            examDate: subject.examDate
              ? this.normalizeDate(subject.examDate)
              : null,
            maxMarks: new Prisma.Decimal(subject.maxMarks),
            passMarks: new Prisma.Decimal(subject.passMarks),
          })),
        });

        return tx.exam.findUniqueOrThrow({
          where: { id: createdExam.id },
          include: examInclude,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    await this.invalidateExamCaches(schoolId);
    await this.auditService.write({
      action: 'exams.create',
      entity: 'exam',
      entityId: exam.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        examName: exam.examName,
        examCode: exam.examCode,
      },
    });

    return {
      success: true,
      message: 'Exam created successfully.',
      data: this.serializeExam(exam),
    };
  }

  async findExams(currentUser: JwtUser, query: ExamQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildExamListCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      classId: query.classId,
      sessionId: query.sessionId,
      status: query.status,
      examType: query.examType,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      EXAM_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.ExamWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.examType ? { examType: query.examType } : {}),
          ...(query.startDate || query.endDate
            ? {
                startDate: {
                  ...(query.startDate
                    ? { gte: this.normalizeDate(query.startDate) }
                    : {}),
                  ...(query.endDate
                    ? { lte: this.normalizeDate(query.endDate) }
                    : {}),
                },
              }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    examName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    examCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        };

        const [exams, total] = await Promise.all([
          this.prisma.exam.findMany({
            where,
            include: examInclude,
            orderBy: [{ startDate: 'desc' }, { examName: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.exam.count({ where }),
        ]);

        return {
          items: exams.map((exam) => this.serializeExam(exam)),
          meta: {
            page,
            limit,
            total,
          },
        };
      },
    );

    return {
      success: true,
      message: 'Exams fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findExam(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const exam = await this.findExamOrThrow(currentUser, id, schoolIdOverride);

    return {
      success: true,
      message: 'Exam fetched successfully.',
      data: this.serializeExam(exam),
    };
  }

  async updateExam(currentUser: JwtUser, id: string, dto: UpdateExamDto) {
    const existingExam = await this.findExamOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const sessionId = dto.sessionId ?? existingExam.sessionId;
    const classId = dto.classId !== undefined ? dto.classId : existingExam.classId;

    if (dto.sessionId) {
      await this.resolveAcademicSession(existingExam.schoolId, dto.sessionId);
    }

    if (classId) {
      await this.ensureClassInSchool(existingExam.schoolId, classId);
    }

    if (dto.examCode) {
      await this.ensureUniqueExamCode(
        existingExam.schoolId,
        sessionId,
        dto.examCode.trim().toUpperCase(),
        existingExam.id,
      );
    }

    if (dto.startDate || dto.endDate) {
      this.ensureValidDateRange(
        dto.startDate ?? existingExam.startDate.toISOString(),
        dto.endDate ?? existingExam.endDate.toISOString(),
      );
    }

    if (dto.subjects?.length) {
      await this.ensureSubjectsInSchool(
        existingExam.schoolId,
        dto.subjects.map((subject) => subject.subjectId),
      );
    }

    const exam = await this.prisma.$transaction(
      async (tx) => {
        await tx.exam.update({
          where: { id: existingExam.id },
          data: {
            ...(dto.sessionId ? { sessionId: dto.sessionId } : {}),
            ...(dto.classId !== undefined ? { classId: dto.classId ?? null } : {}),
            ...(dto.examCode ? { examCode: dto.examCode.trim().toUpperCase() } : {}),
            ...(dto.examName ? { examName: dto.examName.trim() } : {}),
            ...(dto.examType ? { examType: dto.examType } : {}),
            ...(dto.startDate ? { startDate: this.normalizeDate(dto.startDate) } : {}),
            ...(dto.endDate ? { endDate: this.normalizeDate(dto.endDate) } : {}),
            ...(dto.status ? { status: dto.status } : {}),
          },
        });

        if (dto.subjects) {
          const retainedSubjectIds = dto.subjects.map((subject) => subject.subjectId);

          await tx.examSubject.deleteMany({
            where: {
              schoolId: existingExam.schoolId,
              examId: existingExam.id,
              subjectId: {
                notIn: retainedSubjectIds,
              },
            },
          });

          for (const subject of dto.subjects) {
            await tx.examSubject.upsert({
              where: {
                schoolId_examId_subjectId: {
                  schoolId: existingExam.schoolId,
                  examId: existingExam.id,
                  subjectId: subject.subjectId,
                },
              },
              update: {
                examDate: subject.examDate
                  ? this.normalizeDate(subject.examDate)
                  : null,
                maxMarks: new Prisma.Decimal(subject.maxMarks),
                passMarks: new Prisma.Decimal(subject.passMarks),
              },
              create: {
                schoolId: existingExam.schoolId,
                examId: existingExam.id,
                subjectId: subject.subjectId,
                examDate: subject.examDate
                  ? this.normalizeDate(subject.examDate)
                  : null,
                maxMarks: new Prisma.Decimal(subject.maxMarks),
                passMarks: new Prisma.Decimal(subject.passMarks),
              },
            });
          }
        }

        return tx.exam.findUniqueOrThrow({
          where: { id: existingExam.id },
          include: examInclude,
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    await this.invalidateExamCaches(exam.schoolId);
    await this.auditService.write({
      action: 'exams.update',
      entity: 'exam',
      entityId: exam.id,
      actorUserId: currentUser.id,
      schoolId: exam.schoolId,
      metadata: {
        examName: exam.examName,
      },
    });

    return {
      success: true,
      message: 'Exam updated successfully.',
      data: this.serializeExam(exam),
    };
  }

  async deleteExam(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const exam = await this.findExamOrThrow(currentUser, id, schoolIdOverride);

    await this.prisma.$transaction(
      async (tx) => {
        const examSubjects = await tx.examSubject.findMany({
          where: {
            schoolId: exam.schoolId,
            examId: exam.id,
          },
          select: {
            id: true,
          },
        });

        await tx.mark.deleteMany({
          where: {
            schoolId: exam.schoolId,
            examSubjectId: {
              in: examSubjects.map((item) => item.id),
            },
          },
        });

        await tx.reportCard.deleteMany({
          where: {
            schoolId: exam.schoolId,
            examId: exam.id,
          },
        });

        await tx.examSubject.deleteMany({
          where: {
            schoolId: exam.schoolId,
            examId: exam.id,
          },
        });

        await tx.exam.delete({
          where: { id: exam.id },
        });
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    await this.invalidateExamCaches(exam.schoolId);
    await this.auditService.write({
      action: 'exams.delete',
      entity: 'exam',
      entityId: exam.id,
      actorUserId: currentUser.id,
      schoolId: exam.schoolId,
      metadata: {
        examName: exam.examName,
      },
    });

    return {
      success: true,
      message: 'Exam deleted successfully.',
      data: {
        id: exam.id,
        deleted: true,
      },
    };
  }

  async createMarks(currentUser: JwtUser, examId: string, dto: CreateMarkDto) {
    const exam = await this.findExamOrThrow(currentUser, examId, dto.schoolId ?? null);
    const examSubjectMap = await this.getExamSubjectMap(exam.schoolId, exam.id);
    const studentIds = [...new Set(dto.entries.map((entry) => entry.studentId))];

    await this.ensureStudentsForExam(exam, studentIds);

    const savedCount = await this.prisma.$transaction(
      async (tx) => {
        let created = 0;

        for (const entry of dto.entries) {
          const examSubject = examSubjectMap.get(entry.subjectId);

          if (!examSubject) {
            throw new BadRequestException(
              'One or more subjects are not assigned to this exam.',
            );
          }

          const maxMarksDecimal =
            entry.maxMarks !== undefined
              ? new Prisma.Decimal(entry.maxMarks)
              : examSubject.maxMarks;

          const obtainedMarks =
            entry.isAbsent ?? false
              ? null
              : entry.marksObtained !== undefined
                ? new Prisma.Decimal(entry.marksObtained)
                : null;

          if (obtainedMarks && obtainedMarks.greaterThan(maxMarksDecimal)) {
            throw new BadRequestException(
              'Marks obtained cannot be greater than max marks.',
            );
          }

          await tx.mark.upsert({
            where: {
              schoolId_examSubjectId_studentId: {
                schoolId: exam.schoolId,
                examSubjectId: examSubject.id,
                studentId: entry.studentId,
              },
            },
            update: {
              obtainedMarks,
              grade:
                entry.grade ??
                this.calculateGrade(
                  Number(obtainedMarks?.toString() ?? 0),
                  Number(maxMarksDecimal.toString()),
                ),
              remarks: entry.remarks ?? null,
              isAbsent: entry.isAbsent ?? false,
              enteredByUserId: currentUser.id,
            },
            create: {
              schoolId: exam.schoolId,
              examSubjectId: examSubject.id,
              studentId: entry.studentId,
              obtainedMarks,
              grade:
                entry.grade ??
                this.calculateGrade(
                  Number(obtainedMarks?.toString() ?? 0),
                  Number(maxMarksDecimal.toString()),
                ),
              remarks: entry.remarks ?? null,
              isAbsent: entry.isAbsent ?? false,
              enteredByUserId: currentUser.id,
            },
          });

          created += 1;
        }

        return created;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    await this.computeAndPersistReportCards(exam.schoolId, exam.id);
    await this.invalidateExamCaches(exam.schoolId);
    await this.auditService.write({
      action: 'exams.marks.create',
      entity: 'exam',
      entityId: exam.id,
      actorUserId: currentUser.id,
      schoolId: exam.schoolId,
      metadata: {
        entriesSaved: savedCount,
      },
    });

    return {
      success: true,
      message: 'Marks saved successfully.',
      data: {
        examId: exam.id,
        entriesSaved: savedCount,
      },
    };
  }

  async updateMark(
    currentUser: JwtUser,
    examId: string,
    markId: string,
    dto: UpdateMarkDto,
  ) {
    const exam = await this.findExamOrThrow(currentUser, examId, null);
    const mark = await this.prisma.mark.findFirst({
      where: {
        id: markId,
        schoolId: exam.schoolId,
        examSubject: {
          examId: exam.id,
        },
      },
      include: {
        examSubject: true,
      },
    });

    if (!mark) {
      throw new NotFoundException('Mark not found.');
    }

    const maxMarks = dto.maxMarks ?? Number(mark.examSubject.maxMarks.toString());
    const obtainedMarks =
      dto.isAbsent ?? mark.isAbsent
        ? null
        : dto.marksObtained !== undefined
          ? dto.marksObtained
          : mark.obtainedMarks
            ? Number(mark.obtainedMarks.toString())
            : null;

    if (obtainedMarks !== null && obtainedMarks > maxMarks) {
      throw new BadRequestException(
        'Marks obtained cannot be greater than max marks.',
      );
    }

    const updatedMark = await this.prisma.mark.update({
      where: { id: mark.id },
      data: {
        obtainedMarks:
          obtainedMarks === null ? null : new Prisma.Decimal(obtainedMarks),
        grade:
          dto.grade ?? this.calculateGrade(obtainedMarks ?? 0, maxMarks),
        remarks: dto.remarks ?? mark.remarks,
        isAbsent: dto.isAbsent ?? mark.isAbsent,
        enteredByUserId: currentUser.id,
      },
    });

    if (dto.maxMarks !== undefined) {
      await this.prisma.examSubject.update({
        where: { id: mark.examSubjectId },
        data: {
          maxMarks: new Prisma.Decimal(dto.maxMarks),
        },
      });
    }

    await this.computeAndPersistReportCards(exam.schoolId, exam.id);
    await this.invalidateExamCaches(exam.schoolId);

    return {
      success: true,
      message: 'Mark updated successfully.',
      data: {
        id: updatedMark.id,
      },
    };
  }

  async findExamResults(
    currentUser: JwtUser,
    examId: string,
    schoolIdOverride?: string | null,
  ) {
    const exam = await this.findExamOrThrow(currentUser, examId, schoolIdOverride);
    const cacheKey = this.buildExamResultsCacheKey(exam.schoolId, exam.id);

    const payload = await this.redisService.remember(
      cacheKey,
      EXAM_RESULTS_TTL_SECONDS,
      async () => this.computeExamResultsPayload(exam),
    );

    return {
      success: true,
      message: 'Exam results fetched successfully.',
      data: payload,
    };
  }

  async findStudentResults(
    currentUser: JwtUser,
    studentId: string,
    schoolIdOverride?: string | null,
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, schoolIdOverride);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        studentCode: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        schoolId: student.schoolId,
        studentId: student.id,
      },
      include: reportCardInclude,
      orderBy: [
        {
          exam: {
            startDate: 'desc',
          },
        },
      ],
    });

    return {
      success: true,
      message: 'Student results fetched successfully.',
      data: {
        student: {
          id: student.id,
          name: student.fullName,
          studentCode: student.studentCode,
        },
        results: reportCards.map((reportCard) =>
          this.serializeReportCard(reportCard),
        ),
      },
    };
  }

  private async computeExamResultsPayload(exam: ExamWithDetails) {
    const reportCards = await this.computeAndPersistReportCards(exam.schoolId, exam.id);

    return {
      exam: this.serializeExam(exam),
      results: reportCards.map((reportCard) => this.serializeReportCard(reportCard)),
    };
  }

  private async computeAndPersistReportCards(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({
      where: {
        id: examId,
        schoolId,
      },
      include: {
        academicSession: true,
        examSubjects: {
          include: {
            subject: true,
            marks: {
              include: {
                student: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException('Exam not found.');
    }

    const admissions = await this.prisma.admission.findMany({
      where: {
        schoolId,
        sessionId: exam.sessionId,
        ...(exam.classId ? { classId: exam.classId } : {}),
        admissionStatus: AdmissionStatus.ACTIVE,
      },
      include: {
        student: true,
      },
      orderBy: {
        student: {
          fullName: 'asc',
        },
      },
    });

    await this.prisma.$transaction(
      async (tx) => {
        for (const admission of admissions) {
          const totalMarks = exam.examSubjects.reduce(
            (sum, examSubject) => sum + Number(examSubject.maxMarks.toString()),
            0,
          );
          const obtainedMarks = exam.examSubjects.reduce((sum, examSubject) => {
            const mark = examSubject.marks.find(
              (item) => item.studentId === admission.studentId,
            );

            if (!mark || mark.isAbsent || !mark.obtainedMarks) {
              return sum;
            }

            return sum + Number(mark.obtainedMarks.toString());
          }, 0);
          const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;

          await tx.reportCard.upsert({
            where: {
              schoolId_examId_studentId: {
                schoolId,
                examId: exam.id,
                studentId: admission.studentId,
              },
            },
            update: {
              totalMarks: new Prisma.Decimal(totalMarks),
              obtainedMarks: new Prisma.Decimal(obtainedMarks),
              percentage: new Prisma.Decimal(percentage.toFixed(2)),
              overallGrade: this.calculateGrade(obtainedMarks, totalMarks),
            },
            create: {
              schoolId,
              sessionId: exam.sessionId,
              examId: exam.id,
              studentId: admission.studentId,
              totalMarks: new Prisma.Decimal(totalMarks),
              obtainedMarks: new Prisma.Decimal(obtainedMarks),
              percentage: new Prisma.Decimal(percentage.toFixed(2)),
              overallGrade: this.calculateGrade(obtainedMarks, totalMarks),
              generatedByUserId: null,
            },
          });
        }
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    return this.prisma.reportCard.findMany({
      where: {
        schoolId,
        examId,
      },
      include: reportCardInclude,
      orderBy: [{ percentage: 'desc' }, { student: { fullName: 'asc' } }],
    });
  }

  private async getExamSubjectMap(schoolId: string, examId: string) {
    const examSubjects = await this.prisma.examSubject.findMany({
      where: {
        schoolId,
        examId,
      },
      select: {
        id: true,
        subjectId: true,
        maxMarks: true,
      },
    });

    return new Map(examSubjects.map((item) => [item.subjectId, item]));
  }

  private async ensureStudentsForExam(exam: ExamWithDetails, studentIds: string[]) {
    const students = await this.prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
        schoolId: exam.schoolId,
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      select: {
        id: true,
        admissions: {
          where: {
            schoolId: exam.schoolId,
            sessionId: exam.sessionId,
            admissionStatus: AdmissionStatus.ACTIVE,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            classId: true,
          },
        },
      },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException('One or more students were not found.');
    }

    if (exam.classId) {
      const invalidStudent = students.find(
        (student) => student.admissions[0]?.classId !== exam.classId,
      );

      if (invalidStudent) {
        throw new ForbiddenException(
          'One or more students do not belong to the selected class.',
        );
      }
    }
  }

  private async ensureSubjectsInSchool(schoolId: string, subjectIds: string[]) {
    const count = await this.prisma.subject.count({
      where: {
        schoolId,
        id: {
          in: subjectIds,
        },
        isActive: true,
      },
    });

    if (count !== subjectIds.length) {
      throw new NotFoundException(
        'One or more subjects were not found for this school.',
      );
    }
  }

  private async ensureClassInSchool(schoolId: string, classId: string) {
    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        id: classId,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found.');
    }

    return academicClass.id;
  }

  private async resolveAcademicSession(schoolId: string, sessionId?: string | null) {
    const session = await this.prisma.academicSession.findFirst({
      where: {
        schoolId,
        ...(sessionId ? { id: sessionId } : { isCurrent: true, isActive: true }),
      },
      select: {
        id: true,
        sessionName: true,
        isCurrent: true,
        isActive: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Academic session not found.');
    }

    return session;
  }

  private async generateExamCode(schoolId: string, sessionId: string) {
    const total = await this.prisma.exam.count({
      where: {
        schoolId,
        sessionId,
      },
    });

    return `EXAM-${String(total + 1).padStart(3, '0')}`;
  }

  private async ensureUniqueExamCode(
    schoolId: string,
    sessionId: string,
    examCode: string,
    excludeExamId?: string,
  ) {
    const existingExam = await this.prisma.exam.findUnique({
      where: {
        schoolId_sessionId_examCode: {
          schoolId,
          sessionId,
          examCode,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingExam && existingExam.id !== excludeExamId) {
      throw new ConflictException('Exam code already exists in this session.');
    }
  }

  private async findExamOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, schoolIdOverride);
    const exam = await this.prisma.exam.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: examInclude,
    });

    if (!exam) {
      throw new NotFoundException('Exam not found.');
    }

    return exam;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      if (!schoolId) {
        throw new BadRequestException('schoolId is required for super admin requests.');
      }

      return schoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You can only manage exam data for your own school.');
    }

    return currentUser.schoolId;
  }

  private resolveListSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You can only access exam data for your own school.');
    }

    return currentUser.schoolId;
  }

  private buildExamListCacheKey(
    schoolId: string,
    params: Record<string, string | number | null | undefined>,
  ) {
    return `exams:list:${schoolId}:${JSON.stringify(params)}`;
  }

  private buildExamResultsCacheKey(schoolId: string, examId: string) {
    return `exams:results:${schoolId}:${examId}`;
  }

  private async invalidateExamCaches(schoolId: string) {
    await this.redisService.deleteByPattern(`exams:list:${schoolId}:*`);
    await this.redisService.deleteByPattern(`exams:results:${schoolId}:*`);
  }

  private serializeExam(exam: ExamWithDetails) {
    return {
      id: exam.id,
      schoolId: exam.schoolId,
      sessionId: exam.sessionId,
      examCode: exam.examCode,
      examName: exam.examName,
      examType: exam.examType,
      startDate: exam.startDate.toISOString(),
      endDate: exam.endDate.toISOString(),
      status: exam.status,
      class: exam.academicClass
        ? {
            id: exam.academicClass.id,
            className: exam.academicClass.className,
            classCode: exam.academicClass.classCode,
          }
        : null,
      session: {
        id: exam.academicSession.id,
        name: exam.academicSession.sessionName,
        isCurrent: exam.academicSession.isCurrent,
      },
      subjects: exam.examSubjects.map((examSubject) => ({
        id: examSubject.id,
        subjectId: examSubject.subjectId,
        subjectName: examSubject.subject.subjectName,
        subjectCode: examSubject.subject.subjectCode,
        subjectType: examSubject.subject.subjectType,
        examDate: examSubject.examDate?.toISOString() ?? null,
        maxMarks: Number(examSubject.maxMarks.toString()),
        passMarks: Number(examSubject.passMarks.toString()),
      })),
      createdAt: exam.createdAt.toISOString(),
      updatedAt: exam.updatedAt.toISOString(),
    };
  }

  private serializeReportCard(reportCard: ReportCardWithDetails) {
    return {
      id: reportCard.id,
      examId: reportCard.examId,
      student: {
        id: reportCard.student.id,
        name: reportCard.student.fullName,
        studentCode: reportCard.student.studentCode,
        email: reportCard.student.email,
      },
      totalMarks: Number(reportCard.totalMarks.toString()),
      obtainedMarks: Number(reportCard.obtainedMarks.toString()),
      percentage: Number(reportCard.percentage.toString()),
      overallGrade: reportCard.overallGrade,
      exam: {
        id: reportCard.exam.id,
        examName: reportCard.exam.examName,
        examCode: reportCard.exam.examCode,
        examType: reportCard.exam.examType,
        startDate: reportCard.exam.startDate.toISOString(),
        endDate: reportCard.exam.endDate.toISOString(),
      },
      createdAt: reportCard.createdAt.toISOString(),
      updatedAt: reportCard.updatedAt.toISOString(),
    };
  }

  private calculateGrade(obtainedMarks: number, maxMarks: number) {
    if (maxMarks <= 0) {
      return 'N/A';
    }

    const percentage = (obtainedMarks / maxMarks) * 100;

    if (percentage >= 90) {
      return 'A+';
    }
    if (percentage >= 80) {
      return 'A';
    }
    if (percentage >= 70) {
      return 'B+';
    }
    if (percentage >= 60) {
      return 'B';
    }
    if (percentage >= 50) {
      return 'C';
    }
    if (percentage >= 40) {
      return 'D';
    }

    return 'F';
  }

  private normalizeDate(value: string) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private ensureValidDateRange(startDate: string, endDate: string) {
    const start = this.normalizeDate(startDate);
    const end = this.normalizeDate(endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date.');
    }
  }
}
