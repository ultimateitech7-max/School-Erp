export const prismaModelMap = {
  auth: ['User', 'Role', 'Permission', 'RolePermission'],
  schools: ['School', 'SchoolModule'],
  modulesControl: ['Module', 'SchoolModule'],
  academics: ['AcademicSession', 'AcademicClass', 'Section', 'Subject', 'ClassSubject', 'TimetableEntry', 'Homework', 'Holiday'],
  students: ['Student', 'StudentGuardian', 'Admission', 'StudentDocument', 'PromotionHistory'],
  teachers: ['Teacher', 'TeacherAssignment'],
  attendance: ['AttendanceRecord'],
  fees: ['FeeStructure', 'FeeAssignment', 'FeeReceipt', 'FeePayment'],
  exams: ['Exam', 'ExamSubject', 'Mark', 'ReportCard', 'ExamDateSheet', 'ExamDateSheetEntry'],
  communication: ['Notification', 'Notice', 'Message'],
  reports: ['AttendanceRecord', 'FeeAssignment', 'FeePayment', 'Exam', 'ExamSubject', 'Mark', 'ReportCard'],
  transport: ['Route', 'Vehicle', 'TransportAssignment'],
  customFields: ['CustomField', 'CustomFieldValue'],
} as const;

export type PrismaModuleName = keyof typeof prismaModelMap;
