import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AcademicSessionsModule } from './modules/academic-sessions/academic-sessions.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { validateEnv } from './config/env.validation';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassesModule } from './modules/classes/classes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExamDateSheetsModule } from './modules/exam-date-sheets/exam-date-sheets.module';
import { ExamsModule } from './modules/exams/exams.module';
import { FeesModule } from './modules/fees/fees.module';
import { HealthModule } from './modules/health/health.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ModulesControlModule } from './modules/modules-control/modules-control.module';
import { NoticesModule } from './modules/notices/notices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParentsModule } from './modules/parents/parents.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { SectionsModule } from './modules/sections/sections.module';
import { SettingsModule } from './modules/settings/settings.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { StudentsModule } from './modules/students/students.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TimetablesModule } from './modules/timetables/timetables.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 60,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AcademicSessionsModule,
    AdmissionsModule,
    AttendanceModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    ModulesControlModule,
    StudentsModule,
    DashboardModule,
    ExamDateSheetsModule,
    ClassesModule,
    ExamsModule,
    FeesModule,
    HealthModule,
    HomeworkModule,
    HolidaysModule,
    MessagesModule,
    NotificationsModule,
    ParentsModule,
    NoticesModule,
    ReportsModule,
    SettingsModule,
    PromotionsModule,
    SectionsModule,
    SubjectsModule,
    TimetablesModule,
  ],
  providers: [
    RolesGuard,
    PermissionsGuard,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
