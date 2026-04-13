import { Transform, Type } from 'class-transformer';
import { GuardianRelationship } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

class CreateParentStudentLinkDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationType?: GuardianRelationship;
}

export class CreateParentDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  fullName!: string;

  @IsString()
  @Matches(/^[0-9+\-\s()]{7,30}$/)
  @Transform(({ value }) => String(value).trim())
  phone!: string;

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

  @IsEnum(GuardianRelationship)
  relationType!: GuardianRelationship;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,30}$/)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  portalPassword?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParentStudentLinkDto)
  studentLinks?: CreateParentStudentLinkDto[];
}
