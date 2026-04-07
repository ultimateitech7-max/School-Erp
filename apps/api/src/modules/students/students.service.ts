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
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const STUDENT_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const studentDetailsInclude = Prisma.validator<Prisma.StudentInclude>()({
  admissions: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
    include: {
      academicClass: {
        select: {
          id: true,
          className: true,
        },
      },
      section: {
        select: {
          id: true,
          sectionName: true,
        },
      },
    },
  },
});

type StudentWithDetails = Prisma.StudentGetPayload<{
  include: typeof studentDetailsInclude;
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateStudentDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const normalizedName = dto.name.trim();
    const { firstName, lastName } = this.splitName(normalizedName);
    const studentCode =
      dto.studentCode?.trim().toUpperCase() ??
      (await this.generateStudentCode(schoolId));

    await this.ensureUniqueStudentCode(schoolId, studentCode);

    const student = await this.prisma.$transaction(async (tx) => {
      const createdStudent = await tx.student.create({
        data: {
          schoolId,
          studentCode,
          firstName,
          lastName,
          fullName: normalizedName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          gender: dto.gender ?? 'OTHER',
          dateOfBirth: new Date(dto.dateOfBirth ?? '2000-01-01'),
          joinedOn: dto.joinedOn ? new Date(dto.joinedOn) : null,
          status: StudentStatus.ACTIVE,
        },
      });

      await this.upsertAdmission(tx, schoolId, createdStudent.id, dto);

      return tx.student.findUniqueOrThrow({
        where: { id: createdStudent.id },
        include: studentDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateStudentCache(schoolId);
    await this.auditService.write({
      action: 'students.create',
      entity: 'student',
      entityId: student.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        name: student.fullName,
        admissionNo: student.admissions[0]?.admissionNo ?? null,
      },
    });

    return {
      success: true,
      message: 'Student created successfully.',
      data: this.serializeStudent(student),
    };
  }

  async findAll(currentUser: JwtUser, query: StudentQueryDto) {
    const schoolId = this.resolveListScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheScope = schoolId ?? 'all';
    const cacheKey = this.buildStudentsCacheKey(cacheScope, {
      page,
      limit,
      search,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      STUDENT_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.StudentWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          status: {
            not: StudentStatus.INACTIVE,
          },
          ...(search
            ? {
                OR: [
                  {
                    firstName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    lastName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    fullName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    admissions: {
                      some: {
                        admissionNo: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        const [students, total] = await Promise.all([
          this.prisma.student.findMany({
            where,
            include: studentDetailsInclude,
            orderBy: {
              createdAt: 'desc',
            },
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.student.count({ where }),
        ]);

        return {
          items: students.map((student) => this.serializeStudent(student)),
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
      message: 'Students fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findOne(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const student = await this.findStudentOrThrow(
      currentUser,
      id,
      overrideSchoolId ?? null,
    );

    return {
      success: true,
      message: 'Student fetched successfully.',
      data: this.serializeStudent(student),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateStudentDto) {
    const existingStudent = await this.findStudentOrThrow(
      currentUser,
      id,
      dto.schoolId ?? null,
    );
    const schoolId = existingStudent.schoolId;

    if (dto.studentCode) {
      await this.ensureUniqueStudentCode(
        schoolId,
        dto.studentCode.trim().toUpperCase(),
        id,
      );
    }

    const updatedStudent = await this.prisma.$transaction(async (tx) => {
      const updatedName = dto.name?.trim();
      const nameParts = updatedName ? this.splitName(updatedName) : null;

      await tx.student.update({
        where: { id },
        data: {
          ...(dto.studentCode
            ? { studentCode: dto.studentCode.trim().toUpperCase() }
            : {}),
          ...(updatedName && nameParts
            ? {
                firstName: nameParts.firstName,
                lastName: nameParts.lastName,
                fullName: updatedName,
              }
            : {}),
          ...(dto.email !== undefined ? { email: dto.email ?? null } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone ?? null } : {}),
          ...(dto.gender ? { gender: dto.gender } : {}),
          ...(dto.dateOfBirth
            ? { dateOfBirth: new Date(dto.dateOfBirth) }
            : {}),
          ...(dto.joinedOn !== undefined
            ? { joinedOn: dto.joinedOn ? new Date(dto.joinedOn) : null }
            : {}),
        },
      });

      if (this.hasAdmissionPayload(dto)) {
        await this.upsertAdmission(tx, schoolId, id, dto);
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        include: studentDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateStudentCache(schoolId);
    await this.auditService.write({
      action: 'students.update',
      entity: 'student',
      entityId: updatedStudent.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        name: updatedStudent.fullName,
        admissionNo: updatedStudent.admissions[0]?.admissionNo ?? null,
      },
    });

    return {
      success: true,
      message: 'Student updated successfully.',
      data: this.serializeStudent(updatedStudent),
    };
  }

  async remove(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const student = await this.findStudentOrThrow(
      currentUser,
      id,
      schoolIdOverride ?? null,
    );

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        status: StudentStatus.INACTIVE,
      },
    });

    await this.invalidateStudentCache(student.schoolId);
    await this.auditService.write({
      action: 'students.delete',
      entity: 'student',
      entityId: student.id,
      actorUserId: currentUser.id,
      schoolId: student.schoolId,
      metadata: {
        name: student.fullName,
      },
    });

    return {
      success: true,
      message: 'Student deleted successfully.',
      data: {
        id: student.id,
        deleted: true,
      },
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride ?? null);

    const [currentSession, classes] = await Promise.all([
      this.prisma.academicSession.findFirst({
        where: {
          schoolId,
          isCurrent: true,
          isActive: true,
        },
        select: {
          id: true,
          sessionName: true,
        },
      }),
      this.prisma.academicClass.findMany({
        where: {
          schoolId,
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          sections: {
            where: {
              isActive: true,
            },
            orderBy: {
              sectionName: 'asc',
            },
            select: {
              id: true,
              sectionName: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Student options fetched successfully.',
      data: {
        currentSessionId: currentSession?.id ?? null,
        currentSessionName: currentSession?.sessionName ?? null,
        classes: classes.map((academicClass) => ({
          id: academicClass.id,
          name: academicClass.className,
          sections: academicClass.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
      },
    };
  }

  private resolveSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = overrideSchoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new ForbiddenException(
          'SUPER_ADMIN must provide a school scope for this action.',
        );
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private resolveListScope(currentUser: JwtUser, overrideSchoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return overrideSchoolId ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private async findStudentOrThrow(
    currentUser: JwtUser,
    id: string,
    overrideSchoolId?: string | null,
  ) {
    const schoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? overrideSchoolId ?? currentUser.schoolId ?? null
        : this.resolveSchoolScope(currentUser, overrideSchoolId);

    const student = await this.prisma.student.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
        status: {
          not: StudentStatus.INACTIVE,
        },
      },
      include: studentDetailsInclude,
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    return student;
  }

  private async upsertAdmission(
    tx: Prisma.TransactionClient,
    schoolId: string,
    studentId: string,
    dto: Pick<
      CreateStudentDto,
      'admissionNo' | 'classId' | 'sectionId' | 'sessionId'
    >,
  ) {
    if (!this.hasAdmissionPayload(dto)) {
      return;
    }

    if (!dto.classId) {
      throw new BadRequestException(
        'classId is required when admission details are provided.',
      );
    }

    const [academicClass, section] = await Promise.all([
      tx.academicClass.findFirst({
        where: {
          id: dto.classId,
          schoolId,
          isActive: true,
        },
      }),
      dto.sectionId
        ? tx.section.findFirst({
            where: {
              id: dto.sectionId,
              schoolId,
              isActive: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found for this school.');
    }

    if (section && section.classId !== dto.classId) {
      throw new BadRequestException('Selected section does not belong to class.');
    }

    const sessionId = await this.resolveAdmissionSessionId(
      tx,
      schoolId,
      dto.sessionId,
    );

    const existingAdmission = await tx.admission.findFirst({
      where: {
        schoolId,
        studentId,
        sessionId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const admissionNo =
      dto.admissionNo?.trim().toUpperCase() ??
      existingAdmission?.admissionNo ??
      (await this.generateAdmissionNo(tx, schoolId));

    await this.ensureUniqueAdmissionNo(
      tx,
      schoolId,
      admissionNo,
      existingAdmission?.id,
    );

    const admissionData = {
      schoolId,
      studentId,
      sessionId,
      classId: academicClass.id,
      sectionId: section?.id ?? null,
      admissionNo,
      admissionDate: new Date(),
      admissionStatus: AdmissionStatus.ACTIVE,
    };

    if (existingAdmission) {
      await tx.admission.update({
        where: {
          id: existingAdmission.id,
        },
        data: admissionData,
      });

      return;
    }

    await tx.admission.create({
      data: admissionData,
    });
  }

  private async resolveAdmissionSessionId(
    tx: Prisma.TransactionClient,
    schoolId: string,
    sessionId?: string | null,
  ) {
    if (sessionId) {
      const session = await tx.academicSession.findFirst({
        where: {
          id: sessionId,
          schoolId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new NotFoundException('Session not found for this school.');
      }

      return session.id;
    }

    const currentSession = await tx.academicSession.findFirst({
      where: {
        schoolId,
        isCurrent: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!currentSession) {
      throw new BadRequestException(
        'No active current session found for this school.',
      );
    }

    return currentSession.id;
  }

  private hasAdmissionPayload(
    dto: Pick<CreateStudentDto, 'admissionNo' | 'classId' | 'sectionId' | 'sessionId'>,
  ) {
    return Boolean(dto.admissionNo || dto.classId || dto.sectionId || dto.sessionId);
  }

  private splitName(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        firstName: name,
        lastName: name,
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: parts[0],
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private async ensureUniqueStudentCode(
    schoolId: string,
    studentCode: string,
    excludeStudentId?: string,
  ) {
    const existingStudent = await this.prisma.student.findUnique({
      where: {
        schoolId_studentCode: {
          schoolId,
          studentCode,
        },
      },
    });

    if (existingStudent && existingStudent.id !== excludeStudentId) {
      throw new ConflictException('Student code is already in use.');
    }
  }

  private async ensureUniqueAdmissionNo(
    tx: Prisma.TransactionClient,
    schoolId: string,
    admissionNo: string,
    excludeAdmissionId?: string,
  ) {
    const existingAdmission = await tx.admission.findUnique({
      where: {
        schoolId_admissionNo: {
          schoolId,
          admissionNo,
        },
      },
    });

    if (existingAdmission && existingAdmission.id !== excludeAdmissionId) {
      throw new ConflictException('Admission number is already in use.');
    }
  }

  private async generateStudentCode(schoolId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `STU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const existingStudent = await this.prisma.student.findUnique({
        where: {
          schoolId_studentCode: {
            schoolId,
            studentCode: candidate,
          },
        },
      });

      if (!existingStudent) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique student code.');
  }

  private async generateAdmissionNo(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `ADM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const existingAdmission = await tx.admission.findUnique({
        where: {
          schoolId_admissionNo: {
            schoolId,
            admissionNo: candidate,
          },
        },
      });

      if (!existingAdmission) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique admission number.');
  }

  private buildStudentsCacheKey(
    schoolScope: string,
    query: { page: number; limit: number; search: string },
  ) {
    return this.redisService.buildStudentListKey(
      schoolScope,
      JSON.stringify(query),
    );
  }

  private async invalidateStudentCache(schoolId: string) {
    await Promise.all([
      this.redisService.deleteByPattern(
        this.redisService.buildStudentListKey(schoolId, '*'),
      ),
      this.redisService.deleteByPattern(
        this.redisService.buildStudentListKey('all', '*'),
      ),
    ]);
  }

  private serializeStudent(student: StudentWithDetails) {
    const latestAdmission = student.admissions[0] ?? null;

    return {
      id: student.id,
      name: student.fullName,
      admissionNo: latestAdmission?.admissionNo ?? null,
      studentCode: student.studentCode,
      email: student.email,
      phone: student.phone,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      joinedOn: student.joinedOn,
      sessionId: latestAdmission?.sessionId ?? null,
      class: latestAdmission?.academicClass
        ? {
            id: latestAdmission.academicClass.id,
            name: latestAdmission.academicClass.className,
          }
        : null,
      section: latestAdmission?.section
        ? {
            id: latestAdmission.section.id,
            name: latestAdmission.section.sectionName,
          }
        : null,
      schoolId: student.schoolId,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      status: student.status,
    };
  }
}
