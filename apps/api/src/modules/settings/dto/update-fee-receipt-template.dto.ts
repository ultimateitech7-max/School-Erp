import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReceiptTemplateCustomFieldDto {
  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @MaxLength(200)
  value!: string;
}

export class UpdateFeeReceiptTemplateDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  receiptTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  receiptSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  headerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  footerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  termsAndConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  signatureLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  signatureImageUrl?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showSignature?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ReceiptTemplateCustomFieldDto)
  customFields?: ReceiptTemplateCustomFieldDto[];
}
