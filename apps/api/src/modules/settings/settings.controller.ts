import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import {
  BrandingLogoUploadFile,
  SettingsService,
} from './settings.service';
import { UpdateSchoolBrandingDto } from './dto/update-school-branding.dto';
import { UpdateFeeReceiptTemplateDto } from './dto/update-fee-receipt-template.dto';
import { UpdateSchoolModulesDto } from './dto/update-school-modules.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';

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

  @Get('receipt-template')
  @Permissions('school.settings.manage')
  findReceiptTemplate(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.findFeeReceiptTemplate(currentUser, schoolId ?? null);
  }

  @Patch('receipt-template')
  @Permissions('school.settings.manage')
  updateReceiptTemplate(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: UpdateFeeReceiptTemplateDto,
  ) {
    return this.settingsService.updateFeeReceiptTemplate(currentUser, dto);
  }

  @Post('receipt-template/signature')
  @Permissions('school.settings.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadReceiptTemplateSignature(
    @CurrentUser() currentUser: JwtUser,
    @UploadedFile() file?: BrandingLogoUploadFile,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.uploadReceiptTemplateSignature(
      currentUser,
      file,
      schoolId ?? null,
    );
  }

  @Post('branding/logo')
  @Permissions('school.settings.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadBrandingLogo(
    @CurrentUser() currentUser: JwtUser,
    @UploadedFile() file?: BrandingLogoUploadFile,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.uploadBrandingLogo(currentUser, file, schoolId ?? null);
  }

  @Get('modules')
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('school.settings.manage')
  findModules(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.settingsService.findModules(currentUser, schoolId ?? null);
  }

  @Patch('modules')
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('school.settings.manage')
  updateModules(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: UpdateSchoolModulesDto,
  ) {
    return this.settingsService.updateModules(currentUser, dto);
  }
}
