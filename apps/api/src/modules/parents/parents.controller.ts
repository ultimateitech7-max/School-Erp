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
import { CreateParentDto } from './dto/create-parent.dto';
import { LinkParentStudentDto } from './dto/link-parent-student.dto';
import { ParentQueryDto } from './dto/parent-query.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { ParentsService } from './parents.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post('parents')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateParentDto) {
    return this.parentsService.create(currentUser, dto);
  }

  @Get('parents')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.read')
  findAll(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: ParentQueryDto,
  ) {
    return this.parentsService.findAll(currentUser, query);
  }

  @Get('parents/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.read')
  findOne(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.parentsService.findOne(currentUser, id, schoolId ?? null);
  }

  @Patch('parents/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  update(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateParentDto,
  ) {
    return this.parentsService.update(currentUser, id, dto);
  }

  @Post('parents/:id/link-student')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.manage')
  linkStudent(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: LinkParentStudentDto,
  ) {
    return this.parentsService.linkStudent(currentUser, id, dto);
  }

  @Get('parents/:id/students')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  @Permissions('students.read')
  findChildren(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.parentsService.findChildren(currentUser, id, schoolId ?? null);
  }

  @Get('parent/dashboard')
  @Roles(RoleType.PARENT)
  getParentDashboard(@CurrentUser() currentUser: JwtUser) {
    return this.parentsService.getParentDashboard(currentUser);
  }

  @Get('parent/attendance')
  @Roles(RoleType.PARENT)
  getParentAttendance(
    @CurrentUser() currentUser: JwtUser,
    @Query('studentId') studentId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.parentsService.getParentAttendance(
      currentUser,
      studentId,
      sessionId ?? null,
    );
  }

  @Get('parent/fees')
  @Roles(RoleType.PARENT)
  getParentFees(
    @CurrentUser() currentUser: JwtUser,
    @Query('studentId') studentId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.parentsService.getParentFees(
      currentUser,
      studentId,
      sessionId ?? null,
    );
  }

  @Get('parent/results')
  @Roles(RoleType.PARENT)
  getParentResults(
    @CurrentUser() currentUser: JwtUser,
    @Query('studentId') studentId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.parentsService.getParentResults(
      currentUser,
      studentId,
      sessionId ?? null,
    );
  }
}
