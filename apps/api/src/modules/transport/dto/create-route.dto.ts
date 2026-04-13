import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @MaxLength(50)
  routeCode!: string;

  @IsString()
  @MaxLength(150)
  routeName!: string;

  @IsString()
  @MaxLength(150)
  startPoint!: string;

  @IsString()
  @MaxLength(150)
  endPoint!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  distanceKm?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyFee!: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
