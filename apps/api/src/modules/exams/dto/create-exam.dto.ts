import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExamStatus, ExamType } from '@prisma/client';

class CreateExamSubjectDto {
  @IsUUID()
  subjectId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxMarks!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  passMarks!: number;

  @IsOptional()
  @IsDateString()
  examDate?: string;
}

export class CreateExamDto {
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
  examCode?: string;

  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => String(value).trim())
  examName!: string;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(ExamStatus)
  status?: ExamStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateExamSubjectDto)
  subjects!: CreateExamSubjectDto[];
}

export { CreateExamSubjectDto };
