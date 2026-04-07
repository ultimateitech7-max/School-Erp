import {
  Body,
  Controller,
  Delete,
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
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('options')
  @Permissions('attendance.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.attendanceService.findOptions(currentUser, schoolId ?? null);
  }

  @Post()
  @Permissions('attendance.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendanceService.create(currentUser, dto);
  }

  @Post('bulk')
  @Permissions('attendance.manage')
  createBulk(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.attendanceService.createBulk(currentUser, dto);
  }

  @Get('summary')
  @Permissions('attendance.read')
  findSummary(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findSummary(currentUser, query);
  }

  @Get('student/:studentId')
  @Permissions('attendance.read')
  findByStudent(
    @CurrentUser() currentUser: JwtUser,
    @Param('studentId') studentId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findByStudent(currentUser, studentId, query);
  }

  @Get('class/:classId')
  @Permissions('attendance.read')
  findByClass(
    @CurrentUser() currentUser: JwtUser,
    @Param('classId') classId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findByClass(currentUser, classId, query);
  }

  @Get()
  @Permissions('attendance.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findAll(currentUser, query);
  }

  @Patch(':id')
  @Permissions('attendance.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Permissions('attendance.manage')
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.attendanceService.remove(currentUser, id, schoolId ?? null);
  }
}
