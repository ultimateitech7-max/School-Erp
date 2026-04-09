import { INestApplication, ValidationPipe } from '@nestjs/common';
import { RoleType, UserType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(180_000);

describe('School ERP API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken = '';
  let schoolAdminToken = '';
  let otherSchoolAdminToken = '';
  let seededTeacherToken = '';
  let seededStaffToken = '';
  let defaultSchoolId = '';
  let isolationSchoolId = '';
  let createdStudentId = '';
  let createdStudentRegistrationNumber = '';
  let createdTeacherUserId = '';
  let createdStaffUserId = '';
  let createdClassId = '';
  let createdSectionId = '';
  let createdSubjectId = '';
  let createdFeeStructureId = '';
  let createdFeeAssignmentId = '';
  let createdExamId = '';
  let createdAcademicSessionId = '';
  let createdAcademicSessionName = '';
  let otherSchoolAcademicSessionId = '';
  let otherSchoolAcademicSessionName = '';
  let updatedAcademicSessionName = '';
  let createdExamName = '';
  let originalCurrentSessionId = '';
  let attendanceStudentId = '';
  let attendanceBulkStudentId = '';
  let attendanceRecordId = '';
  let otherSchoolClassId = '';
  let promotionTargetClassId = '';
  let promotionTargetSectionId = '';
  let promotedStudentId = '';
  let detainedStudentId = '';
  let bulkPromotionStudentOneId = '';
  let bulkPromotionStudentTwoId = '';
  let currentSessionId = '';
  let createdAdmissionId = '';
  let createdAdmissionPhone = '';
  let createdAdmissionStudentName = '';
  let createdParentId = '';
  let createdParentUserId = '';
  let createdParentEmail = '';
  let parentToken = '';
  let studentPortalUserId = '';
  let studentPortalEmail = '';
  let studentPortalToken = '';
  let createdTimetableTeacherId = '';
  let createdSecondTimetableTeacherId = '';
  let createdTimetableEntryId = '';
  let createdExamDateSheetId = '';
  let createdNoticeId = '';
  let createdMessageId = '';
  let createdExamMarkId = '';
  let createdAuxiliarySectionId = '';
  let createdTemporarySchoolId = '';
  let createdTemporaryExamId = '';
  let createdHomeworkId = '';
  let createdHolidayId = '';
  let isolationAdmissionId = '';
  let invalidTransitionAdmissionId = '';
  let enrolledAdmissionStudentId = '';
  let rollbackAdmissionId = '';
  let admissionEligibleClassName = '';
  let fallbackAdmissionClassId = '';
  const updatedClassName = `Updated E2E Class ${Date.now()}`;
  const updatedSubjectName = `Updated E2E Subject ${Date.now()}`;

  const apiPrefix = '/api/v1';
  const defaultSchoolAdmin = {
    email: 'schooladmin@school.com',
    password: '12345678',
  };
  const schoolIsolationAdmin = {
    email: 'e2e.isolation.admin@school.com',
    password: '12345678',
  };
  const teacherSeedAccount = {
    email: 'teacher@school.com',
    password: '12345678',
  };
  const staffSeedAccount = {
    email: 'staff@school.com',
    password: '12345678',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    await ensureSchoolAdminAccess();
    await ensureIsolationSchoolAdmin();

    const [defaultSchool, isolationSchool] = await Promise.all([
      prisma.school.findUnique({
        where: {
          schoolCode: 'demo-school',
        },
        select: {
          id: true,
        },
      }),
      prisma.school.findUnique({
        where: {
          schoolCode: 'e2e-isolation-school',
        },
        select: {
          id: true,
        },
      }),
    ]);

    defaultSchoolId = defaultSchool?.id ?? '';
    isolationSchoolId = isolationSchool?.id ?? '';

    const currentSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: defaultSchoolId,
        isCurrent: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    currentSessionId = currentSession?.id ?? '';

    if (!currentSessionId && defaultSchoolId) {
      const fallbackSession = await prisma.academicSession.findFirst({
        where: {
          schoolId: defaultSchoolId,
        },
        orderBy: [
          {
            isActive: 'desc',
          },
          {
            startDate: 'desc',
          },
        ],
        select: {
          id: true,
        },
      });

      if (fallbackSession) {
        await prisma.academicSession.updateMany({
          where: {
            schoolId: defaultSchoolId,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });

        await prisma.academicSession.update({
          where: {
            id: fallbackSession.id,
          },
          data: {
            isCurrent: true,
            isActive: true,
          },
        });

        currentSessionId = fallbackSession.id;
      }
    }

    originalCurrentSessionId = currentSessionId;

    const activeAdmissionClass = await prisma.academicClass.findFirst({
      where: {
        schoolId: defaultSchoolId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
      select: {
        id: true,
        className: true,
      },
    });

    if (activeAdmissionClass) {
      admissionEligibleClassName = activeAdmissionClass.className;
      fallbackAdmissionClassId = activeAdmissionClass.id;
    } else if (defaultSchoolId) {
      const createdAdmissionClass = await prisma.academicClass.create({
        data: {
          schoolId: defaultSchoolId,
          classCode: `ADM-CLASS-${Date.now()}`,
          className: `Admission Ready Class ${Date.now()}`,
          sortOrder: 999,
          isActive: true,
        },
        select: {
          id: true,
          className: true,
        },
      });

      admissionEligibleClassName = createdAdmissionClass.className;
      fallbackAdmissionClassId = createdAdmissionClass.id;
    }
  });

  afterAll(async () => {
    for (const studentId of [
      createdStudentId,
      enrolledAdmissionStudentId,
      attendanceStudentId,
      attendanceBulkStudentId,
      promotedStudentId,
      detainedStudentId,
      bulkPromotionStudentOneId,
      bulkPromotionStudentTwoId,
    ]) {
      if (!studentId) {
        continue;
      }

      await prisma.student.updateMany({
        where: {
          id: studentId,
        },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    if (createdTeacherUserId) {
      await prisma.user.updateMany({
        where: {
          id: createdTeacherUserId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdStaffUserId) {
      await prisma.user.updateMany({
        where: {
          id: createdStaffUserId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdParentUserId) {
      await prisma.user.updateMany({
        where: {
          id: createdParentUserId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (studentPortalUserId) {
      await prisma.user.updateMany({
        where: {
          id: studentPortalUserId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdTimetableTeacherId) {
      await prisma.teacher.updateMany({
        where: {
          id: createdTimetableTeacherId,
        },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    if (createdSecondTimetableTeacherId) {
      await prisma.teacher.updateMany({
        where: {
          id: createdSecondTimetableTeacherId,
        },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    if (createdTimetableEntryId) {
      await prisma.timetableEntry.deleteMany({
        where: {
          id: createdTimetableEntryId,
        },
      });
    }

    if (createdExamDateSheetId) {
      await prisma.examDateSheet.deleteMany({
        where: {
          id: createdExamDateSheetId,
        },
      });
    }

    if (createdHomeworkId) {
      await prisma.homework.deleteMany({
        where: {
          id: createdHomeworkId,
        },
      });
    }

    if (createdHolidayId) {
      await prisma.holiday.deleteMany({
        where: {
          id: createdHolidayId,
        },
      });
    }

    if (createdSectionId) {
      await prisma.section.updateMany({
        where: {
          id: createdSectionId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (promotionTargetSectionId) {
      await prisma.section.updateMany({
        where: {
          id: promotionTargetSectionId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdAcademicSessionId) {
      await prisma.academicSession.updateMany({
        where: {
          id: createdAcademicSessionId,
        },
        data: {
          isCurrent: false,
          isActive: false,
        },
      });
    }

    if (otherSchoolAcademicSessionId) {
      await prisma.academicSession.updateMany({
        where: {
          id: otherSchoolAcademicSessionId,
        },
        data: {
          isCurrent: false,
          isActive: false,
        },
      });
    }

    if (fallbackAdmissionClassId) {
      await prisma.academicClass.updateMany({
        where: {
          id: fallbackAdmissionClassId,
          classCode: {
            startsWith: 'ADM-CLASS-',
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdSubjectId) {
      await prisma.subject.updateMany({
        where: {
          id: createdSubjectId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (createdClassId) {
      await prisma.academicClass.updateMany({
        where: {
          id: createdClassId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (promotionTargetClassId) {
      await prisma.academicClass.updateMany({
        where: {
          id: promotionTargetClassId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (otherSchoolClassId) {
      await prisma.academicClass.updateMany({
        where: {
          id: otherSchoolClassId,
        },
        data: {
          isActive: false,
        },
      });
    }

    if (defaultSchoolId && originalCurrentSessionId) {
      await prisma.academicSession.updateMany({
        where: {
          schoolId: defaultSchoolId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      await prisma.academicSession.updateMany({
        where: {
          id: originalCurrentSessionId,
        },
        data: {
          isCurrent: true,
          isActive: true,
        },
      });
    }

    await app.close();
  });

  it('POST /auth/login as super admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send({
        email: 'admin@school.com',
        password: '12345678',
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.accessToken).toBeDefined();

    superAdminToken = response.body.accessToken as string;
  });

  it('POST /auth/login as default school admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send(defaultSchoolAdmin);

    expect([200, 201]).toContain(response.status);
    expect(response.body.accessToken).toBeDefined();

    schoolAdminToken = response.body.accessToken as string;
  });

  it('POST /auth/login as isolation school admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send(schoolIsolationAdmin);

    expect([200, 201]).toContain(response.status);
    expect(response.body.accessToken).toBeDefined();

    otherSchoolAdminToken = response.body.accessToken as string;
  });

  it('POST /auth/login as seeded teacher', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send(teacherSeedAccount);

    expect([200, 201]).toContain(response.status);
    expect(response.body.accessToken).toBeDefined();

    seededTeacherToken = response.body.accessToken as string;
  });

  it('POST /auth/login as seeded staff', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send(staffSeedAccount);

    expect([200, 201]).toContain(response.status);
    expect(response.body.accessToken).toBeDefined();

    seededStaffToken = response.body.accessToken as string;
  });

  it('GET /auth/profile returns authenticated user profile', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/auth/profile`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBeDefined();
    expect(response.body.user.email).toBe(defaultSchoolAdmin.email);
    expect(Array.isArray(response.body.permissions)).toBe(true);
  });

  it('POST /schools creates a new school as super admin', async () => {
    const schoolCode = `e2eschool${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/schools`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: `E2E School ${Date.now()}`,
        code: schoolCode,
        adminName: 'E2E School Admin',
        adminEmail: `${schoolCode}@school.com`,
        adminPassword: '12345678',
      });

    expect(response.status).toBe(201);
    expect(response.body.school.id).toBeDefined();
    expect(response.body.school.schoolCode).toBe(schoolCode);
    expect(response.body.adminUser.role).toBe('SCHOOL_ADMIN');

    createdTemporarySchoolId = response.body.school.id as string;
  });

  it('GET /schools lists schools for super admin', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/schools`)
      .query({
        search: 'e2eschool',
      })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.some((school: { id: string }) => school.id === createdTemporarySchoolId)).toBe(true);
    expect(response.body.meta.total).toBeGreaterThan(0);
  });

  it('GET /modules/me returns enabled modules for the current school', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/modules/me`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('POST /modules/toggle updates a school module as super admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/modules/toggle`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        schoolId: createdTemporarySchoolId || defaultSchoolId,
        moduleCode: 'COMMUNICATION',
        enabled: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.schoolId).toBe(createdTemporarySchoolId || defaultSchoolId);
    expect(response.body.module.moduleCode).toBe('COMMUNICATION');
    expect(response.body.enabled).toBe(true);
  });

  it('GET /health returns service health', async () => {
    const response = await request(app.getHttpServer()).get(`${apiPrefix}/health`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.services.database.status).toBe('ok');
  });

  it('POST /students creates a student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `E2E Student ${Date.now()}`,
        email: `e2e.${Date.now()}@school.com`,
        phone: '9999999999',
        gender: 'MALE',
        dateOfBirth: '2012-05-10',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.registrationNumber).toMatch(
      /^[A-Z0-9]+-\d{4}-\d{4}$/,
    );

    createdStudentId = response.body.data.id as string;
    createdStudentRegistrationNumber =
      response.body.data.registrationNumber as string;
  });

  it('GET /students/registration/:registrationNumber fetches a student', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/students/registration/${encodeURIComponent(createdStudentRegistrationNumber)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdStudentId);
    expect(response.body.data.registrationNumber).toBe(
      createdStudentRegistrationNumber,
    );
  });

  it('GET /students/options returns student form options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(response.body.data.currentSessionId).toBeTruthy();
  });

  it('GET /students returns paginated students', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students?page=1&limit=10&search=E2E`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (student: { id?: string }) => student.id === createdStudentId,
      ),
    ).toBe(true);
  });

  it('GET /students supports registration number search', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/students?page=1&limit=10&search=${encodeURIComponent(createdStudentRegistrationNumber)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (student: { registrationNumber?: string }) =>
          student.registrationNumber === createdStudentRegistrationNumber,
      ),
    ).toBe(true);
  });

  it('POST /students rejects duplicate registration number in the same school', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        schoolId: defaultSchoolId,
        name: `Duplicate Registration ${Date.now()}`,
        email: `duplicate.registration.${Date.now()}@school.com`,
        registrationNumber: createdStudentRegistrationNumber,
      });

    expect(response.status).toBe(409);
  });

  it('PATCH /students/:id updates a student', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/students/${createdStudentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Updated E2E Student',
        phone: '8888888888',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated E2E Student');
    expect(response.body.data.phone).toBe('8888888888');
  });

  it('GET /students/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${createdStudentId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /students/registration/:registrationNumber blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/students/registration/${encodeURIComponent(createdStudentRegistrationNumber)}`,
      )
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /students/registration/:registrationNumber returns not found for invalid value', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/registration/INVALID-REG-0000`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('DELETE /students/:id soft deletes a student', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/students/${createdStudentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdStudentId,
      deleted: true,
    });
  });

  it('GET /students/:id returns not found after delete', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${createdStudentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /settings/school returns school settings', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/settings/school`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.schoolCode).toBe('demo-school');
  });

  it('PATCH /settings/school updates school settings', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/settings/school`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Demo School Updated',
        contactEmail: 'settings-demo@school.com',
        contactPhone: '+91-9111111111',
        timezone: 'Asia/Kolkata',
        principalName: 'E2E Principal',
        academicSessionLabel: '2026-2027',
        address: {
          line1: 'Settings Campus',
          city: 'Lucknow',
          state: 'Uttar Pradesh',
          country: 'India',
          postalCode: '226001',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Demo School Updated');
    expect(response.body.data.principalName).toBe('E2E Principal');
    expect(response.body.data.academicSessionLabel).toBe('2026-2027');
    expect(response.body.data.address.city).toBe('Lucknow');
  });

  it('GET /settings/branding returns branding settings', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/settings/branding`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
  });

  it('PATCH /settings/branding updates branding settings', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/settings/branding`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#0f766e',
        secondaryColor: '#115e59',
        website: 'https://demo-school.test',
        supportEmail: 'support@demo-school.test',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.logoUrl).toBe('https://example.com/logo.png');
    expect(response.body.data.primaryColor).toBe('#0f766e');
    expect(response.body.data.supportEmail).toBe('support@demo-school.test');
  });

  it('GET /settings/modules returns school module toggles', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/settings/modules`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some(
        (moduleItem: { key?: string }) => moduleItem.key === 'students',
      ),
    ).toBe(true);
  });

  it('GET /users/options returns role-scoped user options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/users/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.roles)).toBe(true);
    expect(
      response.body.data.roles.some(
        (role: { code?: string }) => role.code === 'TEACHER',
      ),
    ).toBe(true);
  });

  it('PATCH /settings/modules updates module toggles', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/settings/modules`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        modules: [
          {
            key: 'dashboard',
            enabled: true,
          },
          {
            key: 'students',
            enabled: false,
          },
          {
            key: 'attendance',
            enabled: true,
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.find(
        (moduleItem: { key: string }) => moduleItem.key === 'students',
      )?.enabled,
    ).toBe(false);
    expect(
      response.body.data.find(
        (moduleItem: { key: string }) => moduleItem.key === 'dashboard',
      )?.enabled,
    ).toBe(true);
  });

  it('GET /settings/school blocks school admin cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/settings/school?schoolId=${isolationSchoolId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('GET /settings/school allows super admin override', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/settings/school?schoolId=${isolationSchoolId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(isolationSchoolId);
    expect(response.body.data.schoolCode).toBe('e2e-isolation-school');
  });

  it('POST /academic-sessions creates an academic session', async () => {
    createdAcademicSessionName = `E2E Session ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/academic-sessions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: createdAcademicSessionName,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isCurrent: false,
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.name).toContain('E2E Session');

    createdAcademicSessionId = response.body.data.id as string;
  });

  it('POST /academic-sessions creates isolation school academic session', async () => {
    otherSchoolAcademicSessionName = `Isolation Session ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/academic-sessions`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
      .send({
        name: otherSchoolAcademicSessionName,
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isCurrent: false,
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(isolationSchoolId);

    otherSchoolAcademicSessionId = response.body.data.id as string;
  });

  it('GET /academic-sessions returns paginated academic sessions', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/academic-sessions?page=1&limit=10&search=${encodeURIComponent(createdAcademicSessionName)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (session: { id?: string }) => session.id === createdAcademicSessionId,
      ),
    ).toBe(true);
    expect(
      response.body.data.every(
        (session: { schoolId?: string }) => session.schoolId === defaultSchoolId,
      ),
    ).toBe(true);
  });

  it('GET /academic-sessions supports current-session filter', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions?page=1&limit=10&isCurrent=true`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.every(
        (session: { isCurrent?: boolean }) => session.isCurrent === true,
      ),
    ).toBe(true);
  });

  it('GET /academic-sessions/:id returns a single academic session', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdAcademicSessionId);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
  });

  it('GET /academic-sessions/current returns the current academic session', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions/current`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(currentSessionId);
    expect(response.body.data.isCurrent).toBe(true);
  });

  it('GET /academic-sessions/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /academic-sessions allows super admin school override', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/academic-sessions?page=1&limit=10&schoolId=${isolationSchoolId}&search=${encodeURIComponent(otherSchoolAcademicSessionName)}`,
      )
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (session: { id?: string }) => session.id === otherSchoolAcademicSessionId,
      ),
    ).toBe(true);
    expect(
      response.body.data.every(
        (session: { schoolId?: string }) => session.schoolId === isolationSchoolId,
      ),
    ).toBe(true);
  });

  it('PATCH /academic-sessions/:id updates an academic session', async () => {
    const updatedSessionName = `Updated Session ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: updatedSessionName,
        startDate: '2026-04-15',
        endDate: '2027-03-20',
        status: 'ACTIVE',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdAcademicSessionId);
    expect(response.body.data.name).toBe(updatedSessionName);
    expect(response.body.data.status).toBe('ACTIVE');

    updatedAcademicSessionName = updatedSessionName;
  });

  it('GET /academic-sessions supports search + status filtering', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/academic-sessions?page=1&limit=10&search=Updated Session&status=ACTIVE`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (session: { id?: string; status?: string }) =>
          session.id === createdAcademicSessionId && session.status === 'ACTIVE',
      ),
    ).toBe(true);
  });

  it('PATCH /academic-sessions/:id/set-current sets the current academic session', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}/set-current`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdAcademicSessionId);
    expect(response.body.data.isCurrent).toBe(true);
    expect(response.body.data.status).toBe('ACTIVE');

    const currentSessions = await prisma.academicSession.findMany({
      where: {
        schoolId: defaultSchoolId,
        isCurrent: true,
      },
      select: {
        id: true,
      },
    });

    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0]?.id).toBe(createdAcademicSessionId);

    if (currentSessionId) {
      const previousCurrentSession = await prisma.academicSession.findUnique({
        where: {
          id: currentSessionId,
        },
        select: {
          isCurrent: true,
        },
      });

      expect(previousCurrentSession?.isCurrent).toBe(false);
    }
  });

  it('GET /academic-sessions/current returns the newly set current session', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions/current`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdAcademicSessionId);
    expect(response.body.data.isCurrent).toBe(true);
  });

  it('GET /academic-sessions supports non-current filter', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/academic-sessions?page=1&limit=10&isCurrent=false`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.every(
        (session: { isCurrent?: boolean }) => session.isCurrent === false,
      ),
    ).toBe(true);
  });

  it('PATCH /academic-sessions/:id blocks cross-school updates', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
      .send({
        name: `Blocked Session ${Date.now()}`,
        status: 'INACTIVE',
      });

    expect([403, 404]).toContain(response.status);
  });

  it('PATCH /academic-sessions/:id/set-current blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/academic-sessions/${createdAcademicSessionId}/set-current`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('PATCH /academic-sessions/:id/set-current returns not found for missing session', async () => {
    const response = await request(app.getHttpServer())
      .patch(
        `${apiPrefix}/academic-sessions/00000000-0000-0000-0000-000000000000/set-current`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('POST /academic-sessions rejects duplicate names within the same school', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/academic-sessions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: updatedAcademicSessionName,
        startDate: '2026-06-01',
        endDate: '2027-03-31',
        isCurrent: false,
        isActive: true,
      });

    expect(response.status).toBe(409);
  });

  it('POST /academic-sessions rejects invalid date ranges', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/academic-sessions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Invalid Session ${Date.now()}`,
        startDate: '2027-04-01',
        endDate: '2026-03-31',
        isCurrent: false,
        isActive: true,
      });

    expect(response.status).toBe(400);
  });

  it('POST /admissions creates an admission application', async () => {
    createdAdmissionPhone = `98${Date.now().toString().slice(-8)}`;
    createdAdmissionStudentName = `E2E Admission ${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentName: createdAdmissionStudentName,
        fatherName: 'E2E Father',
        motherName: 'E2E Mother',
        phone: createdAdmissionPhone,
        email: `admission.${Date.now()}@school.com`,
        address: 'Lucknow, Uttar Pradesh',
        classApplied: admissionEligibleClassName,
        previousSchool: 'E2E Primary School',
        dob: '2015-05-10',
        remarks: 'Initial inquiry created during e2e.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.studentName).toBe(createdAdmissionStudentName);
    expect(response.body.data.status).toBe('INQUIRY');

    createdAdmissionId = response.body.data.id as string;
  });

  it('POST /admissions creates an isolation school admission application', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
      .send({
        studentName: `Isolation Admission ${Date.now()}`,
        fatherName: 'Isolation Father',
        motherName: 'Isolation Mother',
        phone: `97${Date.now().toString().slice(-8)}`,
        email: `isolation.admission.${Date.now()}@school.com`,
        address: 'Kanpur, Uttar Pradesh',
        classApplied: 'Class 5',
        dob: '2016-02-15',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    isolationAdmissionId = response.body.data.id as string;
  });

  it('GET /admissions lists admissions with search and pagination', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/admissions?page=1&limit=10&search=${encodeURIComponent(createdAdmissionPhone)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some(
        (item: { id: string }) => item.id === createdAdmissionId,
      ),
    ).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it('GET /admissions/:id returns a single application', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/admissions/${createdAdmissionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdAdmissionId);
    expect(response.body.data.studentName).toBe(createdAdmissionStudentName);
  });

  it('PATCH /admissions/:id/status updates admission status', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${createdAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'APPLIED',
        remarks: 'Application form submitted for review.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('APPLIED');
    expect(response.body.data.remarks).toBe(
      'Application form submitted for review.',
    );
  });

  it('GET /admissions filters by status', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/admissions?page=1&limit=10&status=APPLIED`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (item: { id: string; status: string }) =>
          item.id === createdAdmissionId && item.status === 'APPLIED',
      ),
    ).toBe(true);
  });

  it('GET /admissions/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/admissions/${createdAdmissionId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Admission application not found.');
  });

  it('POST /admissions creates a fresh inquiry for invalid transition testing', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentName: `Invalid Transition Admission ${Date.now()}`,
        fatherName: 'Workflow Father',
        motherName: 'Workflow Mother',
        phone: `96${Date.now().toString().slice(-8)}`,
        address: 'Varanasi, Uttar Pradesh',
        classApplied: 'Class 7',
        dob: '2014-08-18',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('INQUIRY');

    invalidTransitionAdmissionId = response.body.data.id as string;
  });

  it('PATCH /admissions/:id/status rejects invalid status transitions', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${invalidTransitionAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'APPROVED',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Admission status cannot be changed from INQUIRY to APPROVED.',
    );
  });

  it('PATCH /admissions/:id/status moves admission to under review', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${createdAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'UNDER_REVIEW',
        remarks: 'Academic records verified.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('UNDER_REVIEW');
  });

  it('PATCH /admissions/:id/status approves admission for enrollment', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${createdAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'APPROVED',
        remarks: 'Admission approved for onboarding.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('APPROVED');
  });

  it('POST /admissions/:id/enroll blocks cross-school enrollment access', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions/${createdAdmissionId}/enroll`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Admission application not found.');
  });

  it('POST /admissions/:id/enroll rejects enrollment when status is not approved', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions/${invalidTransitionAdmissionId}/enroll`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Only approved admission applications can be enrolled.',
    );
  });

  it('POST /admissions/:id/enroll creates student and current-session enrollment', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions/${createdAdmissionId}/enroll`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.admission.status).toBe('ENROLLED');
    expect(response.body.data.student.id).toBeTruthy();
    expect(response.body.data.student.registrationNumber).toMatch(
      /^DEMOSCHOOL-\d{4}-\d{4}$/,
    );

    enrolledAdmissionStudentId = response.body.data.student.id as string;

    const activeSession = await prisma.academicSession.findFirst({
      where: {
        schoolId: defaultSchoolId,
        isCurrent: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const [student, enrollment, application] = await Promise.all([
      prisma.student.findUnique({
        where: {
          id: enrolledAdmissionStudentId,
        },
        select: {
          id: true,
          schoolId: true,
          registrationNumber: true,
          fullName: true,
        },
      }),
      prisma.admission.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: enrolledAdmissionStudentId,
          sessionId: activeSession?.id,
        },
        select: {
          id: true,
          admissionStatus: true,
          classId: true,
        },
      }),
      prisma.admissionApplication.findUnique({
        where: {
          id: createdAdmissionId,
        },
        select: {
          status: true,
          studentId: true,
        },
      }),
    ]);

    expect(student?.fullName).toBe(createdAdmissionStudentName);
    expect(student?.registrationNumber).toBeTruthy();
    expect(enrollment?.admissionStatus).toBe('ACTIVE');
    expect(application?.status).toBe('ENROLLED');
    expect(application?.studentId).toBe(enrolledAdmissionStudentId);
  });

  it('POST /admissions/:id/enroll prevents duplicate enrollment', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions/${createdAdmissionId}/enroll`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'This admission application has already been enrolled.',
    );
  });

  it('POST /admissions creates admission for rollback validation', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentName: `Rollback Admission ${Date.now()}`,
        fatherName: 'Rollback Father',
        motherName: 'Rollback Mother',
        phone: `95${Date.now().toString().slice(-8)}`,
        address: 'Prayagraj, Uttar Pradesh',
        classApplied: 'Unknown Class',
        dob: '2015-01-15',
      });

    expect(response.status).toBe(201);
    rollbackAdmissionId = response.body.data.id as string;
  });

  it('PATCH /admissions/:id/status prepares rollback admission for enrollment', async () => {
    const appliedResponse = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${rollbackAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'APPLIED',
      });

    expect(appliedResponse.status).toBe(200);

    const reviewResponse = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${rollbackAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'UNDER_REVIEW',
      });

    expect(reviewResponse.status).toBe(200);

    const approvedResponse = await request(app.getHttpServer())
      .patch(`${apiPrefix}/admissions/${rollbackAdmissionId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'APPROVED',
      });

    expect(approvedResponse.status).toBe(200);
    expect(approvedResponse.body.data.status).toBe('APPROVED');
  });

  it('POST /admissions/:id/enroll rolls back if target class is invalid', async () => {
    const beforeStudents = await prisma.student.count({
      where: {
        schoolId: defaultSchoolId,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/admissions/${rollbackAdmissionId}/enroll`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'The applied class does not exist as an active class in this school.',
    );

    const [afterStudents, application] = await Promise.all([
      prisma.student.count({
        where: {
          schoolId: defaultSchoolId,
        },
      }),
      prisma.admissionApplication.findUnique({
        where: {
          id: rollbackAdmissionId,
        },
        select: {
          status: true,
          studentId: true,
        },
      }),
    ]);

    expect(afterStudents).toBe(beforeStudents);
    expect(application?.status).toBe('APPROVED');
    expect(application?.studentId).toBeNull();
  });

  it('POST /users creates a teacher as school admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/users`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: 'E2E Teacher User',
        email: `e2e.teacher.${Date.now()}@school.com`,
        phone: '9000000001',
        password: 'Teacher@123',
        role: 'TEACHER',
        designation: 'Mathematics Teacher',
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('TEACHER');
    expect(response.body.data.userType).toBe('TEACHER');

    createdTeacherUserId = response.body.data.id as string;
  });

  it('POST /users creates a staff user as school admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/users`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: 'E2E Staff User',
        email: `e2e.staff.${Date.now()}@school.com`,
        phone: '9000000002',
        password: 'Staff@123',
        role: 'STAFF',
        designation: 'Accountant',
        isActive: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('STAFF');
    expect(response.body.data.userType).toBe('STAFF');

    createdStaffUserId = response.body.data.id as string;
  });

  it('POST /users blocks school admin from creating a super admin', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/users`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: 'Blocked Super Admin',
        email: `blocked.superadmin.${Date.now()}@school.com`,
        password: 'Super@123',
        role: 'SUPER_ADMIN',
      });

    expect(response.status).toBe(403);
  });

  it('GET /users returns paginated school users', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/users?page=1&limit=10&search=E2E&status=ACTIVE`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (user: { id?: string }) => user.id === createdTeacherUserId,
      ),
    ).toBe(true);
    expect(
      response.body.data.some(
        (user: { id?: string }) => user.id === createdStaffUserId,
      ),
    ).toBe(true);
  });

  it('GET /users/:id returns a single school user', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/users/${createdTeacherUserId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdTeacherUserId);
    expect(response.body.data.role).toBe('TEACHER');
  });

  it('GET /users/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/users/${createdTeacherUserId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('PATCH /users/:id updates teacher details', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/users/${createdTeacherUserId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: 'Updated E2E Teacher User',
        phone: '9555555555',
        designation: 'Science Teacher',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Updated E2E Teacher User');
    expect(response.body.data.phone).toBe('9555555555');
    expect(response.body.data.designation).toBe('Science Teacher');
  });

  it('PATCH /users/:id/status deactivates a teacher', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/users/${createdTeacherUserId}/status`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.isActive).toBe(false);
    expect(response.body.data.status).toBe('INACTIVE');
  });

  it('DELETE /users/:id soft deletes a staff user', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/users/${createdStaffUserId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdStaffUserId,
      deleted: true,
    });
  });

  it('POST /classes creates a class', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        className: `E2E Class ${Date.now()}`,
        gradeLevel: 10,
        sortOrder: 10,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();

    createdClassId = response.body.data.id as string;
  });

  it('POST /sections creates a section', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/sections`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        sectionName: 'A',
        roomNo: '101',
        capacity: 40,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();

    createdSectionId = response.body.data.id as string;
  });

  it('GET /sections/:id returns a single section', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/sections/${createdSectionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdSectionId);
    expect(response.body.data.class.id).toBe(createdClassId);
  });

  it('POST /subjects creates a subject', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/subjects`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        subjectName: `E2E Subject ${Date.now()}`,
        subjectType: 'THEORY',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();

    createdSubjectId = response.body.data.id as string;
  });

  it('GET /subjects/:id returns a single subject', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdSubjectId);
  });

  it('POST /students creates an attendance student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Attendance Student ${Date.now()}`,
        email: `attendance.${Date.now()}@school.com`,
        phone: '9000000100',
        gender: 'MALE',
        dateOfBirth: '2011-03-12',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    attendanceStudentId = response.body.data.id as string;
  });

  it('POST /students creates a second attendance student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Attendance Bulk Student ${Date.now()}`,
        email: `attendance.bulk.${Date.now()}@school.com`,
        phone: '9000000101',
        gender: 'FEMALE',
        dateOfBirth: '2011-04-18',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    attendanceBulkStudentId = response.body.data.id as string;
  });

  it('GET /attendance/options returns attendance selectors', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/attendance/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(Array.isArray(response.body.data.students)).toBe(true);
  });

  it('GET /classes returns paginated classes', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/classes?page=1&limit=10&search=E2E`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (academicClass: { id?: string }) => academicClass.id === createdClassId,
      ),
    ).toBe(true);
  });

  it('GET /classes/:id returns a single class', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdClassId);
  });

  it('GET /sections returns paginated sections', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/sections?page=1&limit=10&search=A&classId=${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (section: { id?: string }) => section.id === createdSectionId,
      ),
    ).toBe(true);
  });

  it('GET /subjects returns paginated subjects', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/subjects?page=1&limit=10&search=E2E`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (subject: { id?: string }) => subject.id === createdSubjectId,
      ),
    ).toBe(true);
  });

  it('POST /attendance marks single attendance', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/attendance`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: attendanceStudentId,
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
        attendanceDate: '2026-01-15',
        status: 'PRESENT',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('PRESENT');

    attendanceRecordId = response.body.data.id as string;
  });

  it('POST /attendance prevents duplicate attendance for same student and date', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/attendance`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: attendanceStudentId,
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
        attendanceDate: '2026-01-15',
        status: 'ABSENT',
      });

    expect(response.status).toBe(409);
  });

  it('POST /attendance/bulk marks bulk attendance', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/attendance/bulk`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
        attendanceDate: '2026-01-16',
        records: [
          {
            studentId: attendanceStudentId,
            status: 'ABSENT',
          },
          {
            studentId: attendanceBulkStudentId,
            status: 'LATE',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });

  it('GET /attendance returns paginated attendance records', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/attendance?page=1&limit=10&classId=${createdClassId}&attendanceDate=2026-01-16`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(response.body.data).toHaveLength(2);
  });

  it('GET /attendance/student/:studentId blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/attendance/student/${attendanceStudentId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /attendance/class/:classId returns class attendance', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/attendance/class/${createdClassId}?attendanceDate=2026-01-16`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });

  it('GET /attendance/summary returns attendance summary', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/attendance/summary?startDate=2026-01-15&endDate=2026-01-16&classId=${createdClassId}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      total: 3,
      totalPresent: 1,
      totalAbsent: 1,
      totalLate: 1,
      totalLeave: 0,
    });
  });

  it('PATCH /attendance/:id updates attendance status', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/attendance/${attendanceRecordId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        status: 'LEAVE',
        remarks: 'Approved leave',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('LEAVE');
    expect(response.body.data.remarks).toBe('Approved leave');
  });

  it('POST /classes/:id/sections creates a section from class route', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes/${createdClassId}/sections`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sectionName: `B-${Date.now()}`,
        roomNo: '204',
        capacity: 35,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.class.id).toBe(createdClassId);

    createdAuxiliarySectionId = response.body.data.id as string;
  });

  it('GET /classes/:id/sections returns sections for a class', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/classes/${createdClassId}/sections`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdClassId);
    expect(
      response.body.data.sections.some(
        (section: { id?: string }) =>
          section.id === createdSectionId || section.id === createdAuxiliarySectionId,
      ),
    ).toBe(true);
  });

  it('POST /classes/:id/subjects assigns subjects to a class', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes/${createdClassId}/subjects`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        subjects: [
          {
            subjectId: createdSubjectId,
            isMandatory: true,
            periodsPerWeek: 5,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.subjects.some(
        (subject: { id?: string }) => subject.id === createdSubjectId,
      ),
    ).toBe(true);
  });

  it('GET /classes/:id/subjects returns assigned subjects', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/classes/${createdClassId}/subjects`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.subjects.some(
        (subject: { id?: string }) => subject.id === createdSubjectId,
      ),
    ).toBe(true);
  });

  it('GET /classes/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('POST /classes creates isolation school class', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
      .send({
        className: `Isolation Class ${Date.now()}`,
        gradeLevel: 9,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    otherSchoolClassId = response.body.data.id as string;
  });

  it('POST /classes/:id/subjects prevents cross-school subject assignment', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes/${otherSchoolClassId}/subjects`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
      .send({
        subjects: [
          {
            subjectId: createdSubjectId,
            isMandatory: true,
          },
        ],
      });

    expect(response.status).toBe(404);
  });

  it('PATCH /classes/:id updates a class', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        className: updatedClassName,
        sortOrder: 20,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.className).toBe(updatedClassName);
  });

  it('PATCH /sections/:id updates a section', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/sections/${createdSectionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sectionName: 'B',
        capacity: 45,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sectionName).toBe('B');
  });

  it('PATCH /subjects/:id updates a subject', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        subjectName: updatedSubjectName,
        isOptional: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.subjectName).toBe(updatedSubjectName);
    expect(response.body.data.isOptional).toBe(true);
  });

  it('GET /dashboard/overview returns school overview analytics', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/overview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.totals).toMatchObject({
      students: expect.any(Number),
      teachers: expect.any(Number),
      staff: expect.any(Number),
      classes: expect.any(Number),
      subjects: expect.any(Number),
      exams: expect.any(Number),
    });
    expect(response.body.data.totals.students).toBeGreaterThanOrEqual(0);
    expect(response.body.data.totals.classes).toBeGreaterThanOrEqual(0);
    expect(response.body.data.totals.subjects).toBeGreaterThanOrEqual(0);
    expect(response.body.data.attendanceToday).toMatchObject({
      total: expect.any(Number),
      present: expect.any(Number),
      absent: expect.any(Number),
      late: expect.any(Number),
      leave: expect.any(Number),
    });
    expect(Array.isArray(response.body.data.recentActivities)).toBe(true);
  });

  it('GET /dashboard/attendance returns attendance analytics', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/attendance?days=7`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.summary).toMatchObject({
      total: expect.any(Number),
      present: expect.any(Number),
      absent: expect.any(Number),
      late: expect.any(Number),
      leave: expect.any(Number),
    });
    expect(Array.isArray(response.body.data.chart)).toBe(true);
    expect(response.body.data.chart.length).toBeGreaterThan(0);
  });

  it('GET /dashboard/fees returns fee analytics', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/fees?months=6`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.totals).toMatchObject({
      collected: expect.any(Number),
      pending: expect.any(Number),
      assigned: expect.any(Number),
      paymentCount: expect.any(Number),
    });
    expect(Array.isArray(response.body.data.chart)).toBe(true);
  });

  it('GET /dashboard/classes returns class distribution analytics', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/classes`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(Array.isArray(response.body.data.distribution)).toBe(true);
    expect(
      response.body.data.distribution.some(
        (item: { id?: string }) => item.id === createdClassId,
      ),
    ).toBe(true);
  });

  it('GET /dashboard/exams returns exam analytics', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/exams`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(defaultSchoolId);
    expect(response.body.data.summary).toMatchObject({
      total: expect.any(Number),
      draft: expect.any(Number),
      scheduled: expect.any(Number),
      ongoing: expect.any(Number),
      published: expect.any(Number),
      closed: expect.any(Number),
      averagePercentage: expect.any(Number),
    });
    expect(Array.isArray(response.body.data.recentExams)).toBe(true);
  });

  it('GET /dashboard/overview blocks school admin cross-school override', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/overview?schoolId=${isolationSchoolId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('GET /dashboard/overview allows super admin school override', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/dashboard/overview?schoolId=${isolationSchoolId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schoolId).toBe(isolationSchoolId);
  });

  it('POST /fees/structure creates a fee structure', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/fees/structure`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sessionId: currentSessionId,
        classId: createdClassId,
        name: `E2E Fee ${Date.now()}`,
        category: 'TUITION',
        frequency: 'MONTHLY',
        amount: 2500,
        dueDate: '2026-02-01',
        lateFeePerDay: 10,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();

    createdFeeStructureId = response.body.data.id as string;
  });

  it('GET /fees/options returns fee assignment options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/fees/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(Array.isArray(response.body.data.students)).toBe(true);
  });

  it('GET /fees/structure returns paginated fee structures', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/fees/structure?page=1&limit=10&search=E2E Fee`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (structure: { id?: string }) => structure.id === createdFeeStructureId,
      ),
    ).toBe(true);
  });

  it('POST /fees/assign assigns fee to a student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/fees/assign`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sessionId: currentSessionId,
        studentId: attendanceStudentId,
        feeStructureId: createdFeeStructureId,
        totalAmount: 2500,
        concessionAmount: 500,
        dueDate: '2026-02-10',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.studentFeeId).toBeDefined();
    expect(response.body.data.dueAmount).toBe(2000);

    createdFeeAssignmentId = response.body.data.studentFeeId as string;
  });

  it('GET /fees/student/:studentId returns assigned fees', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/fees/student/${attendanceStudentId}?page=1&limit=10`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.student.id).toBe(attendanceStudentId);
    expect(
      response.body.data.some(
        (item: { studentFeeId?: string }) => item.studentFeeId === createdFeeAssignmentId,
      ),
    ).toBe(true);
  });

  it('POST /fees/payment records a payment', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/fees/payment`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentFeeId: createdFeeAssignmentId,
        amount: 1000,
        paymentDate: '2026-02-05',
        paymentMethod: 'CASH',
        reference: `E2E-PAY-${Date.now()}`,
        notes: 'First installment',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.studentFeeId).toBe(createdFeeAssignmentId);
    expect(response.body.data.amount).toBe(1000);
    expect(response.body.data.receiptNo).toBeDefined();
  });

  it('GET /fees/payments returns payment history', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/fees/payments?page=1&limit=10&studentId=${attendanceStudentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('GET /fees/student/:studentId blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/fees/student/${attendanceStudentId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('POST /parents creates a parent profile with portal access', async () => {
    createdParentEmail = `parent.${Date.now()}@school.com`;

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/parents`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: `E2E Parent ${Date.now()}`,
        phone: `93${Date.now().toString().slice(-8)}`,
        email: createdParentEmail,
        address: 'Lucknow, Uttar Pradesh',
        relationType: 'FATHER',
        emergencyContact: '+91-9000000000',
        portalPassword: '12345678',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.portalAccess.email).toBe(createdParentEmail);

    createdParentId = response.body.data.id as string;
    createdParentUserId = response.body.data.portalAccess.userId as string;
  });

  it('GET /parents lists parent records with search', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/parents?page=1&limit=10&search=${encodeURIComponent(createdParentEmail)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (parent: { id: string }) => parent.id === createdParentId,
      ),
    ).toBe(true);
  });

  it('GET /parents/:id returns a single parent profile', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parents/${createdParentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdParentId);
    expect(response.body.data.portalAccess.userId).toBe(createdParentUserId);
  });

  it('PATCH /parents/:id updates a parent profile', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/parents/${createdParentId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        fullName: 'Updated E2E Parent',
        phone: '9311111111',
        address: 'Updated Parent Address',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdParentId);
    expect(response.body.data.fullName).toBe('Updated E2E Parent');
    expect(response.body.data.phone).toBe('9311111111');
    expect(response.body.data.address).toBe('Updated Parent Address');
  });

  it('POST /parents/:id/link-student links a child to parent', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/parents/${createdParentId}/link-student`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: attendanceStudentId,
        relationType: 'FATHER',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
  });

  it('GET /parents/:id/students returns linked children', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parents/${createdParentId}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (student: { id: string }) => student.id === attendanceStudentId,
      ),
    ).toBe(true);
  });

  it('POST /parents/:id/link-student prevents duplicate linking', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/parents/${createdParentId}/link-student`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: attendanceStudentId,
        relationType: 'FATHER',
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Student is already linked to this parent.',
    );
  });

  it('GET /parents/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parents/${createdParentId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Parent not found.');
  });

  it('POST /auth/login logs in as parent', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send({
        email: createdParentEmail,
        password: '12345678',
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.user.role).toBe('PARENT');

    parentToken = response.body.accessToken as string;
  });

  it('GET /parent/dashboard returns linked children with fee and attendance summary', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/dashboard`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.parent.id).toBe(createdParentId);
    expect(response.body.data.children.length).toBeGreaterThan(0);

    const linkedChild = response.body.data.children.find(
      (child: { id: string }) => child.id === attendanceStudentId,
    );

    expect(linkedChild).toBeDefined();
    expect(linkedChild.feeSummary.totalAssigned).toBeGreaterThan(0);
    expect(linkedChild.attendanceSummary.totalDays).toBeGreaterThan(0);
  });

  it('GET /parent/dashboard rejects non-parent users', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/dashboard`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('POST /exams creates an exam', async () => {
    createdExamName = `E2E Exam ${Date.now()}`;
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/exams`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sessionId: currentSessionId,
        classId: createdClassId,
        examName: createdExamName,
        examType: 'UNIT',
        startDate: '2026-03-01',
        endDate: '2026-03-02',
        status: 'SCHEDULED',
        subjects: [
          {
            subjectId: createdSubjectId,
            examDate: '2026-03-01',
            maxMarks: 100,
            passMarks: 35,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();

    createdExamId = response.body.data.id as string;
  });

  it('GET /exams/options returns exam options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exams/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
    expect(Array.isArray(response.body.data.students)).toBe(true);
  });

  it('PATCH /exams/:id updates an exam', async () => {
    const updatedExamName = `Updated ${createdExamName}`;
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/exams/${createdExamId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        examName: updatedExamName,
        status: 'PUBLISHED',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdExamId);
    expect(response.body.data.examName).toBe(updatedExamName);
    expect(response.body.data.status).toBe('PUBLISHED');
  });

  it('GET /exams returns paginated exams', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/exams?page=1&limit=10&search=${encodeURIComponent(createdExamName)}`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some((exam: { id?: string }) => exam.id === createdExamId),
    ).toBe(true);
  });

  it('POST /exams/:id/marks enters marks', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/exams/${createdExamId}/marks`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        entries: [
          {
            studentId: attendanceStudentId,
            subjectId: createdSubjectId,
            marksObtained: 86,
            grade: 'A',
          },
          {
            studentId: attendanceBulkStudentId,
            subjectId: createdSubjectId,
            marksObtained: 72,
            grade: 'B+',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.entriesSaved).toBe(2);

    const createdMark = await prisma.mark.findFirst({
      where: {
        schoolId: defaultSchoolId,
        studentId: attendanceStudentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    createdExamMarkId = createdMark?.id ?? '';
  });

  it('PATCH /exams/:examId/marks/:markId updates a mark', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/exams/${createdExamId}/marks/${createdExamMarkId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        marksObtained: 91,
        grade: 'A+',
        remarks: 'Excellent improvement',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdExamMarkId);
  });

  it('GET /exams/:id/results returns exam results', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exams/${createdExamId}/results`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.exam.id).toBe(createdExamId);
    expect(response.body.data.results.length).toBeGreaterThan(0);
  });

  it('GET /students/:id/results returns student results', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${attendanceStudentId}/results`)
      .set('Authorization', `Bearer ${seededTeacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.results.length).toBeGreaterThan(0);
  });

  it('GET /exams/:id blocks cross-school exam access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exams/${createdExamId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /parent/attendance returns linked child attendance detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/attendance?studentId=${attendanceStudentId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.attendanceSummary.overall.totalDays).toBeGreaterThan(0);
  });

  it('GET /parent/fees returns linked child fee detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/fees?studentId=${attendanceStudentId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.feeSummary.overall.totalAssigned).toBeGreaterThan(0);
    expect(response.body.data.paymentHistory.length).toBeGreaterThan(0);
  });

  it('GET /parent/results returns linked child result detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/results?studentId=${attendanceStudentId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.resultSummary.overall.examCount).toBeGreaterThan(0);
  });

  it('GET /parent/attendance rejects unlinked student access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/attendance?studentId=${createdStudentId}`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(404);
  });

  it('POST /auth/login logs in as student portal user', async () => {
    studentPortalEmail = `student.portal.${Date.now()}@school.com`;

    const studentRole = await prisma.role.findFirstOrThrow({
      where: {
        roleCode: 'STUDENT',
      },
      select: {
        id: true,
      },
    });

    const passwordHash = await bcrypt.hash('12345678', 10);

    const portalUser = await prisma.user.create({
      data: {
        schoolId: defaultSchoolId,
        roleId: studentRole.id,
        fullName: 'Portal Student',
        email: studentPortalEmail,
        passwordHash,
        userType: UserType.ADMIN,
        designation: 'Student',
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    studentPortalUserId = portalUser.id;

    await prisma.student.update({
      where: {
        id: attendanceStudentId,
      },
      data: {
        userId: studentPortalUserId,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/auth/login`)
      .send({
        email: studentPortalEmail,
        password: '12345678',
      });

    expect([200, 201]).toContain(response.status);
    expect(response.body.user.role).toBe('STUDENT');

    studentPortalToken = response.body.accessToken as string;
  });

  it('GET /student/dashboard returns own profile summaries', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/dashboard`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.feeSummary.overall.totalAssigned).toBeGreaterThan(0);
    expect(response.body.data.attendanceSummary.overall.totalDays).toBeGreaterThan(0);
  });

  it('GET /student/attendance returns student attendance detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/attendance`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
  });

  it('GET /student/fees returns student fee detail and payment history', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/fees`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.paymentHistory.length).toBeGreaterThan(0);
  });

  it('GET /student/results returns student result detail', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/results`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.resultSummary.overall.examCount).toBeGreaterThan(0);
  });

  it('GET /student/dashboard rejects non-student users', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/dashboard`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('POST /timetables creates a timetable entry', async () => {
    const teacherRole = await prisma.role.findFirstOrThrow({
      where: {
        roleCode: 'TEACHER',
      },
      select: {
        id: true,
      },
    });

    const teacherUser = await prisma.user.create({
      data: {
        schoolId: defaultSchoolId,
        roleId: teacherRole.id,
        fullName: `Timetable Primary Teacher ${Date.now()}`,
        email: `timetable.primary.${Date.now()}@school.com`,
        passwordHash: await bcrypt.hash('12345678', 10),
        userType: UserType.TEACHER,
        designation: 'Teacher',
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    const teacherProfile = await prisma.teacher.create({
      data: {
        schoolId: defaultSchoolId,
        userId: teacherUser.id,
        employeeCode: `TT-${Date.now()}`,
        firstName: teacherUser.fullName.split(' ')[0] ?? 'Primary',
        lastName:
          teacherUser.fullName.split(' ').slice(1).join(' ') || 'Teacher',
        fullName: teacherUser.fullName,
        email: teacherUser.email,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    createdTimetableTeacherId = teacherProfile.id;

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/timetables`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        sectionId: createdSectionId,
        subjectId: createdSubjectId,
        teacherId: createdTimetableTeacherId,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '08:00',
        endTime: '08:45',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.class.id).toBe(createdClassId);
    expect(response.body.data.subject.id).toBe(createdSubjectId);

    createdTimetableEntryId = response.body.data.id as string;
  });

  it('POST /timetables rejects teacher conflict validation', async () => {
    const conflictClass = await prisma.academicClass.create({
      data: {
        schoolId: defaultSchoolId,
        classCode: `TT-CONFLICT-${Date.now()}`,
        className: `Teacher Conflict Class ${Date.now()}`,
        sortOrder: 998,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/timetables`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: conflictClass.id,
        subjectId: createdSubjectId,
        teacherId: createdTimetableTeacherId,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '08:00',
        endTime: '08:45',
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Teacher already assigned in this time slot');
  });

  it('GET /timetables returns timetable entries', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/timetables?page=1&limit=20`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (entry: { id: string }) => entry.id === createdTimetableEntryId,
      ),
    ).toBe(true);
  });

  it('GET /timetables/options returns timetable selectors', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/timetables/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
    expect(Array.isArray(response.body.data.teachers)).toBe(true);
  });

  it('GET /timetables/class/:classId returns class-wise timetable', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/timetables/class/${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(
      response.body.data.every(
        (entry: { class: { id: string } }) => entry.class.id === createdClassId,
      ),
    ).toBe(true);
  });

  it('POST /timetables rejects conflict validation', async () => {
    const teacherRole = await prisma.role.findFirstOrThrow({
      where: {
        roleCode: 'TEACHER',
      },
      select: {
        id: true,
      },
    });

    const secondTeacherUser = await prisma.user.create({
      data: {
        schoolId: defaultSchoolId,
        roleId: teacherRole.id,
        fullName: `Timetable Teacher ${Date.now()}`,
        email: `timetable.teacher.${Date.now()}@school.com`,
        passwordHash: await bcrypt.hash('12345678', 10),
        userType: UserType.TEACHER,
        designation: 'Teacher',
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    const secondTeacher = await prisma.teacher.create({
      data: {
        schoolId: defaultSchoolId,
        userId: secondTeacherUser.id,
        employeeCode: `TT2-${Date.now()}`,
        firstName: secondTeacherUser.fullName.split(' ')[0] ?? 'Time',
        lastName: secondTeacherUser.fullName.split(' ').slice(1).join(' ') || 'Teacher',
        fullName: secondTeacherUser.fullName,
        email: secondTeacherUser.email,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    createdSecondTimetableTeacherId = secondTeacher.id;

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/timetables`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        sectionId: createdSectionId,
        subjectId: createdSubjectId,
        teacherId: createdSecondTimetableTeacherId,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '08:15',
        endTime: '09:00',
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Class already has a subject in this period');
  });

  it('GET /timetables/class/:classId blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/timetables/class/${createdClassId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('PATCH /timetables/:id updates an existing timetable entry', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/timetables/${createdTimetableEntryId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        dayOfWeek: 'TUESDAY',
        periodNumber: 2,
        startTime: '09:00',
        endTime: '09:45',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdTimetableEntryId);
    expect(response.body.data.dayOfWeek).toBe('TUESDAY');
    expect(response.body.data.periodNumber).toBe(2);
  });

  it('POST /exam-date-sheets creates an exam date sheet', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/exam-date-sheets`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        examName: `Final Date Sheet ${Date.now()}`,
        entries: [
          {
            subjectId: createdSubjectId,
            examDate: '2026-03-15',
            startTime: '09:00',
            endTime: '12:00',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.class.id).toBe(createdClassId);
    expect(response.body.data.entries).toHaveLength(1);

    createdExamDateSheetId = response.body.data.id as string;
  });

  it('GET /exam-date-sheets/options returns date sheet creation options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exam-date-sheets/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
  });

  it('GET /exam-date-sheets fetches created exam date sheets', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exam-date-sheets?page=1&limit=20`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (sheet: { id: string }) => sheet.id === createdExamDateSheetId,
      ),
    ).toBe(true);
  });

  it('GET /exam-date-sheets/:id fetches a single exam date sheet', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exam-date-sheets/${createdExamDateSheetId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdExamDateSheetId);
    expect(response.body.data.entries[0].subject.id).toBe(createdSubjectId);
  });

  it('GET /exam-date-sheets/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exam-date-sheets/${createdExamDateSheetId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('PATCH /exam-date-sheets/:id/publish publishes a draft date sheet', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/exam-date-sheets/${createdExamDateSheetId}/publish`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdExamDateSheetId);
    expect(response.body.data.isPublished).toBe(true);
  });

  it('POST /notices creates a published students notice', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/notices`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        title: `Portal Notice ${Date.now()}`,
        description: 'This notice is visible to students.',
        audienceType: 'STUDENTS',
        isPublished: true,
        expiryDate: '2027-01-01',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.audienceType).toBe('STUDENTS');
    expect(response.body.data.isPublished).toBe(true);

    createdNoticeId = response.body.data.id as string;
  });

  it('PATCH /notices/:id updates a notice', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/notices/${createdNoticeId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        description: 'This notice is visible to students and was updated.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdNoticeId);
    expect(response.body.data.description).toContain('updated');
  });

  it('GET /notices filters by audience and published status', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/notices?page=1&limit=20&audienceType=STUDENTS&isPublished=true&search=Portal Notice`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (notice: { id?: string }) => notice.id === createdNoticeId,
      ),
    ).toBe(true);
  });

  it('GET /notices/:id returns a single notice', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/notices/${createdNoticeId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdNoticeId);
    expect(response.body.data.audienceType).toBe('STUDENTS');
  });

  it('GET /notices/:id blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/notices/${createdNoticeId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /notices/portal returns targeted notices for students', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/notices/portal`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (notice: { id?: string; audienceType?: string }) =>
          notice.id === createdNoticeId && notice.audienceType === 'STUDENTS',
      ),
    ).toBe(true);
  });

  it('GET /notices/portal hides student-only notices from parents', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/notices/portal`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (notice: { id?: string }) => notice.id === createdNoticeId,
      ),
    ).toBe(false);
  });

  it('POST /messages sends a message to a school user', async () => {
    const teacherUser = await prisma.user.findUniqueOrThrow({
      where: {
        email: teacherSeedAccount.email,
      },
      select: {
        id: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/messages`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        receiverId: teacherUser.id,
        subject: 'Exam coordination',
        message: 'Please review the published exam schedule.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.receiver.id).toBe(teacherUser.id);
    expect(response.body.data.isRead).toBe(false);

    createdMessageId = response.body.data.id as string;
  });

  it('GET /messages/recipients returns role-safe recipients', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/messages/recipients?role=TEACHER`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.every(
        (user: { roleType?: string }) => user.roleType === 'TEACHER',
      ),
    ).toBe(true);
  });

  it('GET /messages/inbox returns messages for the recipient', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/messages/inbox`)
      .set('Authorization', `Bearer ${seededTeacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (message: { id?: string }) => message.id === createdMessageId,
      ),
    ).toBe(true);
  });

  it('GET /messages/sent returns messages sent by the user', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/messages/sent`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (message: { id?: string }) => message.id === createdMessageId,
      ),
    ).toBe(true);
  });

  it('PATCH /messages/:id/read marks inbox messages as read', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/messages/${createdMessageId}/read`)
      .set('Authorization', `Bearer ${seededTeacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(createdMessageId);
    expect(response.body.data.isRead).toBe(true);
    expect(response.body.data.readAt).toBeTruthy();
  });

  it('POST /messages rejects cross-school recipients', async () => {
    const isolationUser = await prisma.user.findUniqueOrThrow({
      where: {
        email: schoolIsolationAdmin.email,
      },
      select: {
        id: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/messages`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        receiverId: isolationUser.id,
        subject: 'Should fail',
        message: 'Cross-school messaging must be blocked.',
      });

    expect(response.status).toBe(404);
  });

  it('GET /notifications returns targeted student notice notifications', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/notifications?page=1&limit=20`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.unreadCount).toBeGreaterThan(0);
    expect(
      response.body.data.some(
        (notification: { type?: string; title?: string }) =>
          notification.type === 'NOTICE' &&
          String(notification.title).includes('Portal Notice'),
      ),
    ).toBe(true);
  });

  it('PATCH /notifications/:id/read marks teacher notifications as read', async () => {
    const inbox = await request(app.getHttpServer())
      .get(`${apiPrefix}/notifications?page=1&limit=20`)
      .set('Authorization', `Bearer ${seededTeacherToken}`);

    expect(inbox.status).toBe(200);

    const notificationId = (
      inbox.body.data as Array<{ id: string; type?: string; isRead?: boolean }>
    ).find((item) => item.type === 'MESSAGE')?.id;

    expect(notificationId).toBeDefined();

    const response = await request(app.getHttpServer())
      .patch(`${apiPrefix}/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${seededTeacherToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(notificationId);
    expect(response.body.data.isRead).toBe(true);
  });

  it('POST /messages rejects invalid parent to admin messaging', async () => {
    const schoolAdminUser = await prisma.user.findUniqueOrThrow({
      where: {
        email: defaultSchoolAdmin.email,
      },
      select: {
        id: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/messages`)
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        receiverId: schoolAdminUser.id,
        subject: 'Disallowed route',
        message: 'Parents should not message school admin directly here.',
      });

    expect(response.status).toBe(403);
  });

  it('POST /homework creates a class homework item', async () => {
    const teacher = await prisma.teacher.findFirstOrThrow({
      where: {
        schoolId: defaultSchoolId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/homework`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: createdClassId,
        sectionId: createdSectionId,
        subjectId: createdSubjectId,
        teacherId: teacher.id,
        title: `Homework ${Date.now()}`,
        description: 'Complete the assigned worksheet before tomorrow.',
        dueDate: '2026-12-15',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.class.id).toBe(createdClassId);

    createdHomeworkId = response.body.data.id as string;
  });

  it('GET /homework/options returns homework creation options', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/homework/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.classes)).toBe(true);
    expect(Array.isArray(response.body.data.subjects)).toBe(true);
    expect(Array.isArray(response.body.data.teachers)).toBe(true);
  });

  it('GET /homework fetches homework records for the school', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/homework?page=1&limit=20`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (item: { id?: string }) => item.id === createdHomeworkId,
      ),
    ).toBe(true);
  });

  it('GET /homework/class/:classId returns class homework', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/homework/class/${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (item: { id?: string }) => item.id === createdHomeworkId,
      ),
    ).toBe(true);
  });

  it('GET /homework/class/:classId enforces school isolation', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/homework/class/${createdClassId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /reports returns attendance, fees, and result summaries', async () => {
    const [attendanceResponse, feesResponse, resultsResponse] = await Promise.all([
      request(app.getHttpServer())
        .get(`${apiPrefix}/reports/attendance?classId=${createdClassId}&sessionId=${currentSessionId}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`),
      request(app.getHttpServer())
        .get(`${apiPrefix}/reports/fees?classId=${createdClassId}&sessionId=${currentSessionId}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`),
      request(app.getHttpServer())
        .get(`${apiPrefix}/reports/results?classId=${createdClassId}&sessionId=${currentSessionId}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`),
    ]);

    expect(attendanceResponse.status).toBe(200);
    expect(attendanceResponse.body.success).toBe(true);
    expect(attendanceResponse.body.data.summary).toBeDefined();

    expect(feesResponse.status).toBe(200);
    expect(feesResponse.body.success).toBe(true);
    expect(feesResponse.body.data.summary).toBeDefined();

    expect(resultsResponse.status).toBe(200);
    expect(resultsResponse.body.success).toBe(true);
    expect(resultsResponse.body.data.summary).toBeDefined();
  });

  it('GET /reports/fees rejects cross-school scoped class access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/reports/fees?classId=${createdClassId}&sessionId=${currentSessionId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('POST /holidays creates a holiday calendar entry', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/holidays`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        title: `Winter Break ${Date.now()}`,
        startDate: '2026-12-24',
        endDate: '2026-12-31',
        type: 'HOLIDAY',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.type).toBe('HOLIDAY');

    createdHolidayId = response.body.data.id as string;
  });

  it('GET /holidays fetches school holiday entries only', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/holidays`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (item: { id?: string }) => item.id === createdHolidayId,
      ),
    ).toBe(true);
  });

  it('GET /parent/dashboard includes holidays for portal users', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/parent/dashboard`)
      .set('Authorization', `Bearer ${parentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.holidays)).toBe(true);
  });

  it('GET /student/dashboard includes homework and holidays for portal users', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/dashboard`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.homework)).toBe(true);
    expect(Array.isArray(response.body.data.holidays)).toBe(true);
  });

  it('GET /student/homework returns homework for the logged-in student', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/homework`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(
      response.body.data.homework.some(
        (item: { id?: string }) => item.id === createdHomeworkId,
      ),
    ).toBe(true);
  });

  it('GET /student/holidays returns holiday feed for the logged-in student', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/student/holidays`)
      .set('Authorization', `Bearer ${studentPortalToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(
      response.body.data.holidays.some(
        (item: { id?: string }) => item.id === createdHolidayId,
      ),
    ).toBe(true);
  });

  it('POST /classes creates a promotion target class', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/classes`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        className: `Promotion Target Class ${Date.now()}`,
        gradeLevel: 11,
        sortOrder: 30,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    promotionTargetClassId = response.body.data.id as string;
  });

  it('POST /sections creates a promotion target section', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/sections`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: promotionTargetClassId,
        sectionName: 'C',
        roomNo: '202',
        capacity: 42,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    promotionTargetSectionId = response.body.data.id as string;
  });

  it('POST /students creates a promotion candidate student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Promotion Student ${Date.now()}`,
        email: `promotion.${Date.now()}@school.com`,
        phone: '9000000200',
        gender: 'MALE',
        dateOfBirth: '2011-06-10',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    promotedStudentId = response.body.data.id as string;
  });

  it('POST /students creates a detention candidate student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Detention Student ${Date.now()}`,
        email: `detention.${Date.now()}@school.com`,
        phone: '9000000201',
        gender: 'FEMALE',
        dateOfBirth: '2011-07-18',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    detainedStudentId = response.body.data.id as string;
  });

  it('POST /students creates the first bulk promotion student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Bulk Promotion One ${Date.now()}`,
        email: `bulk.promotion.one.${Date.now()}@school.com`,
        phone: '9000000202',
        gender: 'MALE',
        dateOfBirth: '2011-08-20',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    bulkPromotionStudentOneId = response.body.data.id as string;
  });

  it('POST /students creates the second bulk promotion student', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/students`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: `Bulk Promotion Two ${Date.now()}`,
        email: `bulk.promotion.two.${Date.now()}@school.com`,
        phone: '9000000203',
        gender: 'FEMALE',
        dateOfBirth: '2011-09-11',
        classId: createdClassId,
        sectionId: createdSectionId,
        sessionId: currentSessionId,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    bulkPromotionStudentTwoId = response.body.data.id as string;
  });

  it('GET /promotions/options returns promotion selectors', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/promotions/options`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.currentSessionId).toBe(createdAcademicSessionId);
    expect(
      response.body.data.academicSessions.some(
        (session: { id?: string }) => session.id === currentSessionId,
      ),
    ).toBe(true);
    expect(
      response.body.data.classes.some(
        (academicClass: { id?: string }) => academicClass.id === promotionTargetClassId,
      ),
    ).toBe(true);
  });

  it('GET /promotions/eligible returns eligible students for a source class and session', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/promotions/eligible?page=1&limit=10&fromAcademicSessionId=${currentSessionId}&fromClassId=${createdClassId}&fromSectionId=${createdSectionId}&search=Promotion`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (student: { id?: string }) => student.id === promotedStudentId,
      ),
    ).toBe(true);
  });

  it('POST /promotions/preview returns valid students before promotion confirmation', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/preview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [promotedStudentId, bulkPromotionStudentOneId],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toMatchObject({
      total: 2,
      valid: 2,
      skipped: 0,
      errors: 0,
    });
    expect(
      response.body.data.items.every(
        (item: { status?: string }) => item.status === 'VALID',
      ),
    ).toBe(true);
  });

  it('POST /promotions/preview marks invalid students safely without leaking data', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/preview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [bulkPromotionStudentOneId, '11111111-1111-4111-8111-111111111111'],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toMatchObject({
      total: 2,
      valid: 1,
      errors: 1,
    });
    expect(
      response.body.data.items.some(
        (item: { status?: string; student?: { id?: string } | null }) =>
          item.status === 'INVALID_DATA' &&
          item.student === null,
      ),
    ).toBe(true);
  });

  it('POST /promotions promotes a single student and creates target enrollment history', async () => {
    const sourceEnrollment = await prisma.admission.findFirst({
      where: {
        schoolId: defaultSchoolId,
        studentId: promotedStudentId,
        sessionId: currentSessionId,
        classId: createdClassId,
        sectionId: createdSectionId,
        admissionStatus: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    expect(sourceEnrollment?.id).toBeDefined();

    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: promotedStudentId,
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        fromEnrollmentId: sourceEnrollment?.id,
        action: 'PROMOTED',
        remarks: 'Promoted to the next grade.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(promotedStudentId);
    expect(response.body.data.action).toBe('PROMOTED');
    expect(response.body.data.toAcademicSession.id).toBe(createdAcademicSessionId);
    expect(response.body.data.toClass.id).toBe(promotionTargetClassId);

    const [targetEnrollment, sourceAdmission, promotionHistory] = await Promise.all([
      prisma.admission.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: promotedStudentId,
          sessionId: createdAcademicSessionId,
        },
      }),
      prisma.admission.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: promotedStudentId,
          sessionId: currentSessionId,
        },
      }),
      prisma.promotionHistory.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: promotedStudentId,
          toAcademicSessionId: createdAcademicSessionId,
        },
      }),
    ]);

    expect(targetEnrollment?.classId).toBe(promotionTargetClassId);
    expect(targetEnrollment?.sectionId).toBe(promotionTargetSectionId);
    expect(sourceAdmission?.admissionStatus).toBe('PROMOTED');
    expect(promotionHistory?.action).toBe('PROMOTED');
  });

  it('POST /promotions/preview marks already promoted students as skipped', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/preview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [promotedStudentId],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toMatchObject({
      total: 1,
      valid: 0,
      skipped: 1,
      errors: 0,
    });
    expect(response.body.data.items[0]).toMatchObject({
      status: 'ALREADY_PROMOTED',
    });
  });

  it('POST /promotions supports detained action and preserves class in next session', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: detainedStudentId,
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: createdClassId,
        fromSectionId: createdSectionId,
        toSectionId: createdSectionId,
        action: 'DETAINED',
        remarks: 'Needs to repeat the class.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(detainedStudentId);
    expect(response.body.data.action).toBe('DETAINED');
    expect(response.body.data.toClass.id).toBe(createdClassId);

    const [targetEnrollment, sourceAdmission, promotionHistory] = await Promise.all([
      prisma.admission.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: detainedStudentId,
          sessionId: createdAcademicSessionId,
        },
      }),
      prisma.admission.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: detainedStudentId,
          sessionId: currentSessionId,
        },
      }),
      prisma.promotionHistory.findFirst({
        where: {
          schoolId: defaultSchoolId,
          studentId: detainedStudentId,
          toAcademicSessionId: createdAcademicSessionId,
        },
      }),
    ]);

    expect(targetEnrollment?.classId).toBe(createdClassId);
    expect(targetEnrollment?.sectionId).toBe(createdSectionId);
    expect(sourceAdmission?.admissionStatus).toBe('COMPLETED');
    expect(promotionHistory?.action).toBe('DETAINED');
  });

  it('POST /promotions rejects duplicate target enrollment for the same target session', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: promotedStudentId,
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(409);
  });

  it('POST /promotions rejects invalid target class and section combinations', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: bulkPromotionStudentOneId,
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: createdSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(400);

    const invalidTargetEnrollment = await prisma.admission.findFirst({
      where: {
        schoolId: defaultSchoolId,
        studentId: bulkPromotionStudentOneId,
        sessionId: createdAcademicSessionId,
      },
    });

    expect(invalidTargetEnrollment).toBeNull();
  });

  it('POST /promotions/preview rejects invalid target class and section combinations', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/preview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [bulkPromotionStudentOneId],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: createdSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(400);
  });

  it('POST /promotions rejects cross-school references', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentId: bulkPromotionStudentOneId,
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: otherSchoolAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: otherSchoolClassId,
        fromSectionId: createdSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(404);
  });

  it('POST /promotions/preview rejects cross-school references', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/preview`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [bulkPromotionStudentOneId],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: otherSchoolAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: otherSchoolClassId,
        fromSectionId: createdSectionId,
        action: 'PROMOTED',
      });

    expect(response.status).toBe(404);
  });

  it('POST /promotions/bulk promotes multiple students with structured summary', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/promotions/bulk`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        studentIds: [bulkPromotionStudentOneId, bulkPromotionStudentTwoId],
        fromAcademicSessionId: currentSessionId,
        toAcademicSessionId: createdAcademicSessionId,
        fromClassId: createdClassId,
        toClassId: promotionTargetClassId,
        fromSectionId: createdSectionId,
        toSectionId: promotionTargetSectionId,
        action: 'PROMOTED',
        remarks: 'Bulk promoted to the next grade.',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      total: 2,
      promoted: 2,
      failed: 0,
    });
    expect(response.body.data.successes).toHaveLength(2);

    const targetEnrollments = await prisma.admission.findMany({
      where: {
        schoolId: defaultSchoolId,
        studentId: {
          in: [bulkPromotionStudentOneId, bulkPromotionStudentTwoId],
        },
        sessionId: createdAcademicSessionId,
      },
      select: {
        studentId: true,
      },
    });

    expect(targetEnrollments).toHaveLength(2);
  });

  it('GET /promotions returns paginated promotion history with filters', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/promotions?page=1&limit=10&toAcademicSessionId=${createdAcademicSessionId}&fromClassId=${createdClassId}&action=PROMOTED&search=Promotion`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      response.body.data.some(
        (record: { student?: { id?: string } }) =>
          record.student?.id === promotedStudentId,
      ),
    ).toBe(true);
  });

  it('GET /promotions/student/:studentId returns ordered promotion history for a student', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/promotions/student/${promotedStudentId}?page=1&limit=10`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(response.body.data[0].student.id).toBe(promotedStudentId);
  });

  it('GET /promotions/class/:classId returns class promotion history', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `${apiPrefix}/promotions/class/${promotionTargetClassId}?page=1&limit=10&action=PROMOTED`,
      )
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(
      response.body.data.every(
        (record: { toClass?: { id?: string }; fromClass?: { id?: string } }) =>
          record.toClass?.id === promotionTargetClassId ||
          record.fromClass?.id === promotionTargetClassId,
      ),
    ).toBe(true);
    if (response.body.data.length > 1) {
      expect(
        new Date(response.body.data[0].promotedAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(response.body.data[1].promotedAt).getTime(),
      );
    }
  });

  it('GET /students/:id/history returns aggregated student history', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${attendanceStudentId}/history`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(attendanceStudentId);
    expect(response.body.data.student.registrationNumber).toBeTruthy();
    expect(response.body.data.enrollmentHistory.length).toBeGreaterThan(0);
    expect(response.body.data.attendanceSummary.overall.totalDays).toBeGreaterThan(0);
    expect(response.body.data.feeSummary.overall.totalAssigned).toBeGreaterThan(0);
    expect(response.body.data.resultSummary.overall.examCount).toBeGreaterThan(0);
    expect(Array.isArray(response.body.data.promotionHistory)).toBe(true);
  });

  it('GET /students/:id/history includes preserved promotion and enrollment history', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${promotedStudentId}/history`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.student.id).toBe(promotedStudentId);
    expect(response.body.data.enrollmentHistory.length).toBeGreaterThanOrEqual(2);
    const enrollmentSessionIds = response.body.data.enrollmentHistory.map(
      (item: { session: { id: string } }) => item.session.id,
    );

    expect(enrollmentSessionIds).toContain(currentSessionId);
    expect(enrollmentSessionIds).toContain(createdAcademicSessionId);
    expect(response.body.data.promotionHistory.length).toBeGreaterThan(0);
    expect(response.body.data.promotionHistory[0].toAcademicSession.id).toBe(
      createdAcademicSessionId,
    );
  });

  it('GET /promotions/student/:studentId blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/promotions/student/${promotedStudentId}?page=1&limit=10`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /students/:id/history blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/${attendanceStudentId}/history`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect([403, 404]).toContain(response.status);
  });

  it('GET /students/:id/history returns not found for invalid student', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/students/00000000-0000-0000-0000-000000000000/history`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /promotions/class/:classId blocks cross-school access', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/promotions/class/${promotionTargetClassId}?page=1&limit=10`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(404);
  });

  it('GET /promotions blocks cross-school schoolId override for school admins', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/promotions?page=1&limit=10&schoolId=${defaultSchoolId}`)
      .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

    expect(response.status).toBe(403);
  });

  it('POST /exams creates a temporary exam for delete coverage', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/exams`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sessionId: currentSessionId,
        classId: createdClassId,
        examName: `Delete Exam ${Date.now()}`,
        examType: 'UNIT',
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        status: 'DRAFT',
        subjects: [
          {
            subjectId: createdSubjectId,
            examDate: '2026-04-01',
            maxMarks: 50,
            passMarks: 20,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    createdTemporaryExamId = response.body.data.id as string;
  });

  it('DELETE /exams/:id deletes an exam', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/exams/${createdTemporaryExamId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdTemporaryExamId,
      deleted: true,
    });

    createdTemporaryExamId = '';
  });

  it('DELETE /timetables/:id deletes a timetable entry', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/timetables/${createdTimetableEntryId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdTimetableEntryId,
      deleted: true,
    });

    createdTimetableEntryId = '';
  });

  it('DELETE /attendance/:id deletes an attendance record', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/attendance/${attendanceRecordId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: attendanceRecordId,
      deleted: true,
    });

    attendanceRecordId = '';
  });

  it('DELETE /sections/:id soft deletes a section', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/sections/${createdSectionId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdSectionId,
      deleted: true,
    });
  });

  it('DELETE /subjects/:id soft deletes a subject', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/subjects/${createdSubjectId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdSubjectId,
      deleted: true,
    });
  });

  it('DELETE /classes/:id soft deletes a class', async () => {
    const response = await request(app.getHttpServer())
      .delete(`${apiPrefix}/classes/${createdClassId}`)
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      id: createdClassId,
      deleted: true,
    });
  });

  async function ensureSchoolAdminAccess() {
    const schoolAdminRole = await prisma.role.findFirst({
      where: {
        roleCode: 'SCHOOL_ADMIN',
      },
    });

    if (!schoolAdminRole) {
      throw new Error('SCHOOL_ADMIN role not found.');
    }

    const requiredPermissions = [
      {
        permissionCode: 'school.settings.manage',
        permissionName: 'Manage School Settings',
        actionKey: 'MANAGE',
        description: 'Manage school users and settings',
      },
      {
        permissionCode: 'students.read',
        permissionName: 'Read Students',
        actionKey: 'READ',
        description: 'View student records',
      },
      {
        permissionCode: 'students.manage',
        permissionName: 'Manage Students',
        actionKey: 'MANAGE',
        description: 'Create and update student records',
      },
      {
        permissionCode: 'academics.read',
        permissionName: 'Read Academic Structure',
        actionKey: 'READ',
        description: 'View classes, sections, and subjects',
      },
      {
        permissionCode: 'academics.manage',
        permissionName: 'Manage Academic Structure',
        actionKey: 'MANAGE',
        description: 'Create and update classes, sections, and subjects',
      },
      {
        permissionCode: 'attendance.read',
        permissionName: 'Read Attendance',
        actionKey: 'READ',
        description: 'View attendance records and summaries',
      },
      {
        permissionCode: 'attendance.manage',
        permissionName: 'Manage Attendance',
        actionKey: 'MANAGE',
        description: 'Mark and update attendance records',
      },
    ];

    for (const permissionSeed of requiredPermissions) {
      const permission = await prisma.permission.upsert({
        where: {
          permissionCode: permissionSeed.permissionCode,
        },
        update: {
          permissionName: permissionSeed.permissionName,
          actionKey: permissionSeed.actionKey,
          description: permissionSeed.description,
          isActive: true,
        },
        create: {
          permissionCode: permissionSeed.permissionCode,
          permissionName: permissionSeed.permissionName,
          actionKey: permissionSeed.actionKey,
          description: permissionSeed.description,
          isActive: true,
        },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: schoolAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: schoolAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  async function ensureIsolationSchoolAdmin() {
    const school = await prisma.school.upsert({
      where: {
        schoolCode: 'e2e-isolation-school',
      },
      update: {
        name: 'E2E Isolation School',
        subdomain: 'e2e-isolation-school',
        email: 'e2e-isolation@school.com',
        phone: '+91-9000000000',
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
      create: {
        schoolCode: 'e2e-isolation-school',
        name: 'E2E Isolation School',
        subdomain: 'e2e-isolation-school',
        email: 'e2e-isolation@school.com',
        phone: '+91-9000000000',
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
    });

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startYear = now.getUTCMonth() >= 3 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;

    await prisma.academicSession.upsert({
      where: {
        schoolId_sessionName: {
          schoolId: school.id,
          sessionName: `${startYear}-${endYear}`,
        },
      },
      update: {
        startDate: new Date(`${startYear}-04-01`),
        endDate: new Date(`${endYear}-03-31`),
        isCurrent: true,
        isActive: true,
      },
      create: {
        schoolId: school.id,
        sessionName: `${startYear}-${endYear}`,
        startDate: new Date(`${startYear}-04-01`),
        endDate: new Date(`${endYear}-03-31`),
        isCurrent: true,
        isActive: true,
      },
    });

    const schoolAdminRole = await prisma.role.findFirst({
      where: {
        roleCode: 'SCHOOL_ADMIN',
      },
    });

    if (!schoolAdminRole) {
      throw new Error('SCHOOL_ADMIN role not found.');
    }

    const passwordHash = await bcrypt.hash(schoolIsolationAdmin.password, 10);

    await prisma.user.upsert({
      where: {
        email: schoolIsolationAdmin.email,
      },
      update: {
        fullName: 'E2E Isolation Admin',
        passwordHash,
        roleId: schoolAdminRole.id,
        schoolId: school.id,
        userType: UserType.ADMIN,
        designation: 'School Administrator',
        isActive: true,
      },
      create: {
        fullName: 'E2E Isolation Admin',
        email: schoolIsolationAdmin.email,
        passwordHash,
        roleId: schoolAdminRole.id,
        schoolId: school.id,
        userType: UserType.ADMIN,
        designation: 'School Administrator',
        isActive: true,
      },
    });
  }
});
