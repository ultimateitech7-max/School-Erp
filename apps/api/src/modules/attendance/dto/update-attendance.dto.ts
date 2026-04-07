import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const attendanceStatuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const;

export class UpdateAttendanceDto {
  @IsOptional()
  @IsIn(attendanceStatuses)
  status?: (typeof attendanceStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
