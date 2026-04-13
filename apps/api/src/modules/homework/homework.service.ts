import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType, TeacherStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const homeworkInclude = Prisma.validator<Prisma.HomeworkInclude>()({
  academicClass: {
    select: {
      id: true,
      className: true,
      classCode: true,
    },
  },
  section: {
    select: {
      id: true,
      sectionName: true,
    },
  },
  subject: {
    select: {
      id: true,
      subjectName: true,
      subjectCode: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
    },
  },
});

type HomeworkRecord = Prisma.HomeworkGetPayload<{
  include: typeof homeworkInclude;
}>;

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateHomeworkDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const dueDate = new Date(dto.dueDate);
    const refs = await this.validateReferences(schoolId, dto);

    const homework = await this.prisma.homework.create({
      data: {
        schoolId,
        classId: refs.academicClass.id,
        sectionId: refs.section?.id ?? null,
        subjectId: refs.subject.id,
        teacherId: refs.teacher.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        dueDate,
      },
      include: homeworkInclude,
    });

    await this.auditService.write({
      action: 'homework.create',
      entity: 'homework',
      entityId: homework.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        classId: homework.classId,
        sectionId: homework.sectionId,
        subjectId: homework.subjectId,
        teacherId: homework.teacherId,
      },
    });

    await this.notifyHomeworkRecipients(homework);

    return {
      success: true,
      message: 'Homework created successfully.',
      data: this.serialize(homework),
    };
  }

  async findAll(currentUser: JwtUser, query: HomeworkQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const where: Prisma.HomeworkWhereInput = {
      schoolId,
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.homework.findMany({
        where,
        include: homeworkInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.homework.count({ where }),
    ]);

    return {
      success: true,
      message: 'Homework fetched successfully.',
      data: items.map((item) => this.serialize(item)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findByClass(currentUser: JwtUser, classId: string, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);

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

    const items = await this.prisma.homework.findMany({
      where: {
        schoolId,
        classId,
      },
      include: homeworkInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      success: true,
      message: 'Class homework fetched successfully.',
      data: items.map((item) => this.serialize(item)),
    };
  }

  async findPortal(currentUser: JwtUser) {
    const schoolId = this.resolveSchoolScope(currentUser, null);

    if (currentUser.role !== RoleType.STUDENT && currentUser.role !== RoleType.PARENT) {
      throw new ForbiddenException('Portal homework is available only for students and parents.');
    }

    const scopes =
      currentUser.role === RoleType.STUDENT
        ? await this.resolveStudentScopes(currentUser.id, schoolId)
        : await this.resolveParentScopes(currentUser.id, schoolId);

    if (!scopes.length) {
      return {
        success: true,
        message: 'Portal homework fetched successfully.',
        data: [],
      };
    }

    const items = await this.prisma.homework.findMany({
      where: {
        schoolId,
        OR: scopes.map((scope) => ({
          classId: scope.classId,
          OR: scope.sectionId
            ? [{ sectionId: null }, { sectionId: scope.sectionId }]
            : [{ sectionId: null }],
        })),
      },
      include: homeworkInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return {
      success: true,
      message: 'Portal homework fetched successfully.',
      data: items.map((item) => this.serialize(item)),
    };
  }

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);
    const [classes, subjects, teachers] = await Promise.all([
      this.prisma.academicClass.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          sections: {
            where: { isActive: true },
            orderBy: { sectionName: 'asc' },
            select: { id: true, sectionName: true },
          },
        },
      }),
      this.prisma.subject.findMany({
        where: { schoolId, isActive: true },
        orderBy: { subjectName: 'asc' },
        select: { id: true, subjectName: true, subjectCode: true },
      }),
      this.prisma.teacher.findMany({
        where: { schoolId, status: TeacherStatus.ACTIVE },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, employeeCode: true },
      }),
    ]);

    return {
      success: true,
      message: 'Homework options fetched successfully.',
      data: {
        classes: classes.map((item) => ({
          id: item.id,
          name: item.className,
          sections: item.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
        subjects: subjects.map((item) => ({
          id: item.id,
          name: item.subjectName,
          code: item.subjectCode,
        })),
        teachers: teachers.map((item) => ({
          id: item.id,
          name: item.fullName,
          employeeCode: item.employeeCode,
        })),
      },
    };
  }

  async findForStudentScope(schoolId: string, classId: string, sectionId?: string | null) {
    const items = await this.prisma.homework.findMany({
      where: {
        schoolId,
        classId,
        OR: [{ sectionId: null }, { sectionId: sectionId ?? undefined }],
      },
      include: homeworkInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return items.map((item) => this.serialize(item));
  }

  private async validateReferences(schoolId: string, dto: CreateHomeworkDto) {
    const [academicClass, section, subject, teacher] = await Promise.all([
      this.prisma.academicClass.findFirst({
        where: { id: dto.classId, schoolId, isActive: true },
        select: { id: true },
      }),
      dto.sectionId
        ? this.prisma.section.findFirst({
            where: { id: dto.sectionId, schoolId, isActive: true },
            select: { id: true, classId: true },
          })
        : Promise.resolve(null),
      this.prisma.subject.findFirst({
        where: { id: dto.subjectId, schoolId, isActive: true },
        select: { id: true },
      }),
      this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, schoolId, status: TeacherStatus.ACTIVE },
        select: { id: true },
      }),
    ]);

    if (!academicClass) {
      throw new NotFoundException('Class not found.');
    }

    if (dto.sectionId && !section) {
      throw new NotFoundException('Section not found.');
    }

    if (section && section.classId !== academicClass.id) {
      throw new BadRequestException('Section does not belong to the selected class.');
    }

    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    if (!teacher) {
      throw new NotFoundException('Teacher not found.');
    }

    return {
      academicClass,
      section,
      subject,
      teacher,
    };
  }

  private async notifyHomeworkRecipients(homework: HomeworkRecord) {
    const admissions = await this.prisma.admission.findMany({
      where: {
        schoolId: homework.schoolId,
        classId: homework.classId,
        ...(homework.sectionId ? { sectionId: homework.sectionId } : {}),
        admissionStatus: 'ACTIVE',
      },
      select: {
        student: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            parentLinks: {
              select: {
                parent: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const notifiedUsers = new Set<string>();

    for (const admission of admissions) {
      if (admission.student.userId) {
        notifiedUsers.add(admission.student.userId);
      }

      for (const parentLink of admission.student.parentLinks) {
        if (parentLink.parent.userId) {
          notifiedUsers.add(parentLink.parent.userId);
        }
      }
    }

    await Promise.all(
      [...notifiedUsers].map((userId) =>
        this.notificationsService.createUserNotification({
          schoolId: homework.schoolId,
          userId,
          title: `Homework: ${homework.title}`,
          message: `${homework.subject.subjectName} homework is due on ${homework.dueDate.toISOString().slice(0, 10)}.`,
          type: 'HOMEWORK',
          payload: {
            homeworkId: homework.id,
            classId: homework.classId,
            sectionId: homework.sectionId,
          },
        }),
      ),
    );
  }

  private async resolveStudentScopes(userId: string, schoolId: string) {
    const admissions = await this.prisma.admission.findMany({
      where: {
        schoolId,
        admissionStatus: {
          in: ['ACTIVE', 'PROMOTED'],
        },
        student: {
          userId,
        },
      },
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        classId: true,
        sectionId: true,
      },
    });

    return this.serializeScopes(admissions);
  }

  private async resolveParentScopes(userId: string, schoolId: string) {
    const admissions = await this.prisma.admission.findMany({
      where: {
        schoolId,
        admissionStatus: {
          in: ['ACTIVE', 'PROMOTED'],
        },
        student: {
          parentLinks: {
            some: {
              parent: {
                userId,
              },
            },
          },
        },
      },
      orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        classId: true,
        sectionId: true,
      },
    });

    return this.serializeScopes(admissions);
  }

  private serializeScopes(items: Array<{ classId: string; sectionId: string | null }>) {
    const deduped = new Map<string, { classId: string; sectionId: string | null }>();

    for (const item of items) {
      deduped.set(`${item.classId}:${item.sectionId ?? 'all'}`, item);
    }

    return [...deduped.values()];
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
      throw new NotFoundException('Homework not found.');
    }

    return currentUser.schoolId;
  }

  private serialize(record: HomeworkRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      title: record.title,
      description: record.description,
      dueDate: record.dueDate.toISOString(),
      class: {
        id: record.academicClass.id,
        name: record.academicClass.className,
        classCode: record.academicClass.classCode,
      },
      section: record.section
        ? {
            id: record.section.id,
            name: record.section.sectionName,
          }
        : null,
      subject: {
        id: record.subject.id,
        name: record.subject.subjectName,
        code: record.subject.subjectCode,
      },
      teacher: {
        id: record.teacher.id,
        name: record.teacher.fullName,
        employeeCode: record.teacher.employeeCode,
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
