import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SchoolModuleToggleDto {
  @IsString()
  key!: string;

  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateSchoolModulesDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SchoolModuleToggleDto)
  modules!: SchoolModuleToggleDto[];
}

export { SchoolModuleToggleDto };
