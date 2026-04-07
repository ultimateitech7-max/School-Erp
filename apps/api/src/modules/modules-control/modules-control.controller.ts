import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ToggleSchoolModuleDto } from './dto/toggle-school-module.dto';
import { ModulesControlService } from './modules-control.service';

@Controller('modules')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ModulesControlController {
  constructor(private readonly modulesControlService: ModulesControlService) {}

  @Post('toggle')
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('schools.manage')
  async toggle(@Body() dto: ToggleSchoolModuleDto) {
    return this.modulesControlService.toggleModule(dto);
  }

  @Get('me')
  async getMyModules(@CurrentUser() currentUser: { schoolId: string | null }) {
    return this.modulesControlService.getEnabledModulesForSchool(currentUser.schoolId);
  }
}
