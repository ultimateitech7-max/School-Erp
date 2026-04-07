import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class AssignClassSubjectDto {
  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  periodsPerWeek?: number;
}

export class AssignSubjectsToClassDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignClassSubjectDto)
  subjects: AssignClassSubjectDto[] = [];
}
