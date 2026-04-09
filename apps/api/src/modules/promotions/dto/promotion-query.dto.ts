import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PromotionAction } from '@prisma/client';

export class PromotionQueryDto {
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
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  fromAcademicSessionId?: string;

  @IsOptional()
  @IsUUID()
  toAcademicSessionId?: string;

  @IsOptional()
  @IsUUID()
  fromClassId?: string;

  @IsOptional()
  @IsUUID()
  toClassId?: string;

  @IsOptional()
  @IsUUID()
  fromSectionId?: string;

  @IsOptional()
  @IsUUID()
  toSectionId?: string;

  @IsOptional()
  @IsEnum(PromotionAction)
  action?: PromotionAction;

  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @Transform(({ value, obj, key }) =>
    obj?.[key] === undefined ? undefined : obj[key] === true || obj[key] === 'true',
  )
  @IsBoolean()
  onlyActive?: boolean;
}
