import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RoleType,
  TeacherStatus,
  UserType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserQueryDto } from './dto/user-query.dto';

const GLOBAL_SCOPE_KEY = 'GLOBAL';
const USER_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MANAGEABLE_ROLE_TYPES = [
  RoleType.SUPER_ADMIN,
  RoleType.SCHOOL_ADMIN,
  RoleType.TEACHER,
  RoleType.STAFF,
] as const;

const userDetailsInclude = Prisma.validator<Prisma.UserInclude>()({
  role: {
    include: {
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  teacherProfile: true,
});

export type UserWithRole = Prisma.UserGetPayload<{
  include: typeof userDetailsInclude;
}>;

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: RoleType;
  roleCode: string;
  userType: UserType;
  designation: string | null;
  schoolId: string | null;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateUserDto) {
    const normalizedEmail = dto.email.toLowerCase();
    await this.ensureUniqueEmail(normalizedEmail);

    const requestedSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? dto.schoolId ?? currentUser.schoolId ?? null
        : currentUser.schoolId ?? null;
    const role = await this.resolveRoleForUser(dto.role, requestedSchoolId);

    this.assertRoleAssignmentAllowed(currentUser, role.roleType);

    const schoolId = this.resolveSchoolIdForRole(
      currentUser,
      role.roleType,
      requestedSchoolId,
    );
    const userType = this.resolveUserType(role.roleType, dto.userType);
    const fullName = dto.fullName.trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          schoolId,
          roleId: role.id,
          fullName,
          email: normalizedEmail,
          passwordHash,
          phone: dto.phone ?? null,
          userType,
          designation: dto.designation ?? null,
          isActive: dto.isActive ?? true,
          passwordChangedAt: new Date(),
        },
      });

      await this.syncTeacherProfile(tx, {
        userId: createdUser.id,
        schoolId,
        fullName,
        email: normalizedEmail,
        phone: dto.phone ?? null,
        designation: dto.designation ?? null,
        userType,
        isActive: createdUser.isActive,
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: userDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    await this.invalidateUserCache();
    await this.auditService.write({
      action: 'users.create',
      entity: 'user',
      entityId: user.id,
      actorUserId: currentUser.id,
      schoolId: user.schoolId,
      metadata: {
        email: user.email,
        role: user.role.roleType,
        userType: user.userType,
      },
    });

    return {
      success: true,
      message: 'User created successfully.',
      data: this.toSafeUser(user),
    };
  }

  async findAll(currentUser: JwtUser, query: UserQueryDto) {
    const schoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? query.schoolId ?? null
        : currentUser.schoolId ?? null;

    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      query.schoolId &&
      query.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You can only access users from your own school.');
    }

    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildUsersCacheKey(schoolId ?? 'all', {
      page,
      limit,
      search,
      role: query.role,
      userType: query.userType,
      status: query.status,
      viewerRole: currentUser.role,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      USER_LIST_TTL_SECONDS,
      async () => {
        const where = this.buildUsersWhere(currentUser, query, schoolId);

        const [users, total] = await Promise.all([
          this.prisma.user.findMany({
            where,
            include: userDetailsInclude,
            orderBy: {
              createdAt: 'desc',
            },
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.user.count({ where }),
        ]);

        return {
          items: users.map((user) => this.toSafeUser(user)),
          meta: {
            page,
            limit,
            total,
          },
        };
      },
    );

    return {
      success: true,
      message: 'Users fetched successfully.',
      data: payload.items,
      meta: payload.meta,
    };
  }

  async findOptions(currentUser: JwtUser, schoolId?: string | null) {
    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      schoolId &&
      schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You can only access users from your own school.');
    }

    const currentSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? schoolId ?? currentUser.schoolId ?? null
        : currentUser.schoolId ?? null;
    const assignableRoles = this.getAssignableRoleTypes(currentUser.role);

    const [roles, schools] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          isActive: true,
          roleType: {
            in: assignableRoles,
          },
          scopeKey: GLOBAL_SCOPE_KEY,
        },
        orderBy: {
          roleName: 'asc',
        },
      }),
      currentUser.role === RoleType.SUPER_ADMIN
        ? this.prisma.school.findMany({
            where: {
              isActive: true,
            },
            orderBy: {
              name: 'asc',
            },
            select: {
              id: true,
              name: true,
            },
          })
        : currentSchoolId
          ? this.prisma.school.findMany({
              where: {
                id: currentSchoolId,
              },
              select: {
                id: true,
                name: true,
              },
            })
          : [],
    ]);

    return {
      success: true,
      message: 'User options fetched successfully.',
      data: {
        currentSchoolId,
        roles: roles.map((role) => ({
          code: role.roleCode,
          label: role.roleName,
          type: role.roleType,
          userType: this.mapRoleTypeToUserType(role.roleType),
        })),
        userTypes: Object.values(UserType),
        schools,
      },
    };
  }

  async findOne(currentUser: JwtUser, id: string) {
    const user = await this.findReadableUserOrThrow(currentUser, id);

    return {
      success: true,
      message: 'User fetched successfully.',
      data: this.toSafeUser(user),
    };
  }

  async update(currentUser: JwtUser, id: string, dto: UpdateUserDto) {
    const existingUser = await this.findWritableUserOrThrow(currentUser, id);

    if (dto.isActive === false && currentUser.id === id) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const normalizedEmail = dto.email?.toLowerCase();

    if (normalizedEmail && normalizedEmail !== existingUser.email) {
      await this.ensureUniqueEmail(normalizedEmail, id);
    }

    const requestedSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? dto.schoolId ?? existingUser.schoolId ?? currentUser.schoolId ?? null
        : currentUser.schoolId ?? null;
    const roleType = dto.role ?? existingUser.role.roleType;
    const role = await this.resolveRoleForUser(roleType, requestedSchoolId);

    this.assertRoleAssignmentAllowed(currentUser, role.roleType);

    const schoolId = this.resolveSchoolIdForRole(
      currentUser,
      role.roleType,
      requestedSchoolId,
    );
    const userType = this.resolveUserType(role.roleType, dto.userType);
    const fullName = dto.fullName?.trim() ?? existingUser.fullName;
    const phone = dto.phone !== undefined ? dto.phone ?? null : existingUser.phone;
    const designation =
      dto.designation !== undefined
        ? dto.designation ?? null
        : existingUser.designation;
    const isActive = dto.isActive ?? existingUser.isActive;
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id,
        },
        data: {
          schoolId,
          roleId: role.id,
          fullName,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          ...(dto.phone !== undefined ? { phone } : {}),
          userType,
          ...(dto.designation !== undefined ? { designation } : {}),
          isActive,
          ...(passwordHash
            ? {
                passwordHash,
                passwordChangedAt: new Date(),
              }
            : {}),
        },
      });

      await this.syncTeacherProfile(tx, {
        userId: id,
        schoolId,
        fullName,
        email: normalizedEmail ?? existingUser.email,
        phone,
        designation,
        userType,
        isActive,
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: userDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    await this.invalidateUserCache();
    await this.auditService.write({
      action: 'users.update',
      entity: 'user',
      entityId: user.id,
      actorUserId: currentUser.id,
      schoolId: user.schoolId,
      metadata: {
        role: user.role.roleType,
        userType: user.userType,
      },
    });

    return {
      success: true,
      message: 'User updated successfully.',
      data: this.toSafeUser(user),
    };
  }

  async updateStatus(
    currentUser: JwtUser,
    id: string,
    dto: UpdateUserStatusDto,
  ) {
    const existingUser = await this.findWritableUserOrThrow(currentUser, id);

    if (!dto.isActive && currentUser.id === id) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id,
        },
        data: {
          isActive: dto.isActive,
        },
      });

      await this.syncTeacherProfile(tx, {
        userId: existingUser.id,
        schoolId: existingUser.schoolId,
        fullName: existingUser.fullName,
        email: existingUser.email,
        phone: existingUser.phone,
        designation: existingUser.designation,
        userType: existingUser.userType,
        isActive: dto.isActive,
      });

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: userDetailsInclude,
      });
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    await this.invalidateUserCache();
    await this.auditService.write({
      action: 'users.status',
      entity: 'user',
      entityId: user.id,
      actorUserId: currentUser.id,
      schoolId: user.schoolId,
      metadata: {
        isActive: user.isActive,
      },
    });

    return {
      success: true,
      message: user.isActive
        ? 'User activated successfully.'
        : 'User deactivated successfully.',
      data: this.toSafeUser(user),
    };
  }

  async remove(currentUser: JwtUser, id: string) {
    await this.updateStatus(currentUser, id, { isActive: false });

    return {
      success: true,
      message: 'User deactivated successfully.',
      data: {
        id,
        deleted: true,
      },
    };
  }

  async findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userDetailsInclude,
    });
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: userDetailsInclude,
    });
  }

  async findSafeById(id: string): Promise<SafeUser> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toSafeUser(user);
  }

  async touchLastLogin(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  getPermissionCodes(user: UserWithRole): string[] {
    return user.role.rolePermissions.map(
      (rolePermission) => rolePermission.permission.permissionCode,
    );
  }

  toSafeUser(user: UserWithRole): SafeUser {
    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role.roleType,
      roleCode: user.role.roleCode,
      userType: user.userType,
      designation: user.designation,
      schoolId: user.schoolId,
      isActive: user.isActive,
      status: user.isActive ? 'ACTIVE' : 'INACTIVE',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private buildUsersWhere(
    currentUser: JwtUser,
    query: UserQueryDto,
    schoolId: string | null,
  ): Prisma.UserWhereInput {
    const search = query.search?.trim();
    const allowedRoles: RoleType[] =
      currentUser.role === RoleType.SUPER_ADMIN
        ? [...MANAGEABLE_ROLE_TYPES]
        : MANAGEABLE_ROLE_TYPES.filter((role) => role !== RoleType.SUPER_ADMIN);
    const filteredRole = query.role && allowedRoles.includes(query.role)
      ? query.role
      : undefined;

    return {
      ...(schoolId ? { schoolId } : {}),
      role: {
        roleType: filteredRole
          ? filteredRole
          : {
              in: allowedRoles,
            },
      },
      ...(query.userType ? { userType: query.userType } : {}),
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  private async findReadableUserOrThrow(currentUser: JwtUser, id: string) {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (currentUser.role !== RoleType.SUPER_ADMIN) {
      if (!currentUser.schoolId || user.schoolId !== currentUser.schoolId) {
        throw new ForbiddenException(
          'You can only access users from your own school.',
        );
      }

      if (user.role.roleType === RoleType.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot access platform-level users.');
      }
    }

    return user;
  }

  private async findWritableUserOrThrow(currentUser: JwtUser, id: string) {
    const user = await this.findReadableUserOrThrow(currentUser, id);

    if (
      currentUser.role === RoleType.SCHOOL_ADMIN &&
      user.role.roleType !== RoleType.TEACHER &&
      user.role.roleType !== RoleType.STAFF
    ) {
      throw new ForbiddenException(
        'School admins can manage teachers and staff only.',
      );
    }

    return user;
  }

  private async ensureUniqueEmail(email: string, excludeUserId?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser && existingUser.id !== excludeUserId) {
      throw new ConflictException('Email is already in use.');
    }
  }

  private async resolveRoleForUser(roleType: RoleType, schoolId: string | null) {
    const scopedRoles = await this.prisma.role.findMany({
      where: {
        roleType,
        isActive: true,
        OR: schoolId
          ? [{ scopeKey: schoolId }, { scopeKey: GLOBAL_SCOPE_KEY }]
          : [{ scopeKey: GLOBAL_SCOPE_KEY }],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const preferredRole =
      scopedRoles.find((role) => role.scopeKey === schoolId) ??
      scopedRoles.find((role) => role.scopeKey === GLOBAL_SCOPE_KEY);

    if (!preferredRole) {
      throw new NotFoundException(`Role ${roleType} not found.`);
    }

    return preferredRole;
  }

  private assertRoleAssignmentAllowed(currentUser: JwtUser, roleType: RoleType) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return;
    }

    if (roleType !== RoleType.TEACHER && roleType !== RoleType.STAFF) {
      throw new ForbiddenException(
        'School admins can create and manage teachers and staff only.',
      );
    }
  }

  private resolveSchoolIdForRole(
    currentUser: JwtUser,
    roleType: RoleType,
    requestedSchoolId: string | null,
  ) {
    if (roleType === RoleType.SUPER_ADMIN) {
      if (currentUser.role !== RoleType.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admins can assign super admins.');
      }

      return null;
    }

    if (currentUser.role !== RoleType.SUPER_ADMIN) {
      if (!currentUser.schoolId) {
        throw new ForbiddenException(
          'This action requires a school-scoped authenticated user.',
        );
      }

      return currentUser.schoolId;
    }

    if (!requestedSchoolId) {
      throw new ConflictException('schoolId is required for school-scoped users.');
    }

    return requestedSchoolId;
  }

  private resolveUserType(roleType: RoleType, requestedUserType?: UserType) {
    const derivedUserType = this.mapRoleTypeToUserType(roleType);

    if (requestedUserType && requestedUserType !== derivedUserType) {
      throw new BadRequestException(
        'Selected user type does not match the assigned role.',
      );
    }

    return derivedUserType;
  }

  private mapRoleTypeToUserType(roleType: RoleType): UserType {
    switch (roleType) {
      case RoleType.TEACHER:
        return UserType.TEACHER;
      case RoleType.STAFF:
        return UserType.STAFF;
      case RoleType.PARENT:
        return UserType.PARENT;
      default:
        return UserType.ADMIN;
    }
  }

  private getAssignableRoleTypes(currentRole: RoleType): RoleType[] {
    if (currentRole === RoleType.SUPER_ADMIN) {
      return [
        RoleType.SUPER_ADMIN,
        RoleType.SCHOOL_ADMIN,
        RoleType.TEACHER,
        RoleType.STAFF,
      ];
    }

    return [RoleType.TEACHER, RoleType.STAFF];
  }

  private buildUsersCacheKey(
    scope: string,
    params: Record<string, string | number | RoleType | UserType | undefined>,
  ) {
    return `users:${scope}:${JSON.stringify(params)}`;
  }

  private async invalidateUserCache() {
    await this.redisService.deleteByPattern('users:*');
  }

  private splitName(fullName: string) {
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ') || firstName;

    return {
      firstName,
      lastName,
    };
  }

  private async syncTeacherProfile(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      schoolId: string | null;
      fullName: string;
      email: string;
      phone: string | null;
      designation: string | null;
      userType: UserType;
      isActive: boolean;
    },
  ) {
    const existingTeacher = await tx.teacher.findUnique({
      where: {
        userId: input.userId,
      },
    });

    if (input.userType !== UserType.TEACHER || !input.schoolId) {
      if (existingTeacher) {
        await tx.teacher.update({
          where: {
            id: existingTeacher.id,
          },
          data: {
            userId: null,
            status: TeacherStatus.INACTIVE,
          },
        });
      }

      return;
    }

    const { firstName, lastName } = this.splitName(input.fullName);
    const employeeCode =
      existingTeacher?.employeeCode ??
      (await this.generateTeacherEmployeeCode(tx, input.schoolId));

    if (existingTeacher) {
      await tx.teacher.update({
        where: {
          id: existingTeacher.id,
        },
        data: {
          schoolId: input.schoolId,
          userId: input.userId,
          employeeCode,
          firstName,
          lastName,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          qualification: input.designation,
          status: input.isActive ? TeacherStatus.ACTIVE : TeacherStatus.INACTIVE,
        },
      });

      return;
    }

    await tx.teacher.create({
      data: {
        schoolId: input.schoolId,
        userId: input.userId,
        employeeCode,
        firstName,
        lastName,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        qualification: input.designation,
        status: input.isActive ? TeacherStatus.ACTIVE : TeacherStatus.INACTIVE,
      },
    });
  }

  private async generateTeacherEmployeeCode(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const employeeCode = `TCHR-${Date.now().toString().slice(-8)}${attempt}`;
      const existingTeacher = await tx.teacher.findUnique({
        where: {
          schoolId_employeeCode: {
            schoolId,
            employeeCode,
          },
        },
      });

      if (!existingTeacher) {
        return employeeCode;
      }
    }

    throw new ConflictException('Unable to generate a unique employee code.');
  }
}
