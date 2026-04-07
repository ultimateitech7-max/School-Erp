import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const attendanceStatuses = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const;

export class BulkAttendanceEntryDto {
  @IsUUID()
  studentId!: string;

  @IsIn(attendanceStatuses)
  status!: (typeof attendanceStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (value ? String(value).trim() : undefined))
  remarks?: string;
}

export class BulkAttendanceDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsDateString()
  attendanceDate!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  records!: BulkAttendanceEntryDto[];

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
