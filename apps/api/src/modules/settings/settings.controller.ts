import {
  Body,
  Controller,
  Get,
  Patch,
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
import { UpdateSchoolBrandingDto } from './dto/update-school-branding.dto';
import { UpdateSchoolModulesDto } from './dto/update-school-modules.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('school')
  @Permissions('school.settings.manage')
  findSchoolSettings(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.findSchoolSettings(currentUser, schoolId ?? null);
  }

  @Patch('school')
  @Permissions('school.settings.manage')
  updateSchoolSettings(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: UpdateSchoolSettingsDto,
  ) {
    return this.settingsService.updateSchoolSettings(currentUser, dto);
  }

  @Get('branding')
  @Permissions('school.settings.manage')
  findBranding(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.findBranding(currentUser, schoolId ?? null);
  }

  @Patch('branding')
  @Permissions('school.settings.manage')
  updateBranding(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: UpdateSchoolBrandingDto,
  ) {
    return this.settingsService.updateBranding(currentUser, dto);
  }

  @Get('modules')
  @Permissions('school.settings.manage')
  findModules(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.findModules(currentUser, schoolId ?? null);
  }

  @Patch('modules')
  @Permissions('school.settings.manage')
  updateModules(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: UpdateSchoolModulesDto,
  ) {
    return this.settingsService.updateModules(currentUser, dto);
  }
}
