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
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: UserQueryDto) {
    return this.usersService.findAll(currentUser, query);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.usersService.findOptions(currentUser, schoolId ?? null);
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(currentUser, dto);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  findOne(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.usersService.findOne(currentUser, id);
  }

  @Get(':id/permissions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  findPermissions(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.usersService.findPermissions(currentUser, id);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(currentUser, id, dto);
  }

  @Patch(':id/permissions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  updatePermissions(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
  ) {
    return this.usersService.updatePermissions(currentUser, id, dto);
  }

  @Patch(':id/status')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  updateStatus(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(currentUser, id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('school.settings.manage')
  remove(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.usersService.remove(currentUser, id);
  }
}
