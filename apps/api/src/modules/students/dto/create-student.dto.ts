import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  MinLength,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  studentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  admissionNo?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    value ? String(value).trim().toLowerCase() : undefined,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  portalPassword?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  joinedOn?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
