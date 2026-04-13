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
import { AssignFeeDto } from './dto/assign-fee.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { FeeQueryDto } from './dto/fee-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { FeesService } from './fees.service';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
export class FeesController {
  constructor(private readonly feesService: FeesService) {}

  @Get('options')
  @Permissions('fees.read')
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.feesService.findOptions(currentUser, schoolId ?? null);
  }

  @Post('structure')
  @Permissions('fees.manage')
  createFeeStructure(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateFeeStructureDto,
  ) {
    return this.feesService.createFeeStructure(currentUser, dto);
  }

  @Patch('structure/:id')
  @Permissions('fees.manage')
  updateFeeStructure(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
  ) {
    return this.feesService.updateFeeStructure(currentUser, id, dto);
  }

  @Delete('structure/:id')
  @Permissions('fees.manage')
  removeFeeStructure(
    @CurrentUser() currentUser: JwtUser,
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.feesService.removeFeeStructure(currentUser, id, schoolId ?? null);
  }

  @Get('structure')
  @Permissions('fees.read')
  findFeeStructures(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: FeeQueryDto,
  ) {
    return this.feesService.findFeeStructures(currentUser, query);
  }

  @Post('assign')
  @Permissions('fees.manage')
  assignFee(@CurrentUser() currentUser: JwtUser, @Body() dto: AssignFeeDto) {
    return this.feesService.assignFee(currentUser, dto);
  }

  @Get('student/:studentId')
  @Permissions('fees.read')
  findStudentFees(
    @CurrentUser() currentUser: JwtUser,
    @Param('studentId') studentId: string,
    @Query() query: FeeQueryDto,
  ) {
    return this.feesService.findStudentFees(currentUser, studentId, query);
  }

  @Post('payment')
  @Permissions('fees.manage')
  recordPayment(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.feesService.recordPayment(currentUser, dto);
  }

  @Get('payments')
  @Permissions('fees.read')
  findPayments(
    @CurrentUser() currentUser: JwtUser,
    @Query() query: FeeQueryDto,
  ) {
    return this.feesService.findPayments(currentUser, query);
  }

  @Get('payments/:paymentId/receipt')
  @Permissions('fees.read')
  getPaymentReceipt(
    @CurrentUser() currentUser: JwtUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.feesService.getPaymentReceipt(currentUser, paymentId);
  }
}
