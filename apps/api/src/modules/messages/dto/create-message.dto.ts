import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  receiverId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  subject?: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
