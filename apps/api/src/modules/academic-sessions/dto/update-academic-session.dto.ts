import { Transform } from 'class-transformer';
import {
  IsIn,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateAcademicSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'COMPLETED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
