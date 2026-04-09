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
import { CreateExamDateSheetDto } from './dto/create-exam-date-sheet.dto';
import { ExamDateSheetQueryDto } from './dto/exam-date-sheet-query.dto';
import { ExamDateSheetsService } from './exam-date-sheets.service';

@Controller('exam-date-sheets')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamDateSheetsController {
  constructor(
    private readonly examDateSheetsService: ExamDateSheetsService,
  ) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('exams.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateExamDateSheetDto,
  ) {
    return this.examDateSheetsService.create(currentUser, dto);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: ExamDateSheetQueryDto,
  ) {
    return this.examDateSheetsService.findAll(currentUser, query);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examDateSheetsService.findOptions(currentUser, schoolId ?? null);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examDateSheetsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id/publish')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('exams.manage')
  publish(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examDateSheetsService.publish(currentUser, id, schoolId ?? null);
  }
}
