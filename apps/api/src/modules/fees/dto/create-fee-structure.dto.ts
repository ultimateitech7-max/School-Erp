import { Transform, Type } from 'class-transformer';
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
import { FeeCategory, FeeFrequency } from '@prisma/client';

export class CreateFeeStructureDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  feeCode?: string;

  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => String(value).trim())
  name!: string;

  @IsOptional()
  @IsEnum(FeeCategory)
  category?: FeeCategory;

  @IsOptional()
  @IsEnum(FeeFrequency)
  frequency?: FeeFrequency;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  lateFeePerDay?: number;

  @IsOptional()
  isOptional?: boolean;
}
