import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class MarkEntryDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  marksObtained?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxMarks?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAbsent?: boolean;
}

export class CreateMarkDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  entries!: MarkEntryDto[];
}

export { MarkEntryDto };
