export const prismaModelMap = {
  auth: ['User', 'Role', 'Permission', 'RolePermission'],
  schools: ['School', 'SchoolModule'],
  modulesControl: ['Module', 'SchoolModule'],
  academics: ['AcademicSession', 'AcademicClass', 'Section', 'Subject', 'ClassSubject'],
  students: ['Student', 'StudentGuardian', 'Admission', 'StudentDocument'],
  teachers: ['Teacher', 'TeacherAssignment'],
  attendance: ['AttendanceRecord'],
  fees: ['FeeStructure', 'FeeAssignment', 'FeeReceipt', 'FeePayment'],
  exams: ['Exam', 'ExamSubject', 'Mark', 'ReportCard'],
  communication: ['Notification', 'Message'],
  transport: ['Route', 'Vehicle', 'TransportAssignment'],
  customFields: ['CustomField', 'CustomFieldValue'],
} as const;

export type PrismaModuleName = keyof typeof prismaModelMap;
