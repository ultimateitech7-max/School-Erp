import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FeesModule } from '../fees/fees.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { HomeworkModule } from '../homework/homework.module';
import { NoticesModule } from '../notices/notices.module';
import { StudentPortalController } from './student-portal.controller';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [AuditModule, NoticesModule, HomeworkModule, HolidaysModule, FeesModule],
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
