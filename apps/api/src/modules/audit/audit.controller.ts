import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  findLogs(@CurrentUser() currentUser: JwtUser, @Query() query: AuditLogQueryDto) {
    return this.auditService.findLogs(currentUser, query);
  }

  @Get('options')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.auditService.findOptions(currentUser, schoolId ?? null);
  }
}
