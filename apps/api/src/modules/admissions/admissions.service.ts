import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionStatus,
  AdmissionApplicationStatus,
  Prisma,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { StudentsService } from '../students/students.service';
import { AdmissionQueryDto } from './dto/admission-query.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { CreatePublicAdmissionInquiryDto } from './dto/create-public-admission-inquiry.dto';
import { EnrollAdmissionDto } from './dto/enroll-admission.dto';
import { UpdateAdmissionStatusDto } from './dto/update-admission-status.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const admissionApplicationInclude =
  Prisma.validator<Prisma.AdmissionApplicationInclude>()({
    school: {
      select: {
        id: true,
        name: true,
        schoolCode: true,
      },
    },
    student: {
      select: {
        id: true,
        fullName: true,
        registrationNumber: true,
        studentCode: true,
      },
    },
  });

type AdmissionApplicationRecord = Prisma.AdmissionApplicationGetPayload<{
  include: typeof admissionApplicationInclude;
}>;

const allowedTransitions: Record<
  AdmissionApplicationStatus,
  AdmissionApplicationStatus[]
> = {
  INQUIRY: ['APPLIED', 'REJECTED'],
  APPLIED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  ENROLLED: [],
  REJECTED: [],
};

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly studentsService: StudentsService,
  ) {}

  async create(currentUser: JwtUser, dto: CreateAdmissionDto) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const dob = this.parseDate(dto.dob, 'dob');

    const application = await this.prisma.admissionApplication.create({
      data: {
        schoolId,
        studentName: dto.studentName.trim(),
        fatherName: dto.fatherName.trim(),
        motherName: dto.motherName.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        address: dto.address.trim(),
        classApplied: dto.classApplied.trim(),
        previousSchool: dto.previousSchool?.trim() ?? null,
        dob,
        status: AdmissionApplicationStatus.INQUIRY,
        remarks: dto.remarks?.trim() ?? null,
      },
      include: admissionApplicationInclude,
    });

    await this.auditService.write({
      action: 'admissions.create',
      entity: 'admission_application',
      entityId: application.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        studentName: application.studentName,
        classApplied: application.classApplied,
        status: application.status,
      },
    });

    return {
      success: true,
      message: 'Admission application created successfully.',
      data: this.serializeAdmission(application),
    };
  }

  async findPublicSchoolOptions() {
    const schools = await this.prisma.school.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        schoolCode: true,
      },
      orderBy: [
        {
          name: 'asc',
        },
      ],
    });

    return {
      success: true,
      message: 'Admission inquiry schools fetched successfully.',
      data: schools,
    };
  }

  async createPublicInquiry(dto: CreatePublicAdmissionInquiryDto) {
    const school = await this.prisma.school.findFirst({
      where: {
        id: dto.schoolId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!school) {
      throw new NotFoundException('Selected school is not available for inquiries.');
    }

    const dob = this.parseDate(dto.dob, 'dob');

    const application = await this.prisma.admissionApplication.create({
      data: {
        schoolId: school.id,
        studentName: dto.studentName.trim(),
        fatherName: dto.fatherName.trim(),
        motherName: dto.motherName.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        address: dto.address.trim(),
        classApplied: dto.classApplied.trim(),
        previousSchool: dto.previousSchool?.trim() ?? null,
        dob,
        status: AdmissionApplicationStatus.INQUIRY,
        remarks: dto.remarks?.trim() ?? null,
      },
      include: admissionApplicationInclude,
    });

    await this.auditService.write({
      action: 'admissions.public_inquiry.create',
      entity: 'admission_application',
      entityId: application.id,
      schoolId: school.id,
      metadata: {
        source: 'public_apply_page',
        studentName: application.studentName,
        classApplied: application.classApplied,
        status: application.status,
      },
    });

    return {
      success: true,
      message: 'Your admission inquiry has been submitted successfully.',
      data: this.serializeAdmission(application),
    };
  }

  async findAll(currentUser: JwtUser, query: AdmissionQueryDto) {
    const schoolId = this.resolveReadSchoolScope(currentUser, query.schoolId);
    const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const search = query.search?.trim() ?? '';

    const where: Prisma.AdmissionApplicationWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              {
                studentName: {
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

    const [items, total] = await Promise.all([
      this.prisma.admissionApplication.findMany({
        where,
        include: admissionApplicationInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.admissionApplication.count({ where }),
    ]);

    return {
      success: true,
      message: 'Admission applications fetched successfully.',
      data: items.map((item) => this.serializeAdmission(item)),
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(currentUser: JwtUser, id: string, schoolId?: string | null) {
    const resolvedSchoolId = this.resolveReadSchoolScope(currentUser, schoolId);
    const application = await this.getAdmissionByIdScoped(id, resolvedSchoolId);

    return {
      success: true,
      message: 'Admission application fetched successfully.',
      data: this.serializeAdmission(application),
    };
  }

  async updateStatus(
    currentUser: JwtUser,
    id: string,
    dto: UpdateAdmissionStatusDto,
  ) {
    const schoolId = this.resolveWriteSchoolScope(currentUser, dto.schoolId);
    const application = await this.getAdmissionByIdScoped(id, schoolId);

    if (application.status !== dto.status) {
      const nextStatuses = allowedTransitions[application.status];

      if (!nextStatuses.includes(dto.status)) {
        throw new BadRequestException(
          `Admission status cannot be changed from ${application.status} to ${dto.status}.`,
        );
      }
    }

    const updatedApplication = await this.prisma.admissionApplication.update({
      where: {
        id: application.id,
      },
      data: {
        status: dto.status,
        ...(dto.remarks !== undefined ? { remarks: dto.remarks ?? null } : {}),
      },
      include: admissionApplicationInclude,
    });

    await this.auditService.write({
      action: 'admissions.status.update',
      entity: 'admission_application',
      entityId: updatedApplication.id,
      actorUserId: currentUser.id,
      schoolId,
      metadata: {
        studentName: updatedApplication.studentName,
        previousStatus: application.status,
        nextStatus: updatedApplication.status,
      },
    });

    return {
      success: true,
      message: 'Admission application status updated successfully.',
      data: this.serializeAdmission(updatedApplication),
    };
  }

  async enroll(
    currentUser: JwtUser,
    id: string,
    dto: EnrollAdmissionDto = {},
  ) {
    const admission = await this.getAdmissionByIdScoped(
      id,
      this.resolveMutationSchoolScope(currentUser),
    );

    if (admission.status === AdmissionApplicationStatus.ENROLLED) {
      throw new BadRequestException(
        'This admission application has already been enrolled.',
      );
    }

    if (admission.status !== AdmissionApplicationStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved admission applications can be enrolled.',
      );
    }

    const normalizedEnrollmentEmail =
      dto.email?.trim().toLowerCase() ?? admission.email ?? undefined;
    const normalizedPortalPassword = dto.portalPassword?.trim() ?? undefined;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const currentSession = await tx.academicSession.findFirst({
          where: {
            schoolId: admission.schoolId,
            isCurrent: true,
            isActive: true,
          },
          select: {
            id: true,
            sessionName: true,
          },
        });

        if (!currentSession) {
          throw new BadRequestException(
            'No active current academic session found for this school.',
          );
        }

        const targetClass = await this.resolveAppliedClass(
          tx,
          admission.schoolId,
          admission.classApplied,
        );

        const existingStudent = admission.studentId
          ? await tx.student.findFirst({
              where: {
                id: admission.studentId,
                schoolId: admission.schoolId,
              },
              select: {
                id: true,
              },
            })
          : null;

        if (admission.studentId && !existingStudent) {
          throw new BadRequestException(
            'Admission is linked to an invalid student record.',
          );
        }

        if (existingStudent) {
          const existingEnrollment = await tx.admission.findFirst({
            where: {
              schoolId: admission.schoolId,
              studentId: existingStudent.id,
              sessionId: currentSession.id,
            },
            select: {
              id: true,
            },
          });

          if (existingEnrollment) {
            throw new BadRequestException(
              'This admission application has already been enrolled.',
            );
          }
        }

        const createdStudent = existingStudent
          ? await tx.student.findUniqueOrThrow({
              where: {
                id: existingStudent.id,
              },
              include: {
                admissions: {
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 1,
                  include: {
                    academicClass: {
                      select: {
                        id: true,
                        className: true,
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
            })
          : await this.studentsService.createStudentTransactional(tx, admission.schoolId, {
              name: admission.studentName,
              email: normalizedEnrollmentEmail,
              phone: admission.phone,
              dateOfBirth: admission.dob.toISOString().slice(0, 10),
              joinedOn: new Date().toISOString().slice(0, 10),
              classId: targetClass.id,
              sessionId: currentSession.id,
              portalPassword: normalizedPortalPassword,
            });

        if (existingStudent) {
          const latestAdmissionNo =
            (
              await tx.admission.findFirst({
                where: {
                  schoolId: admission.schoolId,
                  studentId: existingStudent.id,
                },
                orderBy: {
                  createdAt: 'desc',
                },
                select: {
                  admissionNo: true,
                },
              })
            )?.admissionNo ?? undefined;

          await tx.admission.create({
            data: {
              schoolId: admission.schoolId,
              studentId: existingStudent.id,
              sessionId: currentSession.id,
              classId: targetClass.id,
              sectionId: null,
              admissionNo:
                latestAdmissionNo ??
                `ADM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              admissionDate: new Date(),
              admissionStatus: AdmissionStatus.ACTIVE,
              previousSchool: admission.previousSchool ?? null,
              remarks: `Created from admission application ${admission.id}.`,
            },
          });
        }

        const updatedAdmission = await tx.admissionApplication.update({
          where: {
            id: admission.id,
          },
          data: {
            status: AdmissionApplicationStatus.ENROLLED,
            studentId: createdStudent.id,
            ...(normalizedEnrollmentEmail
              ? {
                  email: normalizedEnrollmentEmail,
                }
              : {}),
            remarks:
              admission.remarks?.trim()
                ? `${admission.remarks.trim()}\nEnrolled on ${new Date().toISOString()}.`
                : `Enrolled on ${new Date().toISOString()}.`,
          },
          include: admissionApplicationInclude,
        });

        return {
          application: updatedAdmission,
          student: createdStudent,
          currentSession,
          targetClass,
        };
      },
      {
        maxWait: 10_000,
        timeout: 20_000,
      },
    );

    await this.auditService.write({
      action: 'admissions.enroll',
      entity: 'admission_application',
      entityId: result.application.id,
      actorUserId: currentUser.id,
      schoolId: admission.schoolId,
      metadata: {
        studentName: result.application.studentName,
        studentId: result.student.id,
        registrationNumber: result.student.registrationNumber ?? null,
        sessionId: result.currentSession.id,
        classId: result.targetClass.id,
      },
    });

    return {
      success: true,
      message: 'Admission enrolled successfully.',
      data: {
        admission: this.serializeAdmission(result.application),
        student: {
          id: result.student.id,
          name: result.student.fullName,
          registrationNumber: result.student.registrationNumber,
          studentCode: result.student.studentCode,
        },
      },
    };
  }

  private async getAdmissionByIdScoped(id: string, schoolId?: string | null) {
    const admission = await this.prisma.admissionApplication.findFirst({
      where: {
        id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: admissionApplicationInclude,
    });

    if (!admission) {
      throw new NotFoundException('Admission application not found.');
    }

    return admission;
  }

  private async resolveAppliedClass(
    tx: Prisma.TransactionClient,
    schoolId: string,
    classApplied: string,
  ) {
    const normalizedAppliedClass = classApplied.trim().toLowerCase();
    const classes = await tx.academicClass.findMany({
      where: {
        schoolId,
        isActive: true,
      },
      select: {
        id: true,
        className: true,
        classCode: true,
      },
    });

    const matchedClass = classes.find((academicClass) => {
      const className = academicClass.className.trim().toLowerCase();
      const classCode = academicClass.classCode.trim().toLowerCase();

      return (
        className === normalizedAppliedClass ||
        classCode === normalizedAppliedClass
      );
    });

    if (!matchedClass) {
      throw new BadRequestException(
        'The applied class does not exist as an active class in this school.',
      );
    }

    return matchedClass;
  }

  private resolveReadSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return schoolId ?? null;
    }

    if (!currentUser.schoolId) {
      throw new BadRequestException(
        'A school-scoped user is required to access admission applications.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Admission application not found.');
    }

    return currentUser.schoolId;
  }

  private resolveMutationSchoolScope(currentUser: JwtUser) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      return null;
    }

    if (!currentUser.schoolId) {
      throw new BadRequestException(
        'A school-scoped user is required to manage admission applications.',
      );
    }

    return currentUser.schoolId;
  }

  private resolveWriteSchoolScope(currentUser: JwtUser, schoolId?: string | null) {
    if (currentUser.role === RoleType.SUPER_ADMIN) {
      if (!schoolId) {
        throw new BadRequestException(
          'schoolId is required for platform-scoped super admin admission writes.',
        );
      }

      return schoolId;
    }

    if (!currentUser.schoolId) {
      throw new BadRequestException(
        'A school-scoped user is required to manage admission applications.',
      );
    }

    if (schoolId && schoolId !== currentUser.schoolId) {
      throw new NotFoundException('Admission application not found.');
    }

    return currentUser.schoolId;
  }

  private parseDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }

    return parsed;
  }

  private serializeAdmission(admission: AdmissionApplicationRecord) {
    return {
      id: admission.id,
      schoolId: admission.schoolId,
      school: admission.school
        ? {
            id: admission.school.id,
            name: admission.school.name,
            schoolCode: admission.school.schoolCode,
          }
        : null,
      studentName: admission.studentName,
      fatherName: admission.fatherName,
      motherName: admission.motherName,
      phone: admission.phone,
      email: admission.email,
      address: admission.address,
      classApplied: admission.classApplied,
      previousSchool: admission.previousSchool,
      dob: admission.dob.toISOString(),
      status: admission.status,
      remarks: admission.remarks,
      studentId: admission.studentId,
      student: admission.student
        ? {
            id: admission.student.id,
            name: admission.student.fullName,
            registrationNumber: admission.student.registrationNumber,
            studentCode: admission.student.studentCode,
          }
        : null,
      createdAt: admission.createdAt.toISOString(),
      updatedAt: admission.updatedAt.toISOString(),
    };
  }
}
