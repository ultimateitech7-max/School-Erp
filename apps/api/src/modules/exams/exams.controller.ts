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
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateMarkDto } from './dto/create-mark.dto';
import { ExamQueryDto } from './dto/exam-query.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { ExamsService } from './exams.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('exams')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('exams.manage')
  createExam(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateExamDto) {
    return this.examsService.createExam(currentUser, dto);
  }

  @Get('exams')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findExams(@CurrentUser() currentUser: JwtUser, @Query() query: ExamQueryDto) {
    return this.examsService.findExams(currentUser, query);
  }

  @Get('exams/options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examsService.findOptions(currentUser, schoolId ?? null);
  }

  @Get('exams/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findExam(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examsService.findExam(currentUser, id, schoolId ?? null);
  }

  @Patch('exams/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('exams.manage')
  updateExam(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateExamDto,
  ) {
    return this.examsService.updateExam(currentUser, id, dto);
  }

  @Delete('exams/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('exams.manage')
  deleteExam(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examsService.deleteExam(currentUser, id, schoolId ?? null);
  }

  @Post('exams/:id/marks')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.manage')
  createMarks(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateMarkDto,
  ) {
    return this.examsService.createMarks(currentUser, id, dto);
  }

  @Patch('exams/:examId/marks/:markId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.manage')
  updateMark(
    @CurrentUser() currentUser: JwtUser,
    @Param('examId') examId: string,
    @Param('markId') markId: string,
    @Body() dto: UpdateMarkDto,
  ) {
    return this.examsService.updateMark(currentUser, examId, markId, dto);
  }

  @Get('exams/:id/results')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findExamResults(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examsService.findExamResults(currentUser, id, schoolId ?? null);
  }

  @Get('students/:id/results')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('exams.read')
  findStudentResults(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.examsService.findStudentResults(
      currentUser,
      id,
      schoolId ?? null,
    );
  }
}
