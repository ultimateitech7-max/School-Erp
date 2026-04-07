import { ModuleCode } from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'class-validator';

export class ToggleSchoolModuleDto {
  @IsString()
  schoolId!: string;

  @IsEnum(ModuleCode)
  moduleCode!: ModuleCode;

  @IsBoolean()
  enabled!: boolean;
}
