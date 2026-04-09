import { PromotionAction } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PromoteStudentDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  fromAcademicSessionId!: string;

  @IsUUID()
  toAcademicSessionId!: string;

  @IsUUID()
  fromClassId!: string;

  @IsUUID()
  toClassId!: string;

  @IsOptional()
  @IsUUID()
  fromSectionId?: string;

  @IsOptional()
  @IsUUID()
  toSectionId?: string;

  @IsOptional()
  @IsUUID()
  fromEnrollmentId?: string;

  @IsEnum(PromotionAction)
  action!: PromotionAction;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
