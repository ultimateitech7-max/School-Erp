import { PromotionAction } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class BulkPromoteStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  studentIds!: string[];

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
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
