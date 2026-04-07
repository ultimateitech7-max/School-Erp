import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SubjectType } from '@prisma/client';

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  subjectCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  subjectName?: string;

  @IsOptional()
  @IsEnum(SubjectType)
  subjectType?: SubjectType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOptional?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
