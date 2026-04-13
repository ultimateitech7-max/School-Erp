import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdmissionsService } from './admissions.service';
import { CreatePublicAdmissionInquiryDto } from './dto/create-public-admission-inquiry.dto';

@Controller('public/admissions')
export class PublicAdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get('schools')
  findSchoolOptions() {
    return this.admissionsService.findPublicSchoolOptions();
  }

  @Post('inquiry')
  createInquiry(@Body() dto: CreatePublicAdmissionInquiryDto) {
    return this.admissionsService.createPublicInquiry(dto);
  }
}
