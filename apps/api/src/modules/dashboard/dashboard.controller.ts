import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('bootstrap')
  findBootstrap(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.findBootstrap(currentUser, query);
  }

  @Get('overview')
  findOverview(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.findOverview(currentUser, query);
  }

  @Get('attendance')
  findAttendance(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.findAttendance(currentUser, query);
  }

  @Get('fees')
  findFees(@CurrentUser() currentUser: JwtUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.findFees(currentUser, query);
  }

  @Get('classes')
  findClasses(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.findClasses(currentUser, query);
  }

  @Get('exams')
  findExams(@CurrentUser() currentUser: JwtUser, @Query() query: DashboardQueryDto) {
    return this.dashboardService.findExams(currentUser, query);
  }
}
