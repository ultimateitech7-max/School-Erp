import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NoticeAudienceType, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { NoticeQueryDto } from './dto/notice-query.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const noticeInclude = Prisma.validator<Prisma.NoticeInclude>()({
  school: {
    select: {
      id: true,
      name: true,
      schoolCode: true,
    },
  },
});

type NoticeRecord = Prisma.NoticeGetPayload<{
  include: typeof noticeInclude;
}>;

@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateNoticeDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const expiryDate = dto.expiryDate ? this.normalizeDate(dto.expiryDate) : null;

    const notice = await this.prisma.notice.create({
      data: {
        schoolId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        audienceType: dto.audienceType,
        isPublished: dto.isPublished ?? false,
        expiryDate,
      },
      include: noticeInclude,
    });

    await this.auditService.write({
      action: 'notices.create',
      entity: 'notice',
      entityId: notice.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        title: notice.title,
        audienceType: notice.audienceType,
        isPublished: notice.isPublished,
      },
    });

    if (notice.isPublished) {
      await this.notifyPublishedNotice(notice);
    }

    return {
      success: true,
      message: 'Notice created successfully.',
      data: this.serializeNotice(notice),
    };
  }

  async findAll(currentUser: JwtUser, query: NoticeQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const where: Prisma.NoticeWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(query.audienceType ? { audienceType: query.audienceType } : {}),
      ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        include: noticeInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notice.count({ where }),
    ]);

    return {
      success: true,
      message: 'Notices fetched successfully.',
      data: items.map((item) => this.serializeNotice(item)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const notice = await this.findScopedNoticeOrThrow(currentUser, id, schoolIdOverride);

    return {
      success: true,
      message: 'Notice fetched successfully.',
      data: this.serializeNotice(notice),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateNoticeDto) {
    const notice = await this.findScopedNoticeOrThrow(currentUser, id, dto.schoolId ?? null);
    const expiryDate =
      dto.expiryDate !== undefined
        ? dto.expiryDate
          ? this.normalizeDate(dto.expiryDate)
          : null
        : notice.expiryDate;

    const updated = await this.prisma.notice.update({
      where: {
        id: notice.id,
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() }
          : {}),
        ...(dto.audienceType !== undefined
          ? { audienceType: dto.audienceType }
          : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate } : {}),
      },
      include: noticeInclude,
    });

    await this.auditService.write({
      action: 'notices.update',
      entity: 'notice',
      entityId: updated.id,
      actorUserId: currentUser.id,
      schoolId: updated.schoolId,
      metadata: {
        title: updated.title,
        audienceType: updated.audienceType,
        isPublished: updated.isPublished,
      },
    });

    if (!notice.isPublished && updated.isPublished) {
      await this.notifyPublishedNotice(updated);
    }

    return {
      success: true,
      message: 'Notice updated successfully.',
      data: this.serializeNotice(updated),
    };
  }

  async findPortalNotices(currentUser: JwtUser) {
    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    const audienceTypes: NoticeAudienceType[] = [NoticeAudienceType.ALL];

    if (currentUser.role === RoleType.STUDENT) {
      audienceTypes.push(NoticeAudienceType.STUDENTS);
    }

    if (currentUser.role === RoleType.PARENT) {
      audienceTypes.push(NoticeAudienceType.PARENTS);
    }

    if (
      currentUser.role === RoleType.STAFF ||
      currentUser.role === RoleType.TEACHER
    ) {
      audienceTypes.push(NoticeAudienceType.STAFF);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const notices = await this.prisma.notice.findMany({
      where: {
        schoolId: currentUser.schoolId,
        isPublished: true,
        audienceType: {
          in: audienceTypes,
        },
        OR: [
          {
            expiryDate: null,
          },
          {
            expiryDate: {
              gte: today,
            },
          },
        ],
      },
      include: noticeInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
    });

    return {
      success: true,
      message: 'Portal notices fetched successfully.',
      data: notices.map((item) => this.serializeNotice(item)),
    };
  }

  private async findScopedNoticeOrThrow(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const schoolId = this.resolveReadSchoolScope(currentUser, schoolIdOverride);
    const notice = await this.prisma.notice.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: noticeInclude,
    });

    if (!notice) {
      throw new NotFoundException('Notice not found.');
    }

    return notice;
  }

  private resolveReadSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? currentUser.schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Notice not found.');
    }

    return currentUser.schoolId;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const resolvedSchoolId = schoolId ?? currentUser.schoolId ?? null;

      if (!resolvedSchoolId) {
        throw new BadRequestException('schoolId is required for this action.');
      }

      return resolvedSchoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Notice not found.');
    }

    return currentUser.schoolId;
  }

  private normalizeDate(value: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid expiryDate provided.');
    }

    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }

  private async notifyPublishedNotice(record: NoticeRecord) {
    await this.notificationsService.createAudienceNotifications({
      schoolId: record.schoolId,
      audience: record.audienceType,
      title: record.title,
      message: record.description,
      type: 'NOTICE',
      payload: {
        noticeId: record.id,
        audienceType: record.audienceType,
      },
    });
  }

  private serializeNotice(record: NoticeRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      title: record.title,
      description: record.description,
      audienceType: record.audienceType,
      isPublished: record.isPublished,
      expiryDate: record.expiryDate?.toISOString() ?? null,
      school: {
        id: record.school.id,
        name: record.school.name,
        schoolCode: record.school.schoolCode,
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
