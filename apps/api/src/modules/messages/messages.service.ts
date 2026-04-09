import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto } from './dto/create-message.dto';

const messageInclude = Prisma.validator<Prisma.MessageInclude>()({
  senderUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: {
        select: {
          roleCode: true,
          roleType: true,
        },
      },
    },
  },
  recipientUser: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: {
        select: {
          roleCode: true,
          roleType: true,
        },
      },
    },
  },
});

type MessageRecord = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateMessageDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);

    if (dto.receiverId === currentUser.id) {
      throw new BadRequestException('You cannot send a message to yourself.');
    }

    const recipient = await this.prisma.user.findFirst({
      where: {
        id: dto.receiverId,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        role: {
          select: {
            roleType: true,
            roleCode: true,
          },
        },
      },
    });

    if (!recipient) {
      throw new NotFoundException('Receiver not found for this school.');
    }

    this.validateMessagingPermission(currentUser.role, recipient.role.roleType);

    const message = await this.prisma.message.create({
      data: {
        schoolId,
        senderUserId: currentUser.id,
        recipientUserId: dto.receiverId,
        subject: dto.subject?.trim() || null,
        body: dto.message.trim(),
      },
      include: messageInclude,
    });

    await this.auditService.write({
      action: 'messages.create',
      entity: 'message',
      entityId: message.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        recipientUserId: message.recipientUserId,
      },
    });

    await this.notificationsService.createUserNotification({
      schoolId,
      userId: dto.receiverId,
      title: dto.subject?.trim() || `New message from ${currentUser.name}`,
      message: dto.message.trim(),
      type: 'MESSAGE',
      payload: {
        messageId: message.id,
        senderId: currentUser.id,
      },
    });

    return {
      success: true,
      message: 'Message sent successfully.',
      data: this.serializeMessage(message),
    };
  }

  async findInbox(currentUser: JwtUser) {
    const schoolId = this.resolveUserSchoolScope(currentUser);
    const messages = await this.prisma.message.findMany({
      where: {
        schoolId,
        recipientUserId: currentUser.id,
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      success: true,
      message: 'Inbox fetched successfully.',
      data: messages.map((item) => this.serializeMessage(item)),
    };
  }

  async findSent(currentUser: JwtUser) {
    const schoolId = this.resolveUserSchoolScope(currentUser);
    const messages = await this.prisma.message.findMany({
      where: {
        schoolId,
        senderUserId: currentUser.id,
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      success: true,
      message: 'Sent messages fetched successfully.',
      data: messages.map((item) => this.serializeMessage(item)),
    };
  }

  async markRead(currentUser: JwtUser, id: string) {
    const schoolId = this.resolveUserSchoolScope(currentUser);
    const message = await this.prisma.message.findFirst({
      where: {
        id,
        schoolId,
        recipientUserId: currentUser.id,
      },
      include: messageInclude,
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    if (message.isRead) {
      return {
        success: true,
        message: 'Message already marked as read.',
        data: this.serializeMessage(message),
      };
    }

    const updated = await this.prisma.message.update({
      where: {
        id: message.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: messageInclude,
    });

    return {
      success: true,
      message: 'Message marked as read.',
      data: this.serializeMessage(updated),
    };
  }

  async findRecipients(
    currentUser: JwtUser,
    schoolIdOverride?: string | null,
    roleFilter?: string | null,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);
    const allowedRoles = this.getAllowedRecipientRoles(currentUser.role);
    const normalizedRoleFilter = roleFilter?.trim().toUpperCase() ?? null;
    const requestedRole =
      normalizedRoleFilter &&
      Object.values(RoleType).includes(normalizedRoleFilter as RoleType)
        ? (normalizedRoleFilter as RoleType)
        : null;

    if (requestedRole && !allowedRoles.includes(requestedRole)) {
      throw new ForbiddenException('You cannot message the selected role.');
    }

    const users = await this.prisma.user.findMany({
      where: {
        schoolId,
        isActive: true,
        id: {
          not: currentUser.id,
        },
        role: {
          roleType: {
            in: requestedRole ? [requestedRole] : allowedRoles,
          },
        },
      },
      orderBy: [{ fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        email: true,
        userType: true,
        role: {
          select: {
            roleCode: true,
            roleType: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Recipients fetched successfully.',
      data: users.map((user) => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role.roleCode,
        roleType: user.role.roleType,
        userType: user.userType,
      })),
    };
  }

  private validateMessagingPermission(senderRole: RoleType, receiverRole: RoleType) {
    const allowedRoles = this.getAllowedRecipientRoles(senderRole);

    if (!allowedRoles.includes(receiverRole)) {
      throw new ForbiddenException('You cannot message this user role.');
    }
  }

  private getAllowedRecipientRoles(senderRole: RoleType): RoleType[] {
    switch (senderRole) {
      case RoleType.SUPER_ADMIN:
      case RoleType.SCHOOL_ADMIN:
      case RoleType.STAFF:
        return [
          RoleType.SCHOOL_ADMIN,
          RoleType.TEACHER,
          RoleType.STAFF,
          RoleType.PARENT,
          RoleType.STUDENT,
        ];
      case RoleType.TEACHER:
        return [RoleType.PARENT, RoleType.STUDENT];
      case RoleType.PARENT:
        return [RoleType.TEACHER];
      default:
        return [];
    }
  }

  private resolveUserSchoolScope(currentUser: JwtUser) {
    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
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

    return this.resolveUserSchoolScope(currentUser);
  }

  private serializeMessage(record: MessageRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      subject: record.subject,
      message: record.body,
      isRead: record.isRead,
      readAt: record.readAt?.toISOString() ?? null,
      sender: {
        id: record.senderUser.id,
        name: record.senderUser.fullName,
        email: record.senderUser.email,
        role: record.senderUser.role.roleCode,
        roleType: record.senderUser.role.roleType,
      },
      receiver: {
        id: record.recipientUser.id,
        name: record.recipientUser.fullName,
        email: record.recipientUser.email,
        role: record.recipientUser.role.roleCode,
        roleType: record.recipientUser.role.roleType,
      },
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
