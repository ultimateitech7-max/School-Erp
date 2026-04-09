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
import { AdmissionsService } from './admissions.service';
import { AdmissionQueryDto } from './dto/admission-query.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post()
  @Permissions('students.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateAdmissionDto,
  ) {
    return this.admissionsService.create(currentUser, dto);
  }

  @Get()
  @Permissions('students.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: AdmissionQueryDto,
  ) {
    return this.admissionsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Permissions('students.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.admissionsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id/status')
  @Permissions('students.manage')
  updateStatus(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdmissionStatusDto,
  ) {
    return this.admissionsService.updateStatus(currentUser, id, dto);
  }

  @Post(':id/enroll')
  @Permissions('students.manage')
  enroll(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
  ) {
    return this.admissionsService.enroll(currentUser, id);
  }
}
