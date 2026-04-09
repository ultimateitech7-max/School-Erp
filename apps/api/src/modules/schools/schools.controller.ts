import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateSchoolDto } from './dto/create-school.dto';
import { SchoolQueryDto } from './dto/school-query.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('schools.manage')
  async findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: SchoolQueryDto,
  ) {
    return this.schoolsService.findAll(currentUser, query);
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN)
  @Permissions('schools.manage')
  async create(@Body() dto: CreateSchoolDto) {
    return this.schoolsService.createSchool(dto);
  }
}
