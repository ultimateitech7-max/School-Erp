import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MaxLength(50)
  vehicleNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleType?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  driverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  attendantName?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
