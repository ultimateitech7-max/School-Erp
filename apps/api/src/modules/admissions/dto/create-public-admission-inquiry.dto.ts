import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePublicAdmissionInquiryDto {
  @IsUUID()
  schoolId!: string;

  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  studentName!: string;

  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  fatherName!: string;

  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => String(value).trim())
  motherName!: string;

  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => String(value).trim())
  phone!: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    value ? String(value).trim().toLowerCase() : undefined,
  )
  email?: string;

  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => String(value).trim())
  address!: string;

  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => String(value).trim())
  classApplied!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  previousSchool?: string;

  @IsDateString()
  dob!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;
}
