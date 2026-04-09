import { Transform } from 'class-transformer';
import { AdmissionApplicationStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateAdmissionStatusDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsEnum(AdmissionApplicationStatus)
  status!: AdmissionApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;
}
