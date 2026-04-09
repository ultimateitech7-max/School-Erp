import { GuardianRelationship } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class LinkParentStudentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  relationType?: GuardianRelationship;
}
