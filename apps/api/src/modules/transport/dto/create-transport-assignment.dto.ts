import { Type } from 'class-transformer';
import { TransportAssignmentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransportAssignmentDto {
  @IsUUID()
  sessionId!: string;

  @IsUUID()
  studentId!: string;

  @IsUUID()
  routeId!: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  pickupPoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  dropPoint?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyFeeOverride?: number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TransportAssignmentStatus)
  status?: TransportAssignmentStatus;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
