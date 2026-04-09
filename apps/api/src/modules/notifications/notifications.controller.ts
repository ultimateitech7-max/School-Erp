import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  RoleType.SUPER_ADMIN,
  RoleType.SCHOOL_ADMIN,
  RoleType.TEACHER,
  RoleType.STAFF,
  RoleType.PARENT,
  RoleType.STUDENT,
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(currentUser, query);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.notificationsService.markRead(currentUser, id, schoolId ?? null);
  }
}
