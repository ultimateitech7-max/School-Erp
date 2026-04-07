import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSchoolDto } from './dto/create-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('schools.manage')
  async create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.createSchool(dto);
  }
}
