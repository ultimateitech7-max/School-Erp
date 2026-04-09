import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateExamDateSheetEntryDto {
  @IsUUID()
  subjectId!: string;

  @IsDateString()
  examDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format.',
  })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format.',
  })
  endTime!: string;
}

export class CreateExamDateSheetDto {
  @IsUUID()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  examName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateExamDateSheetEntryDto)
  entries!: CreateExamDateSheetEntryDto[];

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

export type CreateExamDateSheetEntryInput = CreateExamDateSheetDto['entries'][number];
