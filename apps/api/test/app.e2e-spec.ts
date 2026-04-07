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
  let createdTeacherUserId = '';
  let createdStaffUserId = '';
  let createdClassId = '';
  let createdSectionId = '';
  let createdSubjectId = '';
  let createdFeeStructureId = '';
  let createdFeeAssignmentId = '';
  let createdExamId = '';
  let attendanceStudentId = '';
  let attendanceBulkStudentId = '';
  let attendanceRecordId = '';
  let otherSchoolClassId = '';
  let currentSessionId = '';
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

    const currentSession = await prisma.academicSession.findFirst({
      where: {
        school: {
          schoolCode: 'demo-school',
        },
        isCurrent: true,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    currentSessionId = currentSession?.id ?? '';

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
  });

  afterAll(async () => {
    if (createdStudentId) {
      await prisma.student.updateMany({
        where: {
          id: createdStudentId,
        },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    if (attendanceStudentId) {
      await prisma.student.updateMany({
        where: {
          id: attendanceStudentId,
        },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    if (attendanceBulkStudentId) {
      await prisma.student.updateMany({
        where: {
          id: attendanceBulkStudentId,
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

    createdStudentId = response.body.data.id as string;
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
    expect(response.body.data.totals.students).toBeGreaterThanOrEqual(2);
    expect(response.body.data.totals.classes).toBeGreaterThanOrEqual(1);
    expect(response.body.data.totals.subjects).toBeGreaterThanOrEqual(1);
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

  it('POST /exams creates an exam', async () => {
    const response = await request(app.getHttpServer())
      .post(`${apiPrefix}/exams`)
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        sessionId: currentSessionId,
        classId: createdClassId,
        examName: `E2E Exam ${Date.now()}`,
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

  it('GET /exams returns paginated exams', async () => {
    const response = await request(app.getHttpServer())
      .get(`${apiPrefix}/exams?page=1&limit=10&search=E2E Exam`)
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
