import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleCode, Prisma, RoleType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { UpdateSchoolBrandingDto } from './dto/update-school-branding.dto';
import { UpdateSchoolModulesDto } from './dto/update-school-modules.dto';
import { UpdateSchoolSettingsDto } from './dto/update-school-settings.dto';

type ModuleToggleDefinition = {
  key: string;
  label: string;
  description: string;
  moduleCode?: ModuleCode;
};

const SETTINGS_MODULES: ModuleToggleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Main dashboard and overview widgets',
  },
  {
    key: 'students',
    label: 'Students',
    description: 'Student admissions and profile management',
    moduleCode: ModuleCode.STUDENTS,
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Users, teachers, and staff management',
  },
  {
    key: 'classes',
    label: 'Classes',
    description: 'Class configuration and management',
    moduleCode: ModuleCode.ACADEMICS,
  },
  {
    key: 'sections',
    label: 'Sections',
    description: 'Section setup and allocation',
    moduleCode: ModuleCode.ACADEMICS,
  },
  {
    key: 'subjects',
    label: 'Subjects',
    description: 'Subject catalog and assignments',
    moduleCode: ModuleCode.ACADEMICS,
  },
  {
    key: 'fees',
    label: 'Fees',
    description: 'Fee structures, assignments, and collections',
    moduleCode: ModuleCode.FEES,
  },
  {
    key: 'attendance',
    label: 'Attendance',
    description: 'Attendance marking and summaries',
    moduleCode: ModuleCode.ATTENDANCE,
  },
  {
    key: 'exams',
    label: 'Exams',
    description: 'Exams, marks, and report cards',
    moduleCode: ModuleCode.EXAMS,
  },
];

const MODULE_CATALOG: Array<{
  moduleCode: ModuleCode;
  moduleName: string;
  description: string;
  sortOrder: number;
  isCore: boolean;
}> = [
  {
    moduleCode: ModuleCode.STUDENTS,
    moduleName: 'Students',
    description: 'Student admissions and lifecycle management',
    sortOrder: 10,
    isCore: true,
  },
  {
    moduleCode: ModuleCode.TEACHERS,
    moduleName: 'Teachers',
    description: 'Teacher directory and assignments',
    sortOrder: 20,
    isCore: true,
  },
  {
    moduleCode: ModuleCode.ATTENDANCE,
    moduleName: 'Attendance',
    description: 'Attendance tracking and summaries',
    sortOrder: 30,
    isCore: true,
  },
  {
    moduleCode: ModuleCode.FEES,
    moduleName: 'Fees',
    description: 'Fee structures and collections',
    sortOrder: 40,
    isCore: true,
  },
  {
    moduleCode: ModuleCode.EXAMS,
    moduleName: 'Exams',
    description: 'Exams, marks, and report cards',
    sortOrder: 50,
    isCore: false,
  },
  {
    moduleCode: ModuleCode.ACADEMICS,
    moduleName: 'Academics',
    description: 'Classes, sections, and subjects',
    sortOrder: 60,
    isCore: true,
  },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findSchoolSettings(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const school = await this.findSchoolOrThrow(currentUser, schoolIdOverride);

    return {
      success: true,
      message: 'School settings fetched successfully.',
      data: this.serializeSchoolSettings(school),
    };
  }

  async updateSchoolSettings(currentUser: JwtUser, dto: UpdateSchoolSettingsDto) {
    const school = await this.findSchoolOrThrow(currentUser, dto.schoolId ?? null);
    const settingsJson = this.getSettingsJson(school.settingsJson);

    const updatedSchool = await this.prisma.school.update({
      where: { id: school.id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.contactEmail !== undefined ? { email: dto.contactEmail ?? null } : {}),
        ...(dto.contactPhone !== undefined ? { phone: dto.contactPhone ?? null } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.address
          ? { addressJson: dto.address as Prisma.InputJsonValue }
          : {}),
        settingsJson: {
          ...settingsJson,
          schoolProfile: {
            ...this.getSchoolProfile(settingsJson),
            ...(dto.principalName !== undefined
              ? { principalName: dto.principalName ?? null }
              : {}),
            ...(dto.academicSessionLabel !== undefined
              ? { academicSessionLabel: dto.academicSessionLabel ?? null }
              : {}),
          },
        } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'School settings updated successfully.',
      data: this.serializeSchoolSettings(updatedSchool),
    };
  }

  async findBranding(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const school = await this.findSchoolOrThrow(currentUser, schoolIdOverride);

    return {
      success: true,
      message: 'Branding settings fetched successfully.',
      data: this.serializeBranding(school),
    };
  }

  async updateBranding(currentUser: JwtUser, dto: UpdateSchoolBrandingDto) {
    const school = await this.findSchoolOrThrow(currentUser, dto.schoolId ?? null);
    const settingsJson = this.getSettingsJson(school.settingsJson);

    const updatedSchool = await this.prisma.school.update({
      where: { id: school.id },
      data: {
        settingsJson: {
          ...settingsJson,
          branding: {
            ...this.getBrandingSettings(settingsJson),
            ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl ?? null } : {}),
            ...(dto.primaryColor !== undefined
              ? { primaryColor: dto.primaryColor ?? null }
              : {}),
            ...(dto.secondaryColor !== undefined
              ? { secondaryColor: dto.secondaryColor ?? null }
              : {}),
            ...(dto.website !== undefined ? { website: dto.website ?? null } : {}),
            ...(dto.supportEmail !== undefined
              ? { supportEmail: dto.supportEmail ?? null }
              : {}),
          },
        } as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Branding settings updated successfully.',
      data: this.serializeBranding(updatedSchool),
    };
  }

  async findModules(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const school = await this.findSchoolOrThrow(currentUser, schoolIdOverride);
    await this.ensureModuleCatalog();

    const moduleState = await this.buildModuleState(school.id, school.settingsJson);

    return {
      success: true,
      message: 'School modules fetched successfully.',
      data: moduleState,
    };
  }

  async updateModules(currentUser: JwtUser, dto: UpdateSchoolModulesDto) {
    const school = await this.findSchoolOrThrow(currentUser, dto.schoolId ?? null);
    await this.ensureModuleCatalog();

    const definitionsByKey = new Map(
      SETTINGS_MODULES.map((moduleToggle) => [moduleToggle.key, moduleToggle]),
    );
    const invalidKey = dto.modules.find((item) => !definitionsByKey.has(item.key));

    if (invalidKey) {
      throw new BadRequestException(`Unsupported module key: ${invalidKey.key}`);
    }

    const moduleCatalog = await this.prisma.module.findMany({
      where: {
        moduleCode: {
          in: [
            ModuleCode.STUDENTS,
            ModuleCode.FEES,
            ModuleCode.ATTENDANCE,
            ModuleCode.EXAMS,
            ModuleCode.ACADEMICS,
          ],
        },
      },
      select: {
        id: true,
        moduleCode: true,
      },
    });

    const moduleIdByCode = new Map(
      moduleCatalog.map((moduleRecord) => [moduleRecord.moduleCode, moduleRecord.id]),
    );

    const currentSettings = this.getSettingsJson(school.settingsJson);
    const currentToggleMap = this.getModuleToggleMap(currentSettings);
    const nextToggleMap = { ...currentToggleMap };

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.modules) {
        const definition = definitionsByKey.get(item.key)!;

        nextToggleMap[item.key] = item.enabled;

        if (definition.moduleCode) {
          const moduleId = moduleIdByCode.get(definition.moduleCode);

          if (moduleId) {
            await tx.schoolModule.upsert({
              where: {
                schoolId_moduleId: {
                  schoolId: school.id,
                  moduleId,
                },
              },
              update: {
                enabled: item.enabled,
                enabledAt: item.enabled ? new Date() : null,
                settingsJson: {
                  visibilityKey: item.key,
                },
              },
              create: {
                schoolId: school.id,
                moduleId,
                enabled: item.enabled,
                enabledAt: item.enabled ? new Date() : null,
                settingsJson: {
                  visibilityKey: item.key,
                },
              },
            });
          }
        }
      }

      await tx.school.update({
        where: { id: school.id },
        data: {
          settingsJson: {
            ...currentSettings,
            moduleToggles: nextToggleMap,
          } as Prisma.InputJsonValue,
        },
      });
    });

    const updatedSchool = await this.prisma.school.findUnique({
      where: { id: school.id },
    });

    if (!updatedSchool) {
      throw new NotFoundException('School not found.');
    }

    return {
      success: true,
      message: 'School modules updated successfully.',
      data: await this.buildModuleState(updatedSchool.id, updatedSchool.settingsJson),
    };
  }

  private async buildModuleState(schoolId: string, settingsJsonValue: Prisma.JsonValue) {
    const settingsJson = this.getSettingsJson(settingsJsonValue);
    const toggleMap = this.getModuleToggleMap(settingsJson);

    const schoolModules = await this.prisma.schoolModule.findMany({
      where: {
        schoolId,
      },
      include: {
        module: true,
      },
    });

    const enabledMap = new Map(
      schoolModules.map((schoolModule) => [
        schoolModule.module.moduleCode,
        schoolModule.enabled,
      ]),
    );

    return SETTINGS_MODULES.map((moduleToggle) => ({
      key: moduleToggle.key,
      label: moduleToggle.label,
      description: moduleToggle.description,
      enabled:
        toggleMap[moduleToggle.key] ??
        (moduleToggle.moduleCode
          ? enabledMap.get(moduleToggle.moduleCode) ?? true
          : true),
      linkedModuleCode: moduleToggle.moduleCode ?? null,
      source: moduleToggle.moduleCode ? 'school_module' : 'settings_json',
    }));
  }

  private async ensureModuleCatalog() {
    for (const moduleRecord of MODULE_CATALOG) {
      await this.prisma.module.upsert({
        where: {
          moduleCode: moduleRecord.moduleCode,
        },
        update: moduleRecord,
        create: moduleRecord,
      });
    }
  }

  private async findSchoolOrThrow(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveSchoolScope(currentUser, schoolIdOverride);

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new NotFoundException('School not found.');
    }

    return school;
  }

  private resolveSchoolScope(currentUser: JwtUser, schoolIdOverride?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      if (!schoolIdOverride) {
        throw new BadRequestException('schoolId is required for super admin requests.');
      }

      return schoolIdOverride;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException('This action requires a school-scoped user.');
    }

    if (schoolIdOverride && schoolIdOverride !== currentUser.schoolId) {
      throw new ForbiddenException('You can only access your own school settings.');
    }

    return currentUser.schoolId;
  }

  private serializeSchoolSettings(school: {
    id: string;
    schoolCode: string;
    name: string;
    email: string | null;
    phone: string | null;
    timezone: string;
    addressJson: Prisma.JsonValue;
    settingsJson: Prisma.JsonValue;
  }) {
    const settingsJson = this.getSettingsJson(school.settingsJson);
    const schoolProfile = this.getSchoolProfile(settingsJson);

    return {
      schoolId: school.id,
      schoolCode: school.schoolCode,
      name: school.name,
      contactEmail: school.email,
      contactPhone: school.phone,
      timezone: school.timezone,
      address: this.getAddress(school.addressJson),
      principalName: schoolProfile.principalName ?? null,
      academicSessionLabel: schoolProfile.academicSessionLabel ?? null,
    };
  }

  private serializeBranding(school: {
    id: string;
    settingsJson: Prisma.JsonValue;
  }) {
    const branding = this.getBrandingSettings(this.getSettingsJson(school.settingsJson));

    return {
      schoolId: school.id,
      logoUrl: branding.logoUrl ?? null,
      primaryColor: branding.primaryColor ?? null,
      secondaryColor: branding.secondaryColor ?? null,
      website: branding.website ?? null,
      supportEmail: branding.supportEmail ?? null,
    };
  }

  private getSettingsJson(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, any>;
    }

    return value as Record<string, any>;
  }

  private getSchoolProfile(settingsJson: Record<string, any>) {
    if (
      !settingsJson.schoolProfile ||
      typeof settingsJson.schoolProfile !== 'object' ||
      Array.isArray(settingsJson.schoolProfile)
    ) {
      return {} as Record<string, any>;
    }

    return settingsJson.schoolProfile as Record<string, any>;
  }

  private getBrandingSettings(settingsJson: Record<string, any>) {
    if (
      !settingsJson.branding ||
      typeof settingsJson.branding !== 'object' ||
      Array.isArray(settingsJson.branding)
    ) {
      return {} as Record<string, any>;
    }

    return settingsJson.branding as Record<string, any>;
  }

  private getModuleToggleMap(settingsJson: Record<string, any>) {
    if (
      !settingsJson.moduleToggles ||
      typeof settingsJson.moduleToggles !== 'object' ||
      Array.isArray(settingsJson.moduleToggles)
    ) {
      return {} as Record<string, boolean>;
    }

    return settingsJson.moduleToggles as Record<string, boolean>;
  }

  private getAddress(addressJson: Prisma.JsonValue) {
    if (!addressJson || typeof addressJson !== 'object' || Array.isArray(addressJson)) {
      return {};
    }

    return addressJson as Record<string, unknown>;
  }
}
