import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('reports.read')
  attendance(@CurrentUser() currentUser: JwtUser, @Query() query: ReportQueryDto) {
    return this.reportsService.getAttendanceReport(currentUser, query);
  }

  @Get('fees')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('reports.read')
  fees(@CurrentUser() currentUser: JwtUser, @Query() query: ReportQueryDto) {
    return this.reportsService.getFeesReport(currentUser, query);
  }

  @Get('results')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('reports.read')
  results(@CurrentUser() currentUser: JwtUser, @Query() query: ReportQueryDto) {
    return this.reportsService.getResultsReport(currentUser, query);
  }
}
