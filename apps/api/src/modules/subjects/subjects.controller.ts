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
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectQueryDto } from './dto/subject-query.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Permissions('academics.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(currentUser, dto);
  }

  @Get()
  @Permissions('academics.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: SubjectQueryDto,
  ) {
    return this.subjectsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Permissions('academics.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.subjectsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id')
  @Permissions('academics.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Permissions('academics.manage')
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.subjectsService.remove(currentUser, id, schoolId ?? null);
  }
}
