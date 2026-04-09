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
import { AcademicSessionsService } from './academic-sessions.service';
import { AcademicSessionQueryDto } from './dto/academic-session-query.dto';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

@Controller('academic-sessions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class AcademicSessionsController {
  constructor(
    private readonly academicSessionsService: AcademicSessionsService,
  ) {}

  @Post()
  @Permissions('academics.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateAcademicSessionDto,
  ) {
    return this.academicSessionsService.create(currentUser, dto);
  }

  @Get()
  @Permissions('academics.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: AcademicSessionQueryDto,
  ) {
    return this.academicSessionsService.findAll(currentUser, query);
  }

  @Get('current')
  @Permissions('academics.read')
  findCurrent(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.academicSessionsService.findCurrent(
      currentUser,
      schoolId ?? null,
    );
  }

  @Get(':id')
  @Permissions('academics.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.academicSessionsService.findOne(
      currentUser,
      id,
      schoolId ?? null,
    );
  }

  @Patch(':id')
  @Permissions('academics.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicSessionDto,
  ) {
    return this.academicSessionsService.update(currentUser, id, dto);
  }

  @Patch(':id/set-current')
  @Permissions('academics.manage')
  setCurrent(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.academicSessionsService.setCurrent(
      currentUser,
      id,
      schoolId ?? null,
    );
  }
}
