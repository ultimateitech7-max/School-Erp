import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StudentsModule } from '../students/students.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { PublicAdmissionsController } from './public-admissions.controller';

@Module({
  imports: [AuditModule, StudentsModule],
  controllers: [AdmissionsController, PublicAdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
