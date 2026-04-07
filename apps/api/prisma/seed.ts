import { PrismaClient, RoleType, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const GLOBAL_SCOPE_KEY = 'GLOBAL';
const SALT_ROUNDS = 10;

const schoolData = {
  schoolCode: 'demo-school',
  name: 'Demo School',
  subdomain: 'demo-school',
  email: 'info@school.com',
  phone: '+91-9999999999',
  timezone: 'Asia/Kolkata',
  addressJson: {
    line1: 'Demo Campus',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    country: 'India',
    postalCode: '226001',
  },
  settingsJson: {
    currency: 'INR',
    locale: 'en-IN',
  },
};

const roles = [
  {
    roleCode: 'SUPER_ADMIN',
    roleName: 'Super Admin',
    roleType: RoleType.SUPER_ADMIN,
    description: 'Platform administrator',
  },
  {
    roleCode: 'SCHOOL_ADMIN',
    roleName: 'School Admin',
    roleType: RoleType.SCHOOL_ADMIN,
    description: 'School administrator',
  },
  {
    roleCode: 'TEACHER',
    roleName: 'Teacher',
    roleType: RoleType.TEACHER,
    description: 'Teacher role',
  },
  {
    roleCode: 'STUDENT',
    roleName: 'Student',
    roleType: RoleType.STUDENT,
    description: 'Student role',
  },
  {
    roleCode: 'PARENT',
    roleName: 'Parent',
    roleType: RoleType.PARENT,
    description: 'Parent role',
  },
  {
    roleCode: 'STAFF',
    roleName: 'Staff',
    roleType: RoleType.STAFF,
    description: 'Non-teaching staff role',
  },
] as const;

const permissions = [
  {
    permissionCode: 'school.settings.manage',
    permissionName: 'Manage School Settings',
    actionKey: 'MANAGE',
    description: 'Manage school users and settings',
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
    permissionCode: 'fees.read',
    permissionName: 'Read Fees',
    actionKey: 'READ',
    description: 'View fee structures, assignments, and payments',
  },
  {
    permissionCode: 'fees.manage',
    permissionName: 'Manage Fees',
    actionKey: 'MANAGE',
    description: 'Create fee structures, assign fees, and record payments',
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
  {
    permissionCode: 'exams.read',
    permissionName: 'Read Exams',
    actionKey: 'READ',
    description: 'View exams, marks, and results',
  },
  {
    permissionCode: 'exams.manage',
    permissionName: 'Manage Exams',
    actionKey: 'MANAGE',
    description: 'Create exams and enter marks',
  },
] as const;

const superAdminUser = {
  fullName: 'Super Admin',
  email: 'admin@school.com',
  password: '12345678',
};

const schoolAdminUser = {
  fullName: 'School Admin',
  email: 'schooladmin@school.com',
  password: '12345678',
};

const teacherUser = {
  fullName: 'Demo Teacher',
  email: 'teacher@school.com',
  password: '12345678',
};

const staffUser = {
  fullName: 'Demo Staff',
  email: 'staff@school.com',
  password: '12345678',
};

async function seedSchool() {
  return prisma.school.upsert({
    where: {
      schoolCode: schoolData.schoolCode,
    },
    update: {
      name: schoolData.name,
      subdomain: schoolData.subdomain,
      email: schoolData.email,
      phone: schoolData.phone,
      timezone: schoolData.timezone,
      addressJson: schoolData.addressJson,
      settingsJson: schoolData.settingsJson,
      isActive: true,
    },
    create: {
      schoolCode: schoolData.schoolCode,
      name: schoolData.name,
      subdomain: schoolData.subdomain,
      email: schoolData.email,
      phone: schoolData.phone,
      timezone: schoolData.timezone,
      addressJson: schoolData.addressJson,
      settingsJson: schoolData.settingsJson,
      isActive: true,
    },
  });
}

async function seedRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: role.roleCode,
        },
      },
      update: {
        roleName: role.roleName,
        roleType: role.roleType,
        description: role.description,
        isSystem: true,
        isActive: true,
      },
      create: {
        scopeKey: GLOBAL_SCOPE_KEY,
        roleCode: role.roleCode,
        roleName: role.roleName,
        roleType: role.roleType,
        description: role.description,
        isSystem: true,
        isActive: true,
      },
    });
  }
}

async function seedPermissions() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        permissionCode: permission.permissionCode,
      },
      update: {
        permissionName: permission.permissionName,
        actionKey: permission.actionKey,
        description: permission.description,
        isActive: true,
      },
      create: {
        permissionCode: permission.permissionCode,
        permissionName: permission.permissionName,
        actionKey: permission.actionKey,
        description: permission.description,
        isActive: true,
      },
    });
  }

  const [superAdminRole, schoolAdminRole, teacherRole] = await Promise.all([
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'SUPER_ADMIN',
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'SCHOOL_ADMIN',
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'TEACHER',
        },
      },
    }),
  ]);

  if (!superAdminRole || !schoolAdminRole || !teacherRole) {
    throw new Error('Required roles not found. Seed roles first.');
  }

  const permissionRecords = await prisma.permission.findMany({
    where: {
      permissionCode: {
        in: permissions.map((permission) => permission.permissionCode),
      },
    },
  });

  for (const permission of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
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

    if (
      permission.permissionCode === 'attendance.read' ||
      permission.permissionCode === 'attendance.manage' ||
      permission.permissionCode === 'exams.read' ||
      permission.permissionCode === 'exams.manage'
    ) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: teacherRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: teacherRole.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedUsers(schoolId: string) {
  const [superAdminRole, schoolAdminRole, teacherRole, staffRole] = await Promise.all([
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'SUPER_ADMIN',
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'SCHOOL_ADMIN',
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'TEACHER',
        },
      },
    }),
    prisma.role.findUnique({
      where: {
        scopeKey_roleCode: {
          scopeKey: GLOBAL_SCOPE_KEY,
          roleCode: 'STAFF',
        },
      },
    }),
  ]);

  if (!superAdminRole || !schoolAdminRole || !teacherRole || !staffRole) {
    throw new Error('Required roles not found. Seed roles first.');
  }

  const [
    superAdminPasswordHash,
    schoolAdminPasswordHash,
    teacherPasswordHash,
    staffPasswordHash,
  ] = await Promise.all([
    bcrypt.hash(superAdminUser.password, SALT_ROUNDS),
    bcrypt.hash(schoolAdminUser.password, SALT_ROUNDS),
    bcrypt.hash(teacherUser.password, SALT_ROUNDS),
    bcrypt.hash(staffUser.password, SALT_ROUNDS),
  ]);

  await prisma.user.upsert({
    where: {
      email: superAdminUser.email,
    },
    update: {
      fullName: superAdminUser.fullName,
      passwordHash: superAdminPasswordHash,
      roleId: superAdminRole.id,
      schoolId: null,
      userType: UserType.ADMIN,
      designation: 'Platform Administrator',
      isActive: true,
    },
    create: {
      fullName: superAdminUser.fullName,
      email: superAdminUser.email,
      passwordHash: superAdminPasswordHash,
      roleId: superAdminRole.id,
      schoolId: null,
      userType: UserType.ADMIN,
      designation: 'Platform Administrator',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      email: schoolAdminUser.email,
    },
    update: {
      fullName: schoolAdminUser.fullName,
      passwordHash: schoolAdminPasswordHash,
      roleId: schoolAdminRole.id,
      schoolId,
      userType: UserType.ADMIN,
      designation: 'School Administrator',
      isActive: true,
    },
    create: {
      fullName: schoolAdminUser.fullName,
      email: schoolAdminUser.email,
      passwordHash: schoolAdminPasswordHash,
      roleId: schoolAdminRole.id,
      schoolId,
      userType: UserType.ADMIN,
      designation: 'School Administrator',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      email: teacherUser.email,
    },
    update: {
      fullName: teacherUser.fullName,
      passwordHash: teacherPasswordHash,
      roleId: teacherRole.id,
      schoolId,
      userType: UserType.TEACHER,
      designation: 'Teacher',
      isActive: true,
    },
    create: {
      fullName: teacherUser.fullName,
      email: teacherUser.email,
      passwordHash: teacherPasswordHash,
      roleId: teacherRole.id,
      schoolId,
      userType: UserType.TEACHER,
      designation: 'Teacher',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      email: staffUser.email,
    },
    update: {
      fullName: staffUser.fullName,
      passwordHash: staffPasswordHash,
      roleId: staffRole.id,
      schoolId,
      userType: UserType.STAFF,
      designation: 'Staff',
      isActive: true,
    },
    create: {
      fullName: staffUser.fullName,
      email: staffUser.email,
      passwordHash: staffPasswordHash,
      roleId: staffRole.id,
      schoolId,
      userType: UserType.STAFF,
      designation: 'Staff',
      isActive: true,
    },
  });
}

async function seedAcademicSession(schoolId: string) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 3 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  await prisma.academicSession.upsert({
    where: {
      schoolId_sessionName: {
        schoolId,
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
      schoolId,
      sessionName: `${startYear}-${endYear}`,
      startDate: new Date(`${startYear}-04-01`),
      endDate: new Date(`${endYear}-03-31`),
      isCurrent: true,
      isActive: true,
    },
  });

  await prisma.academicSession.updateMany({
    where: {
      schoolId,
      sessionName: {
        not: `${startYear}-${endYear}`,
      },
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });
}

async function main() {
  const school = await seedSchool();
  await seedRoles();
  await seedPermissions();
  await seedAcademicSession(school.id);
  await seedUsers(school.id);

  console.log('Seed completed successfully.');
  console.log(`Super Admin: ${superAdminUser.email} / ${superAdminUser.password}`);
  console.log(`School Admin: ${schoolAdminUser.email} / ${schoolAdminUser.password}`);
  console.log(`Teacher: ${teacherUser.email} / ${teacherUser.password}`);
  console.log(`Staff: ${staffUser.email} / ${staffUser.password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
