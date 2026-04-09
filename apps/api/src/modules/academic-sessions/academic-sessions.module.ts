import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AcademicSessionsController } from './academic-sessions.controller';
import { AcademicSessionsService } from './academic-sessions.service';

@Module({
  imports: [AuditModule],
  controllers: [AcademicSessionsController],
  providers: [AcademicSessionsService],
  exports: [AcademicSessionsService],
})
export class AcademicSessionsModule {}
