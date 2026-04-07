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
import { CreateSectionDto } from './dto/create-section.dto';
import { SectionQueryDto } from './dto/section-query.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionsService } from './sections.service';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Post()
  @Permissions('academics.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateSectionDto) {
    return this.sectionsService.create(currentUser, dto);
  }

  @Get()
  @Permissions('academics.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: SectionQueryDto,
  ) {
    return this.sectionsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Permissions('academics.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.sectionsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id')
  @Permissions('academics.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sectionsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Permissions('academics.manage')
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.sectionsService.remove(currentUser, id, schoolId ?? null);
  }
}
