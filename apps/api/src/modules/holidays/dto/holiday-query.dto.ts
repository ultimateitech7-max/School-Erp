import { HolidayType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class HolidayQueryDto {
  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
