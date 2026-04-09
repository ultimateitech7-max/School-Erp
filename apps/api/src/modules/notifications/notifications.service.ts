import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NotificationQueryDto } from './dto/notification-query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const notificationInclude = Prisma.validator<Prisma.NotificationInclude>()({
  recipientUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
});

type NotificationRecord = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtUser, query: NotificationQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const where: Prisma.NotificationWhereInput = {
      schoolId,
      recipientUserId: currentUser.id,
      channel: NotificationChannel.IN_APP,
      ...(query.unreadOnly
        ? {
            OR: [
              { readAt: null },
              {
                status: {
                  not: NotificationStatus.READ,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: notificationInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          schoolId,
          recipientUserId: currentUser.id,
          channel: NotificationChannel.IN_APP,
          OR: [
            { readAt: null },
            {
              status: {
                not: NotificationStatus.READ,
              },
            },
          ],
        },
      }),
    ]);

    return {
      success: true,
      message: 'Notifications fetched successfully.',
      data: items.map((item) => this.serialize(item)),
      meta: {
        page,
        limit,
        total,
        unreadCount,
      },
    };
  }

  async markRead(currentUser: JwtUser, id: string, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        schoolId,
        recipientUserId: currentUser.id,
        channel: NotificationChannel.IN_APP,
      },
      include: notificationInclude,
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.readAt && notification.status === NotificationStatus.READ) {
      return {
        success: true,
        message: 'Notification already marked as read.',
        data: this.serialize(notification),
      };
    }

    const updated = await this.prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
      include: notificationInclude,
    });

    return {
      success: true,
      message: 'Notification marked as read.',
      data: this.serialize(updated),
    };
  }

  async createUserNotification(input: {
    schoolId: string;
    userId: string;
    title: string;
    message: string;
    type: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.notification.create({
      data: {
        schoolId: input.schoolId,
        recipientUserId: input.userId,
        channel: NotificationChannel.IN_APP,
        notificationType: input.type,
        subject: input.title,
        body: input.message,
        payloadJson: input.payload ?? {},
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  async createAudienceNotifications(input: {
    schoolId: string;
    audience: 'ALL' | 'STUDENTS' | 'PARENTS' | 'STAFF';
    title: string;
    message: string;
    type: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const audienceRoles =
      input.audience === 'ALL'
        ? [
            RoleType.SCHOOL_ADMIN,
            RoleType.TEACHER,
            RoleType.STAFF,
            RoleType.PARENT,
            RoleType.STUDENT,
          ]
        : input.audience === 'STUDENTS'
          ? [RoleType.STUDENT]
          : input.audience === 'PARENTS'
            ? [RoleType.PARENT]
            : [RoleType.SCHOOL_ADMIN, RoleType.TEACHER, RoleType.STAFF];

    const recipients = await this.prisma.user.findMany({
      where: {
        schoolId: input.schoolId,
        isActive: true,
        role: {
          roleType: {
            in: audienceRoles,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!recipients.length) {
      return 0;
    }

    await this.prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        schoolId: input.schoolId,
        recipientUserId: recipient.id,
        channel: NotificationChannel.IN_APP,
        notificationType: input.type,
        subject: input.title,
        body: input.message,
        payloadJson: input.payload ?? {},
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      })),
    });

    return recipients.length;
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
      throw new NotFoundException('Notification not found.');
    }

    return currentUser.schoolId;
  }

  private serialize(notification: NotificationRecord) {
    return {
      id: notification.id,
      schoolId: notification.schoolId,
      userId: notification.recipientUserId,
      title: notification.subject ?? 'Notification',
      message: notification.body,
      type: notification.notificationType,
      isRead: notification.status === NotificationStatus.READ || Boolean(notification.readAt),
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt?.toISOString() ?? null,
      recipient: notification.recipientUser
        ? {
            id: notification.recipientUser.id,
            name: notification.recipientUser.fullName,
            email: notification.recipientUser.email,
          }
        : null,
    };
  }
}
