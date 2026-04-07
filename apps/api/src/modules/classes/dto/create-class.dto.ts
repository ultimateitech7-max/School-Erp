import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  classCode?: string;

  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => String(value).trim())
  className!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gradeLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
