import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, RoleType, UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateSchoolDto } from './dto/create-school.dto';
import { SchoolQueryDto } from './dto/school-query.dto';

const GLOBAL_SCOPE_KEY = 'GLOBAL';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const schoolListInclude = Prisma.validator<Prisma.SchoolInclude>()({
  users: {
    where: {
      role: {
        roleType: RoleType.SCHOOL_ADMIN,
      },
    },
    include: {
      role: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 1,
  },
});

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtUser, query: SchoolQueryDto) {
    if (currentUser.role !== RoleType.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can manage schools.');
    }

    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const where: Prisma.SchoolWhereInput = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              schoolCode: {
                contains: search.toLowerCase(),
                mode: 'insensitive',
              },
            },
            {
              subdomain: {
                contains: search.toLowerCase(),
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        include: schoolListInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.school.count({ where }),
    ]);

    return {
      success: true,
      message: 'Schools fetched successfully.',
      data: schools.map((school) => this.toSchoolRecord(school)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async createSchool(dto: CreateSchoolDto) {
    const schoolCode = dto.code.toLowerCase();
    const adminEmail = dto.adminEmail.toLowerCase();

    const [existingSchool, existingUser] = await Promise.all([
      this.prisma.school.findFirst({
        where: {
          OR: [{ schoolCode }, { subdomain: schoolCode }],
        },
      }),
      this.prisma.user.findUnique({ where: { email: adminEmail } }),
    ]);

    if (existingSchool) {
      throw new ConflictException('School code is already in use.');
    }

    if (existingUser) {
      throw new ConflictException('Admin email is already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const schoolAdminRole = await tx.role.findUnique({
          where: {
            scopeKey_roleCode: {
              scopeKey: GLOBAL_SCOPE_KEY,
              roleCode: 'SCHOOL_ADMIN',
            },
          },
        });

        if (!schoolAdminRole) {
          throw new ConflictException(
            'Seed roles are missing. Run the Prisma seed script first.',
          );
        }

        const school = await tx.school.create({
          data: {
            name: dto.name,
            schoolCode,
            subdomain: schoolCode,
          },
        });

        const adminUser = await tx.user.create({
          data: {
            fullName: dto.adminName,
            email: adminEmail,
            passwordHash: hashedPassword,
            roleId: schoolAdminRole.id,
            schoolId: school.id,
            userType: UserType.ADMIN,
            designation: 'School Administrator',
          },
          include: {
            role: true,
          },
        });

        const coreModules = await tx.module.findMany({
          where: {
            isCore: true,
            isActive: true,
          },
        });

        if (coreModules.length > 0) {
          await tx.schoolModule.createMany({
            data: coreModules.map((module) => ({
              schoolId: school.id,
              moduleId: module.id,
              enabled: true,
              enabledAt: new Date(),
            })),
          });
        }

        return { school, adminUser };
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );

    return {
      school: created.school,
      adminUser: {
        id: created.adminUser.id,
        name: created.adminUser.fullName,
        email: created.adminUser.email,
        role: created.adminUser.role.roleType,
        roleCode: created.adminUser.role.roleCode,
        schoolId: created.adminUser.schoolId,
        createdAt: created.adminUser.createdAt,
        updatedAt: created.adminUser.updatedAt,
        isActive: created.adminUser.isActive,
      },
    };
  }

  private toSchoolRecord(
    school: Prisma.SchoolGetPayload<{ include: typeof schoolListInclude }>,
  ) {
    const [adminUser] = school.users;

    return {
      id: school.id,
      name: school.name,
      schoolCode: school.schoolCode,
      subdomain: school.subdomain,
      email: school.email,
      phone: school.phone,
      timezone: school.timezone,
      isActive: school.isActive,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt,
      adminUser: adminUser
        ? {
            id: adminUser.id,
            name: adminUser.fullName,
            email: adminUser.email,
            role: adminUser.role.roleType,
            roleCode: adminUser.role.roleCode,
            schoolId: adminUser.schoolId,
            createdAt: adminUser.createdAt,
            updatedAt: adminUser.updatedAt,
            isActive: adminUser.isActive,
          }
        : null,
    };
  }
}
