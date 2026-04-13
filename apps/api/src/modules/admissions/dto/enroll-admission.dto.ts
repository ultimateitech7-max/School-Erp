import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EnrollAdmissionDto {
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    value ? String(value).trim().toLowerCase() : undefined,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  portalPassword?: string;
}
