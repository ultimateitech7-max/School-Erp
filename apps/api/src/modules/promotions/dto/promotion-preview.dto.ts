import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PromotionAction } from '@prisma/client';

export class PromotionPreviewDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds?: string[];

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

  @IsEnum(PromotionAction)
  action!: PromotionAction;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : String(value).trim(),
  )
  schoolId?: string;
}
