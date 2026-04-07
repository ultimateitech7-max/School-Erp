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
import { AssignSubjectsToClassDto } from './dto/assign-subjects-to-class.dto';
import { ClassQueryDto } from './dto/class-query.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassesService } from './classes.service';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Permissions('academics.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateClassDto) {
    return this.classesService.create(currentUser, dto);
  }

  @Get()
  @Permissions('academics.read')
  findAll(@CurrentUser() currentUser: JwtUser, @Query() query: ClassQueryDto) {
    return this.classesService.findAll(currentUser, query);
  }

  @Get(':id')
  @Permissions('academics.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.classesService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id')
  @Permissions('academics.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Permissions('academics.manage')
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.classesService.remove(currentUser, id, schoolId ?? null);
  }

  @Get(':id/sections')
  @Permissions('academics.read')
  findSections(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.classesService.findSections(currentUser, id, schoolId ?? null);
  }

  @Post(':id/sections')
  @Permissions('academics.manage')
  createSection(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateClassSectionDto,
  ) {
    return this.classesService.createSection(currentUser, id, dto);
  }

  @Get(':id/subjects')
  @Permissions('academics.read')
  findSubjects(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('sessionId') sessionId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.classesService.findSubjects(
      currentUser,
      id,
      sessionId ?? null,
      schoolId ?? null,
    );
  }

  @Post(':id/subjects')
  @Permissions('academics.manage')
  assignSubjects(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignSubjectsToClassDto,
  ) {
    return this.classesService.assignSubjects(currentUser, id, dto);
  }
}
