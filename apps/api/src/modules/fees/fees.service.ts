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
        select: { id: true, className: true, classCode: true },
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
        })),
        students: students.map((student) => ({
          id: student.id,
          name: student.fullName,
          studentCode: student.studentCode,
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
    const [student, feeStructure] = await Promise.all([
      this.ensureStudentInSchool(schoolId, dto.studentId),
      this.prisma.feeStructure.findFirst({
        where: {
          id: dto.feeStructureId,
          schoolId,
          isActive: true,
        },
        include: feeStructureInclude,
      }),
    ]);

    if (!feeStructure) {
      throw new NotFoundException('Fee structure not found for this school.');
    }

    const session = await this.resolveAcademicSession(
      schoolId,
      dto.sessionId ?? feeStructure.sessionId,
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

    const feeAssignment = await this.prisma.feeAssignment.upsert({
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
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : feeStructure.dueDate ?? null,
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
        dueDate: dto.dueDate
          ? new Date(dto.dueDate)
          : feeStructure.dueDate ?? null,
        status: FeeAssignmentStatus.PENDING,
      },
      include: feeAssignmentInclude,
    });

    await this.invalidateFeeCaches(schoolId);
    await this.auditService.write({
      action: 'fees.assign',
      entity: 'fee_assignment',
      entityId: feeAssignment.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        studentId: student.id,
        feeStructureId: feeStructure.id,
        netAmount: netAmount.toString(),
      },
    });

    return {
      success: true,
      data: this.serializeFeeAssignment(feeAssignment),
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
    const cacheKey = this.buildCacheKey('student-fees', student.schoolId, {
      studentId: student.id,
      page,
      limit,
      search,
      status: query.status,
    });

    const payload = await this.redisService.remember(
      cacheKey,
      FEE_LIST_TTL_SECONDS,
      async () => {
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
          items: items.map((item) => this.serializeFeeAssignment(item)),
          meta: { page, limit, total },
          student: {
            id: student.id,
            name: student.fullName,
            studentCode: student.studentCode,
          },
        };
      },
    );

    return {
      success: true,
      data: payload.items,
      meta: payload.meta,
      student: payload.student,
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

  private async ensureUniqueFeeStructure(
    schoolId: string,
    sessionId: string,
    feeCode: string,
  ) {
    const existingFee = await this.prisma.feeStructure.findFirst({
      where: {
        schoolId,
        sessionId,
        feeCode: {
          equals: feeCode,
          mode: 'insensitive',
        },
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
      status: feeAssignment.status,
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
}
