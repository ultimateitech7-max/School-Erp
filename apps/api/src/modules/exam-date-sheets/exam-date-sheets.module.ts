import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExamDateSheetsController } from './exam-date-sheets.controller';
import { ExamDateSheetsService } from './exam-date-sheets.service';

@Module({
  imports: [AuditModule],
  controllers: [ExamDateSheetsController],
  providers: [ExamDateSheetsService],
})
export class ExamDateSheetsModule {}
