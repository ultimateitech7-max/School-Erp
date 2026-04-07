import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ToggleSchoolModuleDto } from './dto/toggle-school-module.dto';

@Injectable()
export class ModulesControlService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleModule(dto: ToggleSchoolModuleDto) {
    const [school, module] = await Promise.all([
      this.prisma.school.findUnique({
        where: { id: dto.schoolId },
      }),
      this.prisma.module.findUnique({
        where: { moduleCode: dto.moduleCode },
      }),
    ]);

    if (!school) {
      throw new NotFoundException('School not found.');
    }

    if (!module) {
      throw new NotFoundException('Module not found.');
    }

    return this.prisma.schoolModule.upsert({
      where: {
        schoolId_moduleId: {
          schoolId: dto.schoolId,
          moduleId: module.id,
        },
      },
      update: {
        enabled: dto.enabled,
        enabledAt: dto.enabled ? new Date() : null,
      },
      create: {
        schoolId: dto.schoolId,
        moduleId: module.id,
        enabled: dto.enabled,
        enabledAt: dto.enabled ? new Date() : null,
      },
      include: {
        module: true,
        school: true,
      },
    });
  }

  async getEnabledModulesForSchool(schoolId: string | null) {
    if (!schoolId) {
      return this.prisma.module.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return this.prisma.schoolModule.findMany({
      where: {
        schoolId,
        enabled: true,
      },
      include: {
        module: true,
      },
      orderBy: {
        module: {
          sortOrder: 'asc',
        },
      },
    });
  }

  async seedModuleCatalog() {
    const existingModules = await this.prisma.module.findMany();

    if (existingModules.length > 0) {
      return existingModules;
    }

    const modules = [
      {
        moduleCode: ModuleCode.STUDENTS,
        moduleName: 'Students',
        description: 'Student admissions and lifecycle management',
        isCore: true,
        sortOrder: 10,
      },
      {
        moduleCode: ModuleCode.TEACHERS,
        moduleName: 'Teachers',
        description: 'Teacher directory and assignments',
        isCore: true,
        sortOrder: 20,
      },
      {
        moduleCode: ModuleCode.ATTENDANCE,
        moduleName: 'Attendance',
        description: 'Attendance tracking and reports',
        isCore: true,
        sortOrder: 30,
      },
      {
        moduleCode: ModuleCode.FEES,
        moduleName: 'Fees',
        description: 'Fee structures, assignments, and collections',
        isCore: true,
        sortOrder: 40,
      },
      {
        moduleCode: ModuleCode.EXAMS,
        moduleName: 'Exams',
        description: 'Exams, marks, and report cards',
        isCore: false,
        sortOrder: 50,
      },
      {
        moduleCode: ModuleCode.TRANSPORT,
        moduleName: 'Transport',
        description: 'Routes, vehicles, and transport assignments',
        isCore: false,
        sortOrder: 60,
      },
      {
        moduleCode: ModuleCode.LIBRARY,
        moduleName: 'Library',
        description: 'Library circulation and inventory',
        isCore: false,
        sortOrder: 70,
      },
      {
        moduleCode: ModuleCode.COMMUNICATION,
        moduleName: 'Communication',
        description: 'Messaging and notifications',
        isCore: false,
        sortOrder: 80,
      },
      {
        moduleCode: ModuleCode.ACADEMICS,
        moduleName: 'Academics',
        description: 'Sessions, classes, sections, and subjects',
        isCore: true,
        sortOrder: 90,
      },
    ];

    for (const module of modules) {
      await this.prisma.module.upsert({
        where: { moduleCode: module.moduleCode },
        update: module,
        create: module,
      });
    }

    return this.prisma.module.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }
}
