import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ExamStatus, ExamType } from '@prisma/client';
import { CreateExamSubjectDto } from './create-exam.dto';

export class UpdateExamDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  examCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  examName?: string;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExamSubjectDto)
  subjects?: CreateExamSubjectDto[];
}
