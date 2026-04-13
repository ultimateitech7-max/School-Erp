import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeeAssignmentStatus,
  FeeCategory,
  FeeFrequency,
  PaymentMode,
  Prisma,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { AssignFeeDto } from './dto/assign-fee.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { FeeQueryDto } from './dto/fee-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';

const FEE_LIST_TTL_SECONDS = 60 * 5;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const feeStructureInclude = Prisma.validator<Prisma.FeeStructureInclude>()({
  academicClass: {
    select: {
      id: true,
      className: true,
      classCode: true,
    },
  },
  academicSession: {
    select: {
      id: true,
      sessionName: true,
      isCurrent: true,
    },
  },
});

const feeAssignmentInclude = Prisma.validator<Prisma.FeeAssignmentInclude>()({
  student: {
    select: {
      id: true,
      fullName: true,
      studentCode: true,
    },
  },
  feeStructure: {
    include: feeStructureInclude,
  },
  payments: {
    include: {
      feeReceipt: true,
    },
    orderBy: {
      paymentDate: 'desc',
    },
  },
});

const feePaymentInclude = Prisma.validator<Prisma.FeePaymentInclude>()({
  feeAssignment: {
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          studentCode: true,
        },
      },
      feeStructure: {
        select: {
          id: true,
          feeName: true,
          feeCode: true,
        },
      },
    },
  },
  feeReceipt: true,
});

type FeeStructureWithDetails = Prisma.FeeStructureGetPayload<{
  include: typeof feeStructureInclude;
}>;

type FeeAssignmentWithDetails = Prisma.FeeAssignmentGetPayload<{
  include: typeof feeAssignmentInclude;
}>;

type FeePaymentWithDetails = Prisma.FeePaymentGetPayload<{
  include: typeof feePaymentInclude;
}>;

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async findOptions(currentUser: JwtUser, schoolIdOverride?: string | null) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);

    const [currentSession, classes, students] = await Promise.all([
      this.resolveAcademicSession(schoolId),
      this.prisma.academicClass.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { className: 'asc' }],
        select: {
          id: true,
          className: true,
          classCode: true,
          sections: {
            where: {
              isActive: true,
            },
            orderBy: {
              sectionName: 'asc',
            },
            select: {
              id: true,
              sectionName: true,
            },
          },
        },
      }),
      this.prisma.student.findMany({
        where: {
          schoolId,
          status: {
            not: 'INACTIVE',
          },
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          studentCode: true,
          registrationNumber: true,
          admissions: {
            where: {
              admissionStatus: {
                in: ['ACTIVE', 'PROMOTED'],
              },
            },
            orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              admissionNo: true,
              classId: true,
              sectionId: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        currentSessionId: currentSession.id,
        currentSessionName: currentSession.sessionName,
        classes: classes.map((academicClass) => ({
          id: academicClass.id,
          name: academicClass.className,
          classCode: academicClass.classCode,
          sections: academicClass.sections.map((section) => ({
            id: section.id,
            name: section.sectionName,
          })),
        })),
        students: students.map((student) => ({
          id: student.id,
          name: student.fullName,
          studentCode: student.studentCode,
          registrationNumber: student.registrationNumber,
          admissionNo: student.admissions[0]?.admissionNo ?? null,
          classId: student.admissions[0]?.classId ?? null,
          sectionId: student.admissions[0]?.sectionId ?? null,
        })),
        feeCategories: Object.values(FeeCategory),
        feeFrequencies: Object.values(FeeFrequency),
        paymentModes: Object.values(PaymentMode),
        assignmentStatuses: Object.values(FeeAssignmentStatus),
      },
    };
  }

  async createFeeStructure(currentUser: JwtUser, dto: CreateFeeStructureDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const session = await this.resolveAcademicSession(schoolId, dto.sessionId);
    const feeName = dto.name.trim();
    const feeCode =
      dto.feeCode?.trim().toUpperCase() ??
      (await this.generateFeeCode(schoolId, session.id));

    await this.ensureUniqueFeeStructure(schoolId, session.id, feeCode);

    if (dto.classId) {
      await this.ensureClassInSchool(schoolId, dto.classId);
    }

    const feeStructure = await this.prisma.feeStructure.create({
      data: {
        schoolId,
        sessionId: session.id,
        classId: dto.classId ?? null,
        feeCode,
        feeName,
        feeCategory: dto.category ?? FeeCategory.OTHER,
        frequency: dto.frequency ?? FeeFrequency.ONE_TIME,
        amount: new Prisma.Decimal(dto.amount),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        lateFeePerDay: new Prisma.Decimal(dto.lateFeePerDay ?? 0),
        isOptional: dto.isOptional ?? false,
        isActive: true,
      },
      include: feeStructureInclude,
    });

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.structure.create',
      entity: 'fee_structure',
      entityId: feeStructure.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        feeName: feeStructure.feeName,
        feeCode: feeStructure.feeCode,
      },
    });

    return {
      success: true,
      data: this.serializeFeeStructure(feeStructure),
    };
  }

  async updateFeeStructure(
    currentUser: JwtUser,
    id: string,
    dto: UpdateFeeStructureDto,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const existingFeeStructure = await this.prisma.feeStructure.findFirst({
      where: {
        id,
        schoolId,
        isActive: true,
      },
      include: feeStructureInclude,
    });

    if (!existingFeeStructure) {
      throw new NotFoundException('Fee structure not found for this school.');
    }

    const nextSessionId = dto.sessionId ?? existingFeeStructure.sessionId;
    const feeCode = dto.feeCode?.trim().toUpperCase() ?? existingFeeStructure.feeCode;

    if (dto.classId) {
      await this.ensureClassInSchool(schoolId, dto.classId);
    }

    if (dto.sessionId) {
      await this.resolveAcademicSession(schoolId, dto.sessionId);
    }

    if (
      feeCode !== existingFeeStructure.feeCode ||
      nextSessionId !== existingFeeStructure.sessionId
    ) {
      await this.ensureUniqueFeeStructure(schoolId, nextSessionId, feeCode, id);
    }

    const updatedFeeStructure = await this.prisma.feeStructure.update({
      where: {
        id: existingFeeStructure.id,
      },
      data: {
        sessionId: nextSessionId,
        classId: dto.classId !== undefined ? dto.classId || null : undefined,
        feeCode,
        feeName: dto.name?.trim() ?? undefined,
        feeCategory: dto.category ?? undefined,
        frequency: dto.frequency ?? undefined,
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : null
            : undefined,
        lateFeePerDay:
          dto.lateFeePerDay !== undefined
            ? new Prisma.Decimal(dto.lateFeePerDay)
            : undefined,
        isOptional: dto.isOptional ?? undefined,
      },
      include: feeStructureInclude,
    });

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.structure.update',
      entity: 'fee_structure',
      entityId: updatedFeeStructure.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        feeName: updatedFeeStructure.feeName,
        feeCode: updatedFeeStructure.feeCode,
      },
    });

    return {
      success: true,
      message: 'Fee structure updated successfully.',
      data: this.serializeFeeStructure(updatedFeeStructure),
    };
  }

  async removeFeeStructure(
    currentUser: JwtUser,
    id: string,
    schoolIdOverride?: string | null,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, schoolIdOverride);
    const existingFeeStructure = await this.prisma.feeStructure.findFirst({
      where: {
        id,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        schoolId: true,
        feeName: true,
        feeCode: true,
      },
    });

    if (!existingFeeStructure) {
      throw new NotFoundException('Fee structure not found for this school.');
    }

    await this.prisma.feeStructure.update({
      where: {
        id: existingFeeStructure.id,
      },
      data: {
        isActive: false,
      },
    });

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.structure.delete',
      entity: 'fee_structure',
      entityId: existingFeeStructure.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        feeName: existingFeeStructure.feeName,
        feeCode: existingFeeStructure.feeCode,
      },
    });

    return {
      success: true,
      message: 'Fee structure deleted successfully.',
      data: {
        id: existingFeeStructure.id,
        deleted: true,
      },
    };
  }

  async findFeeStructures(currentUser: JwtUser, query: FeeQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildCacheKey('structures', schoolId ?? 'all', {
      page,
      limit,
      search,
      classId: query.classId,
      sessionId: query.sessionId,
      frequency: query.frequency,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      FEE_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.FeeStructureWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          isActive: true,
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sessionId ? { sessionId: query.sessionId } : {}),
          ...(query.frequency ? { frequency: query.frequency } : {}),
          ...(search
            ? {
                OR: [
                  {
                    feeName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    feeCode: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        };

        const [items, total] = await Promise.all([
          this.prisma.feeStructure.findMany({
            where,
            include: feeStructureInclude,
            orderBy: [{ createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.feeStructure.count({ where }),
        ]);

        return {
          items: items.map((item) => this.serializeFeeStructure(item)),
          meta: { page, limit, total },
        };
      },
    );

    return {
      success: true,
      data: payload.items,
      meta: payload.meta,
    };
  }

  async assignFee(currentUser: JwtUser, dto: AssignFeeDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const feeStructure = await this.prisma.feeStructure.findFirst({
      where: {
        id: dto.feeStructureId,
        schoolId,
        isActive: true,
      },
      include: feeStructureInclude,
    });

    if (!feeStructure) {
      throw new NotFoundException('Fee structure not found for this school.');
    }

    const session = await this.resolveAcademicSession(
      schoolId,
      dto.sessionId ?? feeStructure.sessionId,
    );
    const targetStudents = await this.resolveFeeAssignmentTargets(
      schoolId,
      dto,
      session.id,
    );

    const assignedAmount = new Prisma.Decimal(
      dto.totalAmount ?? feeStructure.amount.toNumber(),
    );
    const concessionAmount = new Prisma.Decimal(dto.concessionAmount ?? 0);
    const netAmount = assignedAmount.minus(concessionAmount);

    if (netAmount.lessThan(0)) {
      throw new BadRequestException(
        'Concession amount cannot exceed total assigned amount.',
      );
    }

    const dueDate = dto.dueDate ? new Date(dto.dueDate) : feeStructure.dueDate ?? null;
    const feeAssignments = await this.prisma.$transaction(
      async (tx) => {
        const records = [];

        for (const student of targetStudents) {
          const record = await tx.feeAssignment.upsert({
            where: {
              schoolId_studentId_feeStructureId: {
                schoolId,
                studentId: student.id,
                feeStructureId: feeStructure.id,
              },
            },
            update: {
              sessionId: session.id,
              assignedAmount,
              concessionAmount,
              netAmount,
              dueDate,
              status: FeeAssignmentStatus.PENDING,
            },
            create: {
              schoolId,
              sessionId: session.id,
              studentId: student.id,
              feeStructureId: feeStructure.id,
              assignedAmount,
              concessionAmount,
              netAmount,
              paidAmount: new Prisma.Decimal(0),
              dueDate,
              status: FeeAssignmentStatus.PENDING,
            },
            include: feeAssignmentInclude,
          });

          records.push(record);
        }

        return records;
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.assign',
      entity: 'fee_assignment',
      entityId: feeAssignments[0]?.id ?? feeStructure.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        studentIds: targetStudents.map((student) => student.id),
        feeStructureId: feeStructure.id,
        totalAssignedStudents: targetStudents.length,
        netAmount: netAmount.toString(),
      },
    });

    return {
      success: true,
      message:
        targetStudents.length === 1
          ? 'Fee assigned successfully.'
          : `Fee assigned successfully to ${targetStudents.length} students.`,
      data: this.serializeFeeAssignment(feeAssignments[0]),
    };
  }

  async findStudentFees(
    currentUser: JwtUser,
    studentId: string,
    query: FeeQueryDto,
  ) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const student = await this.findStudentOrThrow(currentUser, studentId, schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const where: Prisma.FeeAssignmentWhereInput = {
      schoolId: student.schoolId,
      studentId: student.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.feeStructureId ? { feeStructureId: query.feeStructureId } : {}),
      ...(search
        ? {
            OR: [
              {
                feeStructure: {
                  feeName: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                feeStructure: {
                  feeCode: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.feeAssignment.findMany({
        where,
        include: feeAssignmentInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.feeAssignment.count({ where }),
    ]);

    return {
      success: true,
      data: items.map((item) => this.serializeFeeAssignment(item)),
      meta: { page, limit, total },
      student: {
        id: student.id,
        name: student.fullName,
        studentCode: student.studentCode,
      },
    };
  }

  async recordPayment(currentUser: JwtUser, dto: RecordPaymentDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const feeAssignment = await this.prisma.feeAssignment.findFirst({
      where: {
        id: dto.studentFeeId,
        schoolId,
      },
      include: feeAssignmentInclude,
    });

    if (!feeAssignment) {
      throw new NotFoundException('Student fee assignment not found.');
    }

    const dueAmount = feeAssignment.netAmount.minus(feeAssignment.paidAmount);

    if (dueAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('This fee assignment is already fully paid.');
    }

    const paidAmount = new Prisma.Decimal(dto.amount);

    if (paidAmount.greaterThan(dueAmount)) {
      throw new BadRequestException('Payment amount cannot exceed due amount.');
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const receiptNo = await this.generateReceiptNo(schoolId);

    const payment = await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.feeReceipt.create({
        data: {
          schoolId,
          studentId: feeAssignment.studentId,
          receiptNo,
          receiptDate: paymentDate,
          totalAmount: paidAmount,
          paymentMode: dto.paymentMethod,
          transactionReference: dto.reference ?? null,
          receivedByUserId: currentUser.id,
          notes: dto.notes ?? null,
        },
      });

      const createdPayment = await tx.feePayment.create({
        data: {
          schoolId,
          feeAssignmentId: feeAssignment.id,
          feeReceiptId: receipt.id,
          paymentDate,
          paidAmount,
          remarks: dto.notes ?? null,
        },
        include: feePaymentInclude,
      });

      const updatedPaidAmount = feeAssignment.paidAmount.plus(paidAmount);
      const updatedDueAmount = feeAssignment.netAmount.minus(updatedPaidAmount);
      const nextStatus = updatedDueAmount.lessThanOrEqualTo(0)
        ? FeeAssignmentStatus.PAID
        : FeeAssignmentStatus.PARTIAL;

      await tx.feeAssignment.update({
        where: { id: feeAssignment.id },
        data: {
          paidAmount: updatedPaidAmount,
          status: nextStatus,
        },
      });

      return createdPayment;
    }, {
      maxWait: 10_000,
      timeout: 20_000,
    });

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.payment.record',
      entity: 'fee_payment',
      entityId: payment.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        feeAssignmentId: payment.feeAssignmentId,
        amount: payment.paidAmount.toString(),
        receiptNo: payment.feeReceipt.receiptNo,
      },
    });

    return {
      success: true,
      data: this.serializePayment(payment),
    };
  }

  async findPayments(currentUser: JwtUser, query: FeeQueryDto) {
    const schoolId = this.resolveListSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, DEFAULT_PAGE);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';
    const cacheKey = this.buildCacheKey('payments', schoolId ?? 'all', {
      page,
      limit,
      search,
      studentId: query.studentId,
      classId: query.classId,
      sectionId: query.sectionId,
      paymentMethod: query.paymentMethod,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      FEE_LIST_TTL_SECONDS,
      async () => {
        const where: Prisma.FeePaymentWhereInput = {
          ...(schoolId ? { schoolId } : {}),
          ...(query.studentId
            ? {
                feeAssignment: {
                  studentId: query.studentId,
                },
              }
            : {}),
          ...(query.classId || query.sectionId
            ? {
                feeAssignment: {
                  ...(query.studentId ? { studentId: query.studentId } : {}),
                  student: {
                    admissions: {
                      some: {
                        admissionStatus: {
                          in: ['ACTIVE', 'PROMOTED'],
                        },
                        ...(query.classId ? { classId: query.classId } : {}),
                        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
                      },
                    },
                  },
                },
              }
            : {}),
          ...(query.paymentMethod
            ? {
                feeReceipt: {
                  paymentMode: query.paymentMethod,
                },
              }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    feeAssignment: {
                      student: {
                        fullName: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                  {
                    feeReceipt: {
                      receiptNo: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    feeReceipt: {
                      transactionReference: {
                        contains: search,
                        mode: 'insensitive',
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        const [items, total] = await Promise.all([
          this.prisma.feePayment.findMany({
            where,
            include: feePaymentInclude,
            orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.feePayment.count({ where }),
        ]);

        return {
          items: items.map((item) => this.serializePayment(item)),
          meta: { page, limit, total },
        };
      },
    );

    return {
      success: true,
      data: payload.items,
      meta: payload.meta,
    };
  }

  async getPaymentReceipt(currentUser: JwtUser, paymentId: string) {
    const schoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? currentUser.schoolId ?? undefined
        : this.resolveWriteSchoolScope(currentUser, currentUser.schoolId ?? null);
    const payment = await this.findPaymentForReceipt(paymentId, { schoolId });

    return {
      success: true,
      message: 'Fee receipt fetched successfully.',
      data: this.serializeReceiptPayload(payment),
    };
  }

  async getPaymentReceiptForStudent(currentUser: JwtUser, paymentId: string) {
    if (currentUser.role !== RoleType.STUDENT || !currentUser.schoolId) {
      throw new ForbiddenException('Only student users can access this receipt.');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        userId: currentUser.id,
        schoolId: currentUser.schoolId,
      },
      select: {
        id: true,
        schoolId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const payment = await this.findPaymentForReceipt(paymentId, {
      schoolId: student.schoolId,
      studentId: student.id,
    });

    return {
      success: true,
      message: 'Student fee receipt fetched successfully.',
      data: this.serializeReceiptPayload(payment),
    };
  }

  async getPaymentReceiptForParent(
    currentUser: JwtUser,
    studentId: string,
    paymentId: string,
  ) {
    if (currentUser.role !== RoleType.PARENT || !currentUser.schoolId) {
      throw new ForbiddenException('Only parent users can access this receipt.');
    }

    const link = await this.prisma.parentStudent.findFirst({
      where: {
        schoolId: currentUser.schoolId,
        studentId,
        parent: {
          userId: currentUser.id,
        },
      },
      select: {
        schoolId: true,
        studentId: true,
      },
    });

    if (!link) {
      throw new NotFoundException('Linked student not found for this parent.');
    }

    const payment = await this.findPaymentForReceipt(paymentId, {
      schoolId: link.schoolId,
      studentId: link.studentId,
    });

    return {
      success: true,
      message: 'Parent fee receipt fetched successfully.',
      data: this.serializeReceiptPayload(payment),
    };
  }

  private resolveWriteSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      const schoolId = overrideSchoolId ?? currentUser.schoolId ?? null;

      if (!schoolId) {
        throw new ForbiddenException(
          'SUPER_ADMIN must provide a school scope for this action.',
        );
      }

      return schoolId;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private resolveListSchoolScope(
    currentUser: JwtUser,
    overrideSchoolId?: string | null,
  ) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return overrideSchoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new ForbiddenException(
        'This action requires a school-scoped authenticated user.',
      );
    }

    if (overrideSchoolId && overrideSchoolId !== currentUser.schoolId) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return currentUser.schoolId;
  }

  private async resolveAcademicSession(schoolId: string, sessionId?: string | null) {
    if (sessionId) {
      const session = await this.prisma.academicSession.findFirst({
        where: { id: sessionId, schoolId, isActive: true },
        select: { id: true, sessionName: true, isCurrent: true },
      });

      if (!session) {
        throw new NotFoundException('Academic session not found for this school.');
      }

      return session;
    }

    const currentSession = await this.prisma.academicSession.findFirst({
      where: { schoolId, isCurrent: true, isActive: true },
      select: { id: true, sessionName: true, isCurrent: true },
    });

    if (!currentSession) {
      throw new BadRequestException(
        'No active current academic session found for this school.',
      );
    }

    return currentSession;
  }

  private async resolveFeeAssignmentTargets(
    schoolId: string,
    dto: AssignFeeDto,
    sessionId: string,
  ) {
    if (dto.studentId) {
      return [await this.ensureStudentInSchool(schoolId, dto.studentId)];
    }

    if (!dto.classId) {
      throw new BadRequestException(
        'Select a class, section, or student before assigning a fee.',
      );
    }

    await this.ensureClassInSchool(schoolId, dto.classId);

    if (dto.sectionId) {
      await this.ensureSectionInSchool(schoolId, dto.classId, dto.sectionId);
    }

    const students = await this.prisma.student.findMany({
      where: {
        schoolId,
        status: {
          not: 'INACTIVE',
        },
        admissions: {
          some: {
            admissionStatus: {
              in: ['ACTIVE', 'PROMOTED'],
            },
            sessionId,
            classId: dto.classId,
            ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        studentCode: true,
      },
    });

    if (!students.length) {
      throw new BadRequestException(
        dto.sectionId
          ? 'No active students found in the selected section.'
          : 'No active students found in the selected class.',
      );
    }

    return students;
  }

  private async ensureUniqueFeeStructure(
    schoolId: string,
    sessionId: string,
    feeCode: string,
    ignoreId?: string,
  ) {
    const existingFee = await this.prisma.feeStructure.findFirst({
      where: {
        schoolId,
        sessionId,
        feeCode: {
          equals: feeCode,
          mode: 'insensitive',
        },
        ...(ignoreId
          ? {
              id: {
                not: ignoreId,
              },
            }
          : {}),
      },
      select: { id: true },
    });

    if (existingFee) {
      throw new ConflictException('Fee code already exists in this session.');
    }
  }

  private async ensureClassInSchool(schoolId: string, classId: string) {
    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        id: classId,
        schoolId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!academicClass) {
      throw new NotFoundException('Class not found for this school.');
    }
  }

  private async ensureSectionInSchool(
    schoolId: string,
    classId: string,
    sectionId: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        classId,
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!section) {
      throw new NotFoundException('Section not found for this class.');
    }
  }

  private async ensureStudentInSchool(schoolId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId,
        status: {
          not: 'INACTIVE',
        },
      },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        studentCode: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found for this school.');
    }

    return student;
  }

  private async findPaymentForReceipt(
    paymentId: string,
    scope: { schoolId?: string; studentId?: string },
  ) {
    const payment = await this.prisma.feePayment.findFirst({
      where: {
        id: paymentId,
        ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
        ...(scope.studentId
          ? {
              feeAssignment: {
                studentId: scope.studentId,
              },
            }
          : {}),
      },
      include: {
        feeReceipt: {
          include: {
            receivedByUser: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        feeAssignment: {
          include: {
            academicSession: {
              select: {
                id: true,
                sessionName: true,
                isCurrent: true,
              },
            },
            student: {
              select: {
                id: true,
                fullName: true,
                studentCode: true,
                admissions: {
                  orderBy: [{ admissionDate: 'desc' }, { createdAt: 'desc' }],
                  take: 1,
                  include: {
                    academicClass: {
                      select: {
                        id: true,
                        className: true,
                        classCode: true,
                      },
                    },
                    section: {
                      select: {
                        id: true,
                        sectionName: true,
                      },
                    },
                  },
                },
              },
            },
            feeStructure: {
              select: {
                id: true,
                feeName: true,
                feeCode: true,
                feeCategory: true,
              },
            },
          },
        },
        school: {
          select: {
            id: true,
            schoolCode: true,
            name: true,
            email: true,
            phone: true,
            addressJson: true,
            settingsJson: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Fee payment receipt not found.');
    }

    return payment;
  }

  private async findStudentOrThrow(
    currentUser: JwtUser,
    studentId: string,
    schoolId?: string | null,
  ) {
    const scopeSchoolId =
      currentUser.role === RoleType.SUPER_ADMIN
        ? schoolId ?? null
        : this.resolveWriteSchoolScope(currentUser, schoolId);

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...(scopeSchoolId ? { schoolId: scopeSchoolId } : {}),
        status: {
          not: 'INACTIVE',
        },
      },
      select: {
        id: true,
        schoolId: true,
        fullName: true,
        studentCode: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    if (
      currentUser.role !== RoleType.SUPER_ADMIN &&
      student.schoolId !== currentUser.schoolId
    ) {
      throw new ForbiddenException('You cannot access another school.');
    }

    return student;
  }

  private async generateFeeCode(schoolId: string, sessionId: string) {
    const totalFees = await this.prisma.feeStructure.count({
      where: {
        schoolId,
        sessionId,
      },
    });

    let nextIndex = totalFees + 1;

    while (true) {
      const candidate = `FEE-${String(nextIndex).padStart(3, '0')}`;
      const existingFee = await this.prisma.feeStructure.findFirst({
        where: {
          schoolId,
          sessionId,
          feeCode: candidate,
        },
        select: { id: true },
      });

      if (!existingFee) {
        return candidate;
      }

      nextIndex += 1;
    }
  }

  private async generateReceiptNo(schoolId: string) {
    const totalReceipts = await this.prisma.feeReceipt.count({
      where: { schoolId },
    });

    let nextIndex = totalReceipts + 1;

    while (true) {
      const candidate = `RCPT-${String(nextIndex).padStart(5, '0')}`;
      const existingReceipt = await this.prisma.feeReceipt.findFirst({
        where: {
          schoolId,
          receiptNo: candidate,
        },
        select: { id: true },
      });

      if (!existingReceipt) {
        return candidate;
      }

      nextIndex += 1;
    }
  }

  private buildCacheKey(
    category: string,
    schoolScope: string,
    params: Record<string, string | number | boolean | undefined>,
  ) {
    return `fees:${category}:${schoolScope}:${JSON.stringify(params)}`;
  }

  private async invalidateFeeCaches(schoolId: string) {
    await this.redisService.deleteByPattern(`fees:*:${schoolId}:*`);
    await this.redisService.deleteByPattern('fees:*:all:*');
  }

  private serializeFeeStructure(feeStructure: FeeStructureWithDetails) {
    return {
      id: feeStructure.id,
      schoolId: feeStructure.schoolId,
      sessionId: feeStructure.sessionId,
      classId: feeStructure.classId,
      feeCode: feeStructure.feeCode,
      name: feeStructure.feeName,
      category: feeStructure.feeCategory,
      frequency: feeStructure.frequency,
      amount: feeStructure.amount.toNumber(),
      dueDate: feeStructure.dueDate,
      lateFeePerDay: feeStructure.lateFeePerDay.toNumber(),
      isOptional: feeStructure.isOptional,
      class: feeStructure.academicClass
        ? {
            id: feeStructure.academicClass.id,
            className: feeStructure.academicClass.className,
            classCode: feeStructure.academicClass.classCode,
          }
        : null,
      session: {
        id: feeStructure.academicSession.id,
        name: feeStructure.academicSession.sessionName,
        isCurrent: feeStructure.academicSession.isCurrent,
      },
      createdAt: feeStructure.createdAt,
      updatedAt: feeStructure.updatedAt,
    };
  }

  private serializeFeeAssignment(feeAssignment: FeeAssignmentWithDetails) {
    const totalAmount = feeAssignment.assignedAmount.toNumber();
    const paidAmount = feeAssignment.paidAmount.toNumber();
    const dueAmount = feeAssignment.netAmount.minus(feeAssignment.paidAmount).toNumber();
    const status = this.resolveAssignmentStatus(dueAmount, paidAmount);

    return {
      id: feeAssignment.id,
      studentFeeId: feeAssignment.id,
      schoolId: feeAssignment.schoolId,
      student: {
        id: feeAssignment.student.id,
        name: feeAssignment.student.fullName,
        studentCode: feeAssignment.student.studentCode,
      },
      feeStructure: this.serializeFeeStructure(feeAssignment.feeStructure),
      totalAmount,
      concessionAmount: feeAssignment.concessionAmount.toNumber(),
      netAmount: feeAssignment.netAmount.toNumber(),
      paidAmount,
      dueAmount,
      status,
      dueDate: feeAssignment.dueDate,
      assignedAt: feeAssignment.assignedAt,
      payments: feeAssignment.payments.map((payment) => ({
        id: payment.id,
        amount: payment.paidAmount.toNumber(),
        paymentDate: payment.paymentDate,
        receiptNo: payment.feeReceipt.receiptNo,
        paymentMethod: payment.feeReceipt.paymentMode,
        reference: payment.feeReceipt.transactionReference,
      })),
      createdAt: feeAssignment.createdAt,
      updatedAt: feeAssignment.updatedAt,
    };
  }

  private resolveAssignmentStatus(dueAmount: number, paidAmount: number) {
    if (dueAmount <= 0) {
      return FeeAssignmentStatus.PAID;
    }

    if (paidAmount > 0) {
      return FeeAssignmentStatus.PARTIAL;
    }

    return FeeAssignmentStatus.PENDING;
  }

  private serializePayment(payment: FeePaymentWithDetails) {
    return {
      id: payment.id,
      schoolId: payment.schoolId,
      studentFeeId: payment.feeAssignmentId,
      amount: payment.paidAmount.toNumber(),
      paymentDate: payment.paymentDate,
      paymentMethod: payment.feeReceipt.paymentMode,
      reference: payment.feeReceipt.transactionReference,
      receiptNo: payment.feeReceipt.receiptNo,
      student: {
        id: payment.feeAssignment.student.id,
        name: payment.feeAssignment.student.fullName,
        studentCode: payment.feeAssignment.student.studentCode,
      },
      feeStructure: {
        id: payment.feeAssignment.feeStructure.id,
        name: payment.feeAssignment.feeStructure.feeName,
        feeCode: payment.feeAssignment.feeStructure.feeCode,
      },
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private serializeReceiptPayload(
    payment: Awaited<ReturnType<FeesService['findPaymentForReceipt']>>,
  ) {
    const settingsJson = this.getSettingsJson(payment.school.settingsJson);
    const branding = this.getBrandingSettings(settingsJson);
    const template = this.getReceiptTemplateSettings(settingsJson);
    const currentEnrollment = payment.feeAssignment.student.admissions[0] ?? null;
    const previousPaidAmount = payment.feeAssignment.paidAmount.minus(payment.paidAmount);
    const dueAfterPayment = payment.feeAssignment.netAmount.minus(
      payment.feeAssignment.paidAmount,
    );

    return {
      paymentId: payment.id,
      receiptId: payment.feeReceipt.id,
      receiptNo: payment.feeReceipt.receiptNo,
      receiptDate: payment.feeReceipt.receiptDate,
      amount: payment.paidAmount.toNumber(),
      paymentMethod: payment.feeReceipt.paymentMode,
      reference: payment.feeReceipt.transactionReference,
      remarks: payment.remarks,
      downloadFileName: `${payment.feeReceipt.receiptNo}.pdf`,
      school: {
        id: payment.school.id,
        schoolCode: payment.school.schoolCode,
        name: payment.school.name,
        contactEmail: payment.school.email,
        contactPhone: payment.school.phone,
        address: this.getAddress(payment.school.addressJson),
        branding: {
          logoUrl: branding.logoUrl ?? null,
          primaryColor: branding.primaryColor ?? null,
          secondaryColor: branding.secondaryColor ?? null,
          website: branding.website ?? null,
          supportEmail: branding.supportEmail ?? null,
        },
      },
      student: {
        id: payment.feeAssignment.student.id,
        name: payment.feeAssignment.student.fullName,
        studentCode: payment.feeAssignment.student.studentCode,
        className: currentEnrollment?.academicClass?.className ?? null,
        classCode: currentEnrollment?.academicClass?.classCode ?? null,
        sectionName: currentEnrollment?.section?.sectionName ?? null,
      },
      fee: {
        id: payment.feeAssignment.feeStructure.id,
        name: payment.feeAssignment.feeStructure.feeName,
        feeCode: payment.feeAssignment.feeStructure.feeCode,
        category: payment.feeAssignment.feeStructure.feeCategory,
        session: payment.feeAssignment.academicSession
          ? {
              id: payment.feeAssignment.academicSession.id,
              name: payment.feeAssignment.academicSession.sessionName,
              isCurrent: payment.feeAssignment.academicSession.isCurrent,
            }
          : null,
        assignedAmount: payment.feeAssignment.assignedAmount.toNumber(),
        concessionAmount: payment.feeAssignment.concessionAmount.toNumber(),
        netAmount: payment.feeAssignment.netAmount.toNumber(),
        paidBeforeThisReceipt: previousPaidAmount.toNumber(),
        paidAfterThisReceipt: payment.feeAssignment.paidAmount.toNumber(),
        dueAfterThisReceipt: dueAfterPayment.toNumber(),
      },
      receivedBy: payment.feeReceipt.receivedByUser
        ? {
            id: payment.feeReceipt.receivedByUser.id,
            name: payment.feeReceipt.receivedByUser.fullName,
          }
        : null,
      template: {
        receiptTitle: template.receiptTitle ?? 'Fee Payment Receipt',
        receiptSubtitle:
          template.receiptSubtitle ?? 'Official acknowledgement of fee payment',
        headerNote:
          template.headerNote ??
          'Thank you for your payment. Please keep this receipt for your records.',
        footerNote:
          template.footerNote ??
          'This is a system-generated receipt and is valid without a physical stamp.',
        termsAndConditions:
          template.termsAndConditions ??
          'Fees once paid are subject to the school fee policy and may not be refundable.',
        signatureLabel: template.signatureLabel ?? 'Authorized Signatory',
        showLogo: template.showLogo ?? true,
        showSignature: template.showSignature ?? true,
        customFields: Array.isArray(template.customFields)
          ? template.customFields
              .filter(
                (field) =>
                  field &&
                  typeof field === 'object' &&
                  !Array.isArray(field) &&
                  typeof field.label === 'string' &&
                  typeof field.value === 'string',
              )
              .map((field) => ({
                label: String(field.label),
                value: String(field.value),
              }))
          : [],
      },
    };
  }

  private getSettingsJson(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, any>;
    }

    return value as Record<string, any>;
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

  private getReceiptTemplateSettings(settingsJson: Record<string, any>) {
    if (
      !settingsJson.feeReceiptTemplate ||
      typeof settingsJson.feeReceiptTemplate !== 'object' ||
      Array.isArray(settingsJson.feeReceiptTemplate)
    ) {
      return {} as Record<string, any>;
    }

    return settingsJson.feeReceiptTemplate as Record<string, any>;
  }

  private getAddress(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        line1: null,
        line2: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
      };
    }

    const address = value as Record<string, unknown>;

    return {
      line1: typeof address.line1 === 'string' ? address.line1 : null,
      line2: typeof address.line2 === 'string' ? address.line2 : null,
      city: typeof address.city === 'string' ? address.city : null,
      state: typeof address.state === 'string' ? address.state : null,
      country: typeof address.country === 'string' ? address.country : null,
      postalCode: typeof address.postalCode === 'string' ? address.postalCode : null,
    };
  }
}
