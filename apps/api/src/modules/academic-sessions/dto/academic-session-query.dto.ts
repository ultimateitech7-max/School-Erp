import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AcademicSessionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  search?: string;

  @IsOptional()
  @Transform(({ value, obj, key }) =>
    parseOptionalBoolean(obj?.[key] ?? value),
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value, obj, key }) =>
    parseOptionalBoolean(obj?.[key] ?? value),
  )
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'COMPLETED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}
