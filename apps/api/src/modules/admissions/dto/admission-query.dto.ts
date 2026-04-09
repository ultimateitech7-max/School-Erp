import { Transform, Type } from 'class-transformer';
import { AdmissionApplicationStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AdmissionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  search?: string;

  @IsOptional()
  @IsEnum(AdmissionApplicationStatus)
  status?: AdmissionApplicationStatus;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
