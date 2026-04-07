import { IsAlphanumeric, IsEmail, IsString, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  name!: string;

  @IsString()
  @IsAlphanumeric()
  code!: string;

  @IsString()
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}

