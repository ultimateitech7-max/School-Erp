import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ParentQueryDto {
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
  @IsUUID()
  schoolId?: string;
}
