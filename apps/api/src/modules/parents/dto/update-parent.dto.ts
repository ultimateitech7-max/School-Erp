import { Transform } from 'class-transformer';
import { GuardianRelationship } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateParentDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,30}$/)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    value ? String(value).trim().toLowerCase() : undefined,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  address?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationType?: GuardianRelationship;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,30}$/)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  portalPassword?: string;
}
