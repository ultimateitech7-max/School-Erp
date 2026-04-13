import { Type } from 'class-transformer';
import { HolidayAudience, HolidayType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(HolidayType)
  type!: HolidayType;

  @IsOptional()
  @IsEnum(HolidayAudience)
  audience?: HolidayAudience;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allClasses?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  classIds?: string[];

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
