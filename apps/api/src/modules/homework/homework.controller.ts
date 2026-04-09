import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';
import { HomeworkService } from './homework.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('homework.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateHomeworkDto) {
    return this.homeworkService.create(currentUser, dto);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.SCHOOL_ADMIN,
    RoleType.TEACHER,
    RoleType.STUDENT,
    RoleType.PARENT,
  )
  @Permissions('homework.read')
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: HomeworkQueryDto) {
    return this.homeworkService.findAll(currentUser, query);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('homework.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.homeworkService.findOptions(currentUser, schoolId ?? null);
  }

  @Get('class/:classId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('homework.read')
  findByClass(
    @CurrentUser() currentUser: JwtUser,
    @Param('classId') classId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.homeworkService.findByClass(currentUser, classId, schoolId ?? null);
  }
}
