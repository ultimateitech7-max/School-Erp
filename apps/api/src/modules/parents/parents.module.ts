import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { NoticesModule } from '../notices/notices.module';
import { StudentsModule } from '../students/students.module';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [AuditModule, StudentsModule, NoticesModule, HolidaysModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
