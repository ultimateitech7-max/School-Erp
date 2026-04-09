import {
  Body,
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
import { CreateNoticeDto } from './dto/create-notice.dto';
import { NoticeQueryDto } from './dto/notice-query.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { NoticesService } from './notices.service';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('communication.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateNoticeDto) {
    return this.noticesService.create(currentUser, dto);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('communication.read')
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: NoticeQueryDto) {
    return this.noticesService.findAll(currentUser, query);
  }

  @Get('portal')
  @Roles(RoleType.STUDENT, RoleType.PARENT, RoleType.STAFF, RoleType.TEACHER)
  findPortalNotices(@CurrentUser() currentUser: JwtUser) {
    return this.noticesService.findPortalNotices(currentUser);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('communication.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.noticesService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('communication.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    return this.noticesService.update(currentUser, id, dto);
  }
}
