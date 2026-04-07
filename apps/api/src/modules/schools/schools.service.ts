import { ConflictException, Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';

const GLOBAL_SCOPE_KEY = 'GLOBAL';

@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const created = await this.prisma.$transaction(async (tx) => {
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
    });

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
}
