import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { StudentsService } from './students.service';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.STUDENT)
export class StudentPortalController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() currentUser: JwtUser) {
    return this.studentsService.getPortalDashboard(currentUser);
  }

  @Get('attendance')
  getAttendance(
    @CurrentUser() currentUser: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.studentsService.getPortalAttendance(currentUser, sessionId ?? null);
  }

  @Get('fees')
  getFees(
    @CurrentUser() currentUser: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.studentsService.getPortalFees(currentUser, sessionId ?? null);
  }

  @Get('results')
  getResults(
    @CurrentUser() currentUser: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.studentsService.getPortalResults(currentUser, sessionId ?? null);
  }

  @Get('homework')
  getHomework(@CurrentUser() currentUser: JwtUser) {
    return this.studentsService.getPortalHomework(currentUser);
  }

  @Get('holidays')
  getHolidays(@CurrentUser() currentUser: JwtUser) {
    return this.studentsService.getPortalHolidays(currentUser);
  }
}
