import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const attendanceStatuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const;

export class CreateAttendanceDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsDateString()
  attendanceDate!: string;

  @IsIn(attendanceStatuses)
  status!: (typeof attendanceStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
