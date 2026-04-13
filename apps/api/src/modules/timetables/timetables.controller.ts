import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { TimetableQueryDto } from './dto/timetable-query.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { TimetablesService } from './timetables.service';

@Controller('timetables')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TimetablesController {
  constructor(private readonly timetablesService: TimetablesService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.STAFF)
  @Permissions('academics.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateTimetableEntryDto,
  ) {
    return this.timetablesService.create(currentUser, dto);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.STAFF)
  @Permissions('academics.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimetableEntryDto,
  ) {
    return this.timetablesService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.STAFF)
  @Permissions('academics.manage')
  remove(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.timetablesService.remove(currentUser, id);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER, RoleType.STAFF)
  @Permissions('academics.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: TimetableQueryDto,
  ) {
    return this.timetablesService.findAll(currentUser, query);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER, RoleType.STAFF)
  @Permissions('academics.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.timetablesService.findOptions(currentUser, schoolId ?? null);
  }

  @Get('class/:classId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER, RoleType.STAFF)
  @Permissions('academics.read')
  findByClass(
    @CurrentUser() currentUser: JwtUser,
    @Param('classId') classId: string,
    @Query() query: TimetableQueryDto,
  ) {
    return this.timetablesService.findByClass(currentUser, classId, query);
  }
}
