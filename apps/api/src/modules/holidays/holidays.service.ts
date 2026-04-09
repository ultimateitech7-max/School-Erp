import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HolidayType, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';

type HolidayRecord = Prisma.HolidayGetPayload<Record<string, never>>;

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateHolidayDto) {
    const schoolId = this.resolveSchoolScope(currentUser, dto.schoolId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate.');
    }

    const holiday = await this.prisma.holiday.create({
      data: {
        schoolId,
        title: dto.title.trim(),
        startDate,
        endDate,
        type: dto.type,
      },
    });

    await this.auditService.write({
      action: 'holidays.create',
      entity: 'holiday',
      entityId: holiday.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        title: holiday.title,
        type: holiday.type,
      },
    });

    return {
      success: true,
      message: 'Holiday created successfully.',
      data: this.serialize(holiday),
    };
  }

  async findAll(currentUser: JwtUser, query: HolidayQueryDto) {
    const schoolId = this.resolveSchoolScope(currentUser, query.schoolId);
    const holidays = await this.prisma.holiday.findMany({
      where: {
        schoolId,
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      success: true,
      message: 'Holidays fetched successfully.',
      data: holidays.map((holiday) => this.serialize(holiday)),
    };
  }

  async getUpcomingForSchool(schoolId: string, type?: HolidayType) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const holidays = await this.prisma.holiday.findMany({
      where: {
        schoolId,
        ...(type ? { type } : {}),
        endDate: {
          gte: today,
        },
      },
      orderBy: [{ startDate: 'asc' }],
      take: 10,
    });

    return holidays.map((holiday) => this.serialize(holiday));
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
      throw new NotFoundException('Holiday not found.');
    }

    return currentUser.schoolId;
  }

  private serialize(record: HolidayRecord) {
    return {
      id: record.id,
      schoolId: record.schoolId,
      title: record.title,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      type: record.type,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
