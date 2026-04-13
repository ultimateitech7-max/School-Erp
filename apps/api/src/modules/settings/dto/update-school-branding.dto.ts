import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateSchoolBrandingDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  secondaryColor?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  website?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    value ? String(value).trim().toLowerCase() : undefined,
  )
  supportEmail?: string;
}
