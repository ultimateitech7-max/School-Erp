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
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  create(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateStudentDto,
  ) {
    return this.studentsService.create(currentUser, dto);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('students.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: StudentQueryDto,
  ) {
    return this.studentsService.findAll(currentUser, query);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('students.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.studentsService.findOptions(currentUser, schoolId ?? null);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN, RoleType.TEACHER)
  @Permissions('students.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.studentsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  remove(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.studentsService.remove(currentUser, id, schoolId ?? null);
  }
}
