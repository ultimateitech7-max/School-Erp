import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateTransportAssignmentDto } from './dto/create-transport-assignment.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { TransportService } from './transport.service';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  findDashboard(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.transportService.findDashboard(currentUser, schoolId ?? null);
  }

  @Get('options')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  findOptions(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.transportService.findOptions(currentUser, schoolId ?? null);
  }

  @Post('routes')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  createRoute(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateRouteDto) {
    return this.transportService.createRoute(currentUser, dto);
  }

  @Post('vehicles')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  createVehicle(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.transportService.createVehicle(currentUser, dto);
  }

  @Post('assignments')
  @Roles(RoleType.SUPER_ADMIN, RoleType.SCHOOL_ADMIN)
  createAssignment(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: CreateTransportAssignmentDto,
  ) {
    return this.transportService.createAssignment(currentUser, dto);
  }
}
