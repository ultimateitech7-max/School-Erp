import { clearAuthSession, getAccessToken } from './auth-storage';

export const API_URL = resolveApiUrl();

interface ApiFetchOptions extends RequestInit {
  auth?: boolean;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'TEACHER'
  | 'STUDENT'
  | 'STAFF'
  | 'PARENT';
export type UserType = 'ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type ParentRelationType =
  | 'FATHER'
  | 'MOTHER'
  | 'GUARDIAN'
  | 'BROTHER'
  | 'SISTER'
  | 'RELATIVE'
  | 'OTHER';
export type SubjectType = 'THEORY' | 'PRACTICAL' | 'BOTH';
export type FeeFrequency =
  | 'ONE_TIME'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'ANNUAL';
export type FeeCategory =
  | 'TUITION'
  | 'ADMISSION'
  | 'TRANSPORT'
  | 'EXAM'
  | 'LIBRARY'
  | 'HOSTEL'
  | 'OTHER';
export type FeeAssignmentStatus =
  | 'PENDING'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'WAIVED'
  | 'CANCELLED';
export type PaymentMode =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'CHEQUE'
  | 'ONLINE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
export type ExamType = 'UNIT' | 'MIDTERM' | 'FINAL' | 'PRACTICAL' | 'OTHER';
export type ExamStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ONGOING'
  | 'PUBLISHED'
  | 'CLOSED';
export type AcademicSessionStatus = 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
export type AdmissionApplicationStatus =
  | 'INQUIRY'
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ENROLLED'
  | 'REJECTED';
export type NoticeAudienceType = 'ALL' | 'STUDENTS' | 'PARENTS' | 'STAFF';
export type HolidayType = 'HOLIDAY' | 'EVENT';

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiSuccessResponse<T, M = ApiMeta> {
  success: true;
  message: string;
  data: T;
  meta?: M;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  roleCode: string;
  userType: UserType;
  designation: string | null;
  schoolId: string | null;
  isActive: boolean;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleOption {
  code: UserRole;
  label: string;
  type: UserRole;
  userType: UserType;
}

export interface UserSchoolOption {
  id: string;
  name: string;
}

export interface UserOptionsPayload {
  currentSchoolId: string | null;
  roles: UserRoleOption[];
  userTypes: UserType[];
  schools: UserSchoolOption[];
}

export interface UserFormPayload {
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  userType?: UserType;
  designation?: string;
  isActive?: boolean;
  schoolId?: string;
}

export interface StudentRecord {
  id: string;
  name: string;
  registrationNumber: string | null;
  admissionNo: string | null;
  studentCode: string;
  email?: string | null;
  phone?: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  joinedOn?: string | null;
  sessionId?: string | null;
  session?: {
    id: string;
    name: string;
    isCurrent: boolean;
    isActive: boolean;
  } | null;
  class?: {
    id: string;
    name: string;
  } | null;
  section?: {
    id: string;
    name: string;
  } | null;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface StudentClassOption {
  id: string;
  name: string;
  sections: StudentSectionOption[];
}

export interface StudentSectionOption {
  id: string;
  name: string;
}

export interface StudentOptionsPayload {
  currentSessionId: string | null;
  currentSessionName: string | null;
  classes: StudentClassOption[];
}

export interface StudentFormPayload {
  name: string;
  admissionNo?: string;
  email?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  classId?: string;
  sectionId?: string;
  sessionId?: string;
}

export interface StudentHistoryBasicRecord extends StudentRecord {}

export interface StudentEnrollmentHistoryRecord {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  status: string;
  admissionDate: string;
  session: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    isActive: boolean;
  };
  class: {
    id: string;
    name: string;
    classCode: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
}

export interface StudentAttendanceHistorySessionRecord {
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
}

export interface StudentAttendanceHistorySummary {
  overall: {
    totalDays: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number;
  };
  bySession: StudentAttendanceHistorySessionRecord[];
}

export interface StudentFeeHistorySessionRecord {
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  assignmentsCount: number;
  totalAssigned: number;
  totalPaid: number;
  totalDue: number;
}

export interface StudentFeeHistorySummary {
  overall: {
    assignmentsCount: number;
    totalAssigned: number;
    totalPaid: number;
    totalDue: number;
  };
  bySession: StudentFeeHistorySessionRecord[];
}

export interface StudentResultHistoryRecord {
  id: string;
  examId: string;
  examName: string;
  examCode: string;
  examType: string;
  startDate: string;
  endDate: string;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface StudentResultHistorySessionRecord {
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  examCount: number;
  averagePercentage: number;
  results: StudentResultHistoryRecord[];
}

export interface StudentResultHistorySummary {
  overall: {
    examCount: number;
    totalMarks: number;
    obtainedMarks: number;
    averagePercentage: number;
  };
  bySession: StudentResultHistorySessionRecord[];
}

export interface StudentHistoryPayload {
  student: StudentHistoryBasicRecord;
  enrollmentHistory: StudentEnrollmentHistoryRecord[];
  promotionHistory: PromotionRecord[];
  attendanceSummary: StudentAttendanceHistorySummary;
  feeSummary: StudentFeeHistorySummary;
  resultSummary: StudentResultHistorySummary;
}

export interface AcademicSectionPreview {
  id: string;
  name: string;
  roomNo: string | null;
  capacity: number | null;
  status: UserStatus;
}

export interface AcademicClassSubjectPreview {
  id: string;
  subjectCode: string;
  name: string;
  subjectType: SubjectType;
  isOptional: boolean;
  isMandatory: boolean;
  periodsPerWeek: number | null;
  sessionId: string;
  sessionName: string;
}

export interface AcademicClassRecord {
  id: string;
  classCode: string;
  name: string;
  className: string;
  gradeLevel: number | null;
  sortOrder: number;
  schoolId: string;
  status: UserStatus;
  isActive: boolean;
  sections: AcademicSectionPreview[];
  subjects: AcademicClassSubjectPreview[];
  createdAt: string;
  updatedAt: string;
}

export interface AcademicClassFormPayload {
  className: string;
  classCode?: string;
  gradeLevel?: number;
  sortOrder?: number;
  isActive?: boolean;
  schoolId?: string;
}

export interface SectionRecord {
  id: string;
  name: string;
  sectionName: string;
  roomNo: string | null;
  capacity: number | null;
  schoolId: string;
  status: UserStatus;
  isActive: boolean;
  class: {
    id: string;
    classCode: string;
    className: string;
    gradeLevel: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SectionFormPayload {
  classId: string;
  sectionName: string;
  roomNo?: string;
  capacity?: number;
  isActive?: boolean;
  schoolId?: string;
}

export interface SubjectRecord {
  id: string;
  subjectCode: string;
  name: string;
  subjectName: string;
  subjectType: SubjectType;
  isOptional: boolean;
  schoolId: string;
  status: UserStatus;
  isActive: boolean;
  classes: Array<{
    id: string;
    classCode: string;
    className: string;
    sessionId: string;
    sessionName: string;
    isMandatory: boolean;
    periodsPerWeek: number | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectFormPayload {
  subjectName: string;
  subjectCode?: string;
  subjectType?: SubjectType;
  isOptional?: boolean;
  isActive?: boolean;
  schoolId?: string;
}

export interface AssignClassSubjectsPayload {
  subjects: Array<{
    subjectId: string;
    isMandatory?: boolean;
    periodsPerWeek?: number;
  }>;
  sessionId?: string;
}

export interface FeeClassOption {
  id: string;
  name: string;
  classCode: string;
}

export interface FeeStudentOption {
  id: string;
  name: string;
  studentCode: string;
}

export interface FeesOptionsPayload {
  currentSessionId: string;
  currentSessionName: string;
  classes: FeeClassOption[];
  students: FeeStudentOption[];
  feeCategories: FeeCategory[];
  feeFrequencies: FeeFrequency[];
  paymentModes: PaymentMode[];
  assignmentStatuses: FeeAssignmentStatus[];
}

export interface FeeStructureRecord {
  id: string;
  schoolId: string;
  sessionId: string;
  classId: string | null;
  feeCode: string;
  name: string;
  category: FeeCategory;
  frequency: FeeFrequency;
  amount: number;
  dueDate: string | null;
  lateFeePerDay: number;
  isOptional: boolean;
  class: {
    id: string;
    className: string;
    classCode: string;
  } | null;
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureFormPayload {
  sessionId?: string;
  classId?: string;
  feeCode?: string;
  name: string;
  category?: FeeCategory;
  frequency?: FeeFrequency;
  amount: number;
  dueDate?: string;
  lateFeePerDay?: number;
  isOptional?: boolean;
}

export interface StudentFeeRecord {
  id: string;
  studentFeeId: string;
  schoolId: string;
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
  feeStructure: FeeStructureRecord;
  totalAmount: number;
  concessionAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: FeeAssignmentStatus;
  dueDate: string | null;
  assignedAt: string;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    receiptNo: string;
    paymentMethod: PaymentMode;
    reference: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AssignFeePayload {
  studentId: string;
  feeStructureId: string;
  sessionId?: string;
  totalAmount?: number;
  concessionAmount?: number;
  dueDate?: string;
}

export interface PaymentRecord {
  id: string;
  schoolId: string;
  studentFeeId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMode;
  reference: string | null;
  receiptNo: string;
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
  feeStructure: {
    id: string;
    name: string;
    feeCode: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RecordPaymentPayload {
  studentFeeId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: PaymentMode;
  reference?: string;
  notes?: string;
}

export interface AttendanceClassOption {
  id: string;
  name: string;
  classCode: string;
  sections: AttendanceSectionOption[];
}

export interface AttendanceSectionOption {
  id: string;
  name: string;
}

export interface AttendanceStudentOption {
  id: string;
  name: string;
  studentCode: string;
  classId: string | null;
  sectionId: string | null;
}

export interface AttendanceOptionsPayload {
  currentSessionId: string;
  currentSessionName: string;
  classes: AttendanceClassOption[];
  students: AttendanceStudentOption[];
  statuses: AttendanceStatus[];
}

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  sessionId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  remarks: string | null;
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
  class: {
    id: string;
    className: string;
    classCode: string;
  };
  section: {
    id: string;
    sectionName: string;
  } | null;
  session: {
    id: string;
    sessionName: string;
    isCurrent: boolean;
  };
  markedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSummaryRecord {
  total: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeave: number;
}

export interface AttendanceFormPayload {
  studentId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  classId?: string;
  sectionId?: string;
  remarks?: string;
  sessionId?: string;
}

export interface BulkAttendancePayload {
  classId: string;
  sectionId?: string;
  attendanceDate: string;
  sessionId?: string;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  remarks?: string;
}

export interface ExamClassOption {
  id: string;
  name: string;
  classCode: string;
}

export interface ExamSubjectOption {
  id: string;
  name: string;
  subjectCode: string;
  subjectType: SubjectType;
}

export interface ExamStudentOption {
  id: string;
  name: string;
  studentCode: string;
  classId: string | null;
  sectionId: string | null;
}

export interface ExamsOptionsPayload {
  currentSessionId: string;
  currentSessionName: string;
  examTypes: ExamType[];
  examStatuses: ExamStatus[];
  classes: ExamClassOption[];
  subjects: ExamSubjectOption[];
  students: ExamStudentOption[];
}

export interface ExamSubjectRecord {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectType: SubjectType;
  examDate: string | null;
  maxMarks: number;
  passMarks: number;
}

export interface ExamRecord {
  id: string;
  schoolId: string;
  sessionId: string;
  examCode: string;
  examName: string;
  examType: ExamType;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  class: {
    id: string;
    className: string;
    classCode: string;
  } | null;
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  };
  subjects: ExamSubjectRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamFormPayload {
  sessionId?: string;
  classId?: string;
  examCode?: string;
  examName: string;
  examType?: ExamType;
  startDate: string;
  endDate: string;
  status?: ExamStatus;
  subjects: Array<{
    subjectId: string;
    maxMarks: number;
    passMarks: number;
    examDate?: string;
  }>;
}

export interface MarksEntryPayload {
  entries: Array<{
    studentId: string;
    subjectId: string;
    marksObtained?: number;
    maxMarks?: number;
    grade?: string;
    remarks?: string;
    isAbsent?: boolean;
  }>;
}

export interface ExamResultRow {
  id: string;
  examId: string;
  student: {
    id: string;
    name: string;
    studentCode: string;
    email: string | null;
  };
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  overallGrade: string | null;
  exam: {
    id: string;
    examName: string;
    examCode: string;
    examType: ExamType;
    startDate: string;
    endDate: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExamResultsPayload {
  exam: ExamRecord;
  results: ExamResultRow[];
}

export interface StudentResultsPayload {
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
  results: ExamResultRow[];
}

export interface SchoolAddressPayload {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  [key: string]: unknown;
}

export interface SchoolSettingsRecord {
  schoolId: string;
  schoolCode: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  timezone: string;
  address: SchoolAddressPayload;
  principalName: string | null;
  academicSessionLabel: string | null;
}

export interface SchoolBrandingRecord {
  schoolId: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  website: string | null;
  supportEmail: string | null;
}

export interface SchoolModuleToggleRecord {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  linkedModuleCode: string | null;
  source: 'school_module' | 'settings_json';
}

export interface SchoolSettingsFormPayload {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone?: string;
  address?: SchoolAddressPayload;
  principalName?: string;
  academicSessionLabel?: string;
  schoolId?: string;
}

export interface SchoolBrandingFormPayload {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  website?: string;
  supportEmail?: string;
  schoolId?: string;
}

export interface SchoolModulesFormPayload {
  schoolId?: string;
  modules: Array<{
    key: string;
    enabled: boolean;
  }>;
}

export interface DashboardRecentActivityRecord {
  id: string;
  type: 'student' | 'user' | 'payment' | 'exam';
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardOverviewRecord {
  schoolId: string | null;
  totals: {
    students: number;
    teachers: number;
    staff: number;
    classes: number;
    subjects: number;
    exams: number;
  };
  attendanceToday: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
  };
  fees: {
    collected: number;
    pending: number;
    assigned: number;
    paymentCount: number;
  };
  recentActivities: DashboardRecentActivityRecord[];
}

export interface DashboardAttendancePoint {
  label: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
}

export interface DashboardAttendanceRecord {
  schoolId: string | null;
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
  };
  chart: DashboardAttendancePoint[];
}

export interface DashboardFeePoint {
  label: string;
  total: number;
}

export interface DashboardFeesRecord {
  schoolId: string | null;
  totals: {
    collected: number;
    pending: number;
    assigned: number;
    paymentCount: number;
  };
  chart: DashboardFeePoint[];
}

export interface DashboardClassDistributionRecord {
  id: string;
  classCode: string;
  className: string;
  totalStudents: number;
}

export interface DashboardClassesRecord {
  schoolId: string | null;
  totalClasses: number;
  distribution: DashboardClassDistributionRecord[];
}

export interface DashboardExamSummaryRecord {
  total: number;
  draft: number;
  scheduled: number;
  ongoing: number;
  published: number;
  closed: number;
  averagePercentage: number;
}

export interface DashboardExamRecord {
  id: string;
  examCode: string;
  examName: string;
  status: ExamStatus;
  startDate: string;
  endDate: string;
  class: {
    id: string;
    name: string;
    classCode: string;
  } | null;
}

export interface DashboardExamsRecord {
  schoolId: string | null;
  summary: DashboardExamSummaryRecord;
  recentExams: DashboardExamRecord[];
}

export interface AcademicSessionRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
  status: AcademicSessionStatus;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSessionFormPayload {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  isActive?: boolean;
  status?: AcademicSessionStatus;
  schoolId?: string;
}

export interface AdmissionApplicationRecord {
  id: string;
  schoolId: string;
  studentId: string | null;
  school: {
    id: string;
    name: string;
    schoolCode: string;
  } | null;
  student: {
    id: string;
    name: string;
    registrationNumber: string | null;
    studentCode: string;
  } | null;
  studentName: string;
  fatherName: string;
  motherName: string;
  phone: string;
  email: string | null;
  address: string;
  classApplied: string;
  previousSchool: string | null;
  dob: string;
  status: AdmissionApplicationStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionFormPayload {
  studentName: string;
  fatherName: string;
  motherName: string;
  phone: string;
  email?: string;
  address: string;
  classApplied: string;
  previousSchool?: string;
  dob: string;
  remarks?: string;
  schoolId?: string;
}

export interface ParentLinkedStudentRecord {
  id: string;
  name: string;
  registrationNumber: string | null;
  relationType: ParentRelationType;
  class: {
    id: string;
    name: string;
  } | null;
  section: {
    id: string;
    name: string;
  } | null;
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  } | null;
}

export interface ParentRecord {
  id: string;
  schoolId: string;
  userId: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  relationType: ParentRelationType;
  emergencyContact: string | null;
  childrenCount: number;
  linkedStudents: ParentLinkedStudentRecord[];
  portalAccess: {
    userId: string;
    email: string;
    isActive: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParentFormPayload {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  relationType: ParentRelationType;
  emergencyContact?: string;
  portalPassword?: string;
  schoolId?: string;
}

export interface ParentStudentLinkPayload {
  studentId: string;
  relationType?: ParentRelationType;
}

export interface ParentDashboardChildRecord {
  id: string;
  name: string;
  registrationNumber: string | null;
  relationType: ParentRelationType;
  class: {
    id: string;
    name: string;
  } | null;
  section: {
    id: string;
    name: string;
  } | null;
  feeSummary: {
    totalAssigned: number;
    totalPaid: number;
    totalDue: number;
  };
  attendanceSummary: {
    totalDays: number;
    present: number;
    percentage: number;
  };
}

export interface ParentDashboardPayload {
  parent: ParentRecord;
  children: ParentDashboardChildRecord[];
  notices: NoticeRecord[];
  holidays: HolidayRecord[];
}

export interface PortalCurrentEnrollmentRecord {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  status: string;
  admissionDate: string;
  session: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    isActive: boolean;
  };
  class: {
    id: string;
    name: string;
    classCode: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
}

export interface PortalPaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  remarks: string | null;
  receiptNo: string;
  paymentMode: PaymentMode;
  feeName: string;
  session: {
    id: string;
    name: string;
    isCurrent: boolean;
  } | null;
}

export interface StudentPortalDashboardPayload {
  student: StudentRecord;
  currentEnrollment: PortalCurrentEnrollmentRecord | null;
  attendanceSummary: StudentAttendanceHistorySummary;
  feeSummary: StudentFeeHistorySummary;
  resultSummary: StudentResultHistorySummary;
  homework: HomeworkRecord[];
  holidays: HolidayRecord[];
  notices: NoticeRecord[];
}

export interface ParentPortalDetailPayload {
  student: StudentRecord;
  attendanceSummary?: StudentAttendanceHistorySummary;
  feeSummary?: StudentFeeHistorySummary;
  paymentHistory?: PortalPaymentRecord[];
  resultSummary?: StudentResultHistorySummary;
}

export interface StudentPortalAttendancePayload {
  student: StudentRecord;
  attendanceSummary: StudentAttendanceHistorySummary;
}

export interface StudentPortalFeesPayload {
  student: StudentRecord;
  feeSummary: StudentFeeHistorySummary;
  paymentHistory: PortalPaymentRecord[];
}

export interface StudentPortalResultsPayload {
  student: StudentRecord;
  resultSummary: StudentResultHistorySummary;
}

export interface StudentPortalHomeworkPayload {
  student: StudentRecord;
  currentEnrollment: PortalCurrentEnrollmentRecord | null;
  homework: HomeworkRecord[];
}

export interface StudentPortalHolidaysPayload {
  student: StudentRecord;
  holidays: HolidayRecord[];
}

export type TimetableDayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface TimetableEntryRecord {
  id: string;
  schoolId: string;
  dayOfWeek: TimetableDayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  class: {
    id: string;
    name: string;
    classCode: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  teacher: {
    id: string;
    name: string;
    employeeCode: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TimetableOptionClass {
  id: string;
  name: string;
  sections: Array<{
    id: string;
    name: string;
  }>;
}

export interface TimetableOptionTeacher {
  id: string;
  name: string;
}

export interface TimetableOptionSubject {
  id: string;
  name: string;
  code: string;
}

export interface TimetableOptionsPayload {
  classes: TimetableOptionClass[];
  teachers: TimetableOptionTeacher[];
  subjects: TimetableOptionSubject[];
  days: TimetableDayOfWeek[];
}

export interface TimetableFormPayload {
  classId: string;
  sectionId?: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: TimetableDayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
}

export interface UpdateTimetableFormPayload
  extends Partial<TimetableFormPayload> {
  schoolId?: string;
}

export interface ExamDateSheetEntryRecord {
  id: string;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  examDate: string;
  startTime: string;
  endTime: string;
}

export interface ExamDateSheetRecord {
  id: string;
  schoolId: string;
  examName: string;
  isPublished: boolean;
  school: {
    id: string;
    name: string;
    schoolCode: string;
  };
  class: {
    id: string;
    name: string;
    classCode: string;
  };
  entries: ExamDateSheetEntryRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamDateSheetOptionSubject {
  id: string;
  name: string;
  code: string;
}

export interface ExamDateSheetOptionClass {
  id: string;
  name: string;
  classCode: string;
  subjects: ExamDateSheetOptionSubject[];
}

export interface ExamDateSheetOptionsPayload {
  classes: ExamDateSheetOptionClass[];
}

export interface ExamDateSheetFormPayload {
  classId: string;
  examName: string;
  entries: Array<{
    subjectId: string;
    examDate: string;
    startTime: string;
    endTime: string;
  }>;
}

export interface NoticeRecord {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  audienceType: NoticeAudienceType;
  isPublished: boolean;
  expiryDate: string | null;
  school: {
    id: string;
    name: string;
    schoolCode: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface NoticeFormPayload {
  title: string;
  description: string;
  audienceType: NoticeAudienceType;
  isPublished?: boolean;
  expiryDate?: string;
  schoolId?: string;
}

export interface NotificationRecord {
  id: string;
  schoolId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationMeta extends ApiMeta {
  unreadCount: number;
}

export interface MessageRecord {
  id: string;
  schoolId: string;
  subject: string | null;
  message: string;
  isRead: boolean;
  readAt: string | null;
  sender: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleType: UserRole;
  };
  receiver: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleType: UserRole;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecipientRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  roleType: UserRole;
  userType: UserType;
}

export interface MessageFormPayload {
  receiverId: string;
  subject?: string;
  message: string;
  schoolId?: string;
}

export interface HomeworkRecord {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  dueDate: string;
  class: {
    id: string;
    name: string;
    classCode: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  teacher: {
    id: string;
    name: string;
    employeeCode: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HomeworkFormPayload {
  classId: string;
  sectionId?: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  dueDate: string;
  schoolId?: string;
}

export interface HomeworkOptionsPayload {
  classes: Array<{
    id: string;
    name: string;
    sections: Array<{
      id: string;
      name: string;
    }>;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  teachers: Array<{
    id: string;
    name: string;
    employeeCode: string;
  }>;
}

export interface AttendanceReportPayload {
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number;
  };
  classes: Array<{
    classId: string;
    className: string;
    classCode: string;
    total: number;
  }>;
}

export interface FeesReportPayload {
  summary: {
    totalAssigned: number;
    totalPaid: number;
    totalDue: number;
  };
  classes: Array<{
    classId: string;
    className: string;
    totalAssigned: number;
    totalPaid: number;
    totalDue: number;
  }>;
}

export interface ResultsReportPayload {
  summary: {
    totalExams: number;
    averagePercentage: number;
  };
  exams: Array<{
    examId: string;
    examName: string;
    className: string;
    averagePercentage: number;
    marksCount: number;
  }>;
}

export interface HolidayRecord {
  id: string;
  schoolId: string;
  title: string;
  startDate: string;
  endDate: string;
  type: HolidayType;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayFormPayload {
  title: string;
  startDate: string;
  endDate: string;
  type: HolidayType;
  schoolId?: string;
}

export interface UpdateAdmissionStatusPayload {
  status: AdmissionApplicationStatus;
  remarks?: string;
  schoolId?: string;
}

export type PromotionAction = 'PROMOTED' | 'DETAINED';
export type PromotionPreviewStatus =
  | 'VALID'
  | 'ALREADY_PROMOTED'
  | 'INVALID_DATA'
  | 'CONFLICT';

export interface PromotionOptionSection {
  id: string;
  name: string;
}

export interface PromotionOptionClass {
  id: string;
  name: string;
  sections: PromotionOptionSection[];
}

export interface PromotionOptionSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicSessionStatus;
}

export interface PromotionOptionsPayload {
  currentSessionId: string | null;
  academicSessions: PromotionOptionSession[];
  classes: PromotionOptionClass[];
}

export interface PromotionEligibleStudentRecord {
  id: string;
  schoolId: string;
  name: string;
  studentCode: string;
  email: string | null;
  phone: string | null;
  sourceEnrollment: {
    id: string;
    admissionNo: string;
    rollNo: string | null;
    status: string;
    academicSession: {
      id: string;
      name: string;
    };
    academicClass: {
      id: string;
      name: string;
    };
    section: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface PromotionPreviewStudentRecord {
  id: string;
  schoolId: string;
  name: string;
  studentCode: string;
  email: string | null;
  phone: string | null;
}

export interface PromotionPreviewEnrollmentRecord {
  id: string;
  admissionNo: string;
  rollNo: string | null;
  status: string;
  academicSession: {
    id: string;
    name: string;
  };
  academicClass: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
}

export interface PromotionPreviewTargetRecord {
  academicSession: {
    id: string;
    name: string;
  };
  academicClass: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    name: string;
  } | null;
}

export interface PromotionPreviewRecord {
  student: PromotionPreviewStudentRecord | null;
  currentEnrollment: PromotionPreviewEnrollmentRecord | null;
  targetEnrollment: PromotionPreviewTargetRecord;
  action: PromotionAction;
  status: PromotionPreviewStatus;
  message: string;
}

export interface PromotionPreviewSummary {
  total: number;
  valid: number;
  skipped: number;
  errors: number;
}

export interface PromotionPreviewPayload {
  studentIds?: string[];
  fromAcademicSessionId: string;
  toAcademicSessionId: string;
  fromClassId: string;
  toClassId: string;
  fromSectionId?: string;
  toSectionId?: string;
  action: PromotionAction;
  schoolId?: string;
}

export interface PromotionPreviewResponse {
  items: PromotionPreviewRecord[];
  summary: PromotionPreviewSummary;
}

export interface PromotionRecord {
  id: string;
  schoolId: string;
  action: PromotionAction;
  remarks: string | null;
  promotedAt: string;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
  fromAcademicSession: {
    id: string;
    name: string;
  };
  toAcademicSession: {
    id: string;
    name: string;
  };
  fromClass: {
    id: string;
    name: string;
  };
  toClass: {
    id: string;
    name: string;
  };
  fromSection: {
    id: string;
    name: string;
  } | null;
  toSection: {
    id: string;
    name: string;
  } | null;
  fromEnrollment: {
    id: string;
    admissionNo: string;
    rollNo: string | null;
  };
  toEnrollment: {
    id: string;
    admissionNo: string;
    rollNo: string | null;
  };
  promotedBy: {
    id: string;
    name: string;
  } | null;
}

export interface PromoteStudentPayload {
  studentId: string;
  fromAcademicSessionId: string;
  toAcademicSessionId: string;
  fromClassId: string;
  toClassId: string;
  fromSectionId?: string;
  toSectionId?: string;
  fromEnrollmentId?: string;
  action: PromotionAction;
  remarks?: string;
  schoolId?: string;
}

export interface BulkPromoteStudentsPayload {
  studentIds: string[];
  fromAcademicSessionId: string;
  toAcademicSessionId: string;
  fromClassId: string;
  toClassId: string;
  fromSectionId?: string;
  toSectionId?: string;
  action: PromotionAction;
  remarks?: string;
  schoolId?: string;
}

export interface BulkPromotionResult {
  total: number;
  promoted: number;
  failed: number;
  successes: PromotionRecord[];
  failures: Array<{
    studentId: string;
    reason: string;
  }>;
}

export function createQueryString(
  params: Record<string, string | number | boolean | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, headers, ...init } = options;
  const requestHeaders = new Headers(headers);

  if (!requestHeaders.has('Content-Type') && init.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();

    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: requestHeaders,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuthSession();
      window.location.href = '/login';
    }

    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : typeof payload?.message === 'string'
        ? payload.message
        : 'Request failed.';

    throw new Error(message);
  }

  return payload as T;
}

function resolveApiUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:4000/api/v1';
  }

  throw new Error('NEXT_PUBLIC_API_URL is not configured.');
}
