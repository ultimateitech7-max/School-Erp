import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMarkDto {
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
