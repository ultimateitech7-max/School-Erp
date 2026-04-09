import {
  Body,
  Controller,
  Get,
  Param,
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
import { BulkPromoteStudentsDto } from './dto/bulk-promote-students.dto';
import { PromotionPreviewDto } from './dto/promotion-preview.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('options')
  @Permissions('academics.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.promotionsService.findOptions(currentUser, schoolId ?? null);
  }

  @Get('eligible')
  @Permissions('academics.read')
  findEligibleStudents(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.findEligibleStudents(currentUser, query);
  }

  @Post('preview')
  @Permissions('academics.manage')
  previewPromotion(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: PromotionPreviewDto,
  ) {
    return this.promotionsService.previewPromotions(currentUser, dto);
  }

  @Post()
  @Permissions('academics.manage')
  promoteStudent(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: PromoteStudentDto,
  ) {
    return this.promotionsService.promoteStudent(currentUser, dto);
  }

  @Post('bulk')
  @Permissions('academics.manage')
  bulkPromoteStudents(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: BulkPromoteStudentsDto,
  ) {
    return this.promotionsService.bulkPromoteStudents(currentUser, dto);
  }

  @Get('student/:studentId')
  @Permissions('academics.read')
  findStudentPromotions(
    @CurrentUser() currentUser: JwtUser,
    @Param('studentId') studentId: string,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.findStudentPromotions(
      currentUser,
      studentId,
      query,
    );
  }

  @Get('class/:classId')
  @Permissions('academics.read')
  findClassPromotions(
    @CurrentUser() currentUser: JwtUser,
    @Param('classId') classId: string,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.findClassPromotions(currentUser, classId, query);
  }

  @Get()
  @Permissions('academics.read')
  findPromotions(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.findPromotions(currentUser, query);
  }
}
