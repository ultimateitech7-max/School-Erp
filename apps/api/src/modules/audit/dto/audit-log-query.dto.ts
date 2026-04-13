import { Transform, Type } from 'class-transformer';
import { RoleType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  search?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsEnum(RoleType)
  @Transform(({ value }) => (value ? String(value).trim().toUpperCase() : undefined))
  actorRole?: RoleType;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
