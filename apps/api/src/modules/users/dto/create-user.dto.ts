import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleType, UserType } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  fullName!: string;

  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,30}$/)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(RoleType)
  role!: RoleType;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  designation?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
