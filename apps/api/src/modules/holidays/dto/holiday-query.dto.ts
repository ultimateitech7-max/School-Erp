import { HolidayAudience, HolidayType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class HolidayQueryDto {
  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @IsOptional()
  @IsEnum(HolidayAudience)
  audience?: HolidayAudience;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
