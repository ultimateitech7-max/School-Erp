import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  grantedPermissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  revokedPermissions?: string[];
}
