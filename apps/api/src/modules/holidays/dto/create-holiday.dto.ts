import { HolidayType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
  @IsUUID()
  schoolId?: string;
}
