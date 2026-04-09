import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayQueryDto } from './dto/holiday-query.dto';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('calendar.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(currentUser, dto);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.SCHOOL_ADMIN,
    RoleType.TEACHER,
    RoleType.STAFF,
    RoleType.PARENT,
    RoleType.STUDENT,
  )
  @Permissions('calendar.read')
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: HolidayQueryDto) {
    return this.holidaysService.findAll(currentUser, query);
  }
}
