import type {
  AcademicClassRecord,
  AcademicSessionRecord,
  AdmissionApplicationRecord,
  AttendanceRecord,
  ExamDateSheetRecord,
  ExamRecord,
  ExamResultRow,
  FeesReportPayload,
  FeeStructureRecord,
  HolidayRecord,
  HomeworkRecord,
  MessageRecord,
  NoticeRecord,
  ParentRecord,
  PaymentRecord,
  PromotionEligibleStudentRecord,
  PromotionPreviewRecord,
  PromotionRecord,
  ResultsReportPayload,
  SchoolRecord,
  SectionRecord,
  StudentFeeRecord,
  StudentRecord,
  SubjectRecord,
  TimetableEntryRecord,
  UserRecord,
  AttendanceReportPayload,
} from './api';
import type { CsvColumn } from './csv';

export const userCsvColumns: CsvColumn<UserRecord>[] = [
  { header: 'Name', value: (row) => row.name },
  { header: 'Email', value: (row) => row.email },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Role', value: (row) => row.role },
  { header: 'User Type', value: (row) => row.userType },
  { header: 'Designation', value: (row) => row.designation },
  { header: 'Status', value: (row) => row.status },
  { header: 'School ID', value: (row) => row.schoolId },
  { header: 'Last Login', value: (row) => row.lastLoginAt },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const studentCsvColumns: CsvColumn<StudentRecord>[] = [
  { header: 'Name', value: (row) => row.name },
  { header: 'Student Code', value: (row) => row.studentCode },
  { header: 'Registration Number', value: (row) => row.registrationNumber },
  { header: 'Admission Number', value: (row) => row.admissionNo },
  { header: 'Email', value: (row) => row.email },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Gender', value: (row) => row.gender },
  { header: 'Date of Birth', value: (row) => row.dateOfBirth },
  { header: 'Class', value: (row) => row.class?.name },
  { header: 'Section', value: (row) => row.section?.name },
  { header: 'Session', value: (row) => row.session?.name },
  { header: 'Portal Email', value: (row) => row.portalAccess?.email },
  { header: 'Status', value: (row) => row.status },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const admissionCsvColumns: CsvColumn<AdmissionApplicationRecord>[] = [
  { header: 'Student Name', value: (row) => row.studentName },
  { header: 'Father Name', value: (row) => row.fatherName },
  { header: 'Mother Name', value: (row) => row.motherName },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Email', value: (row) => row.email },
  { header: 'Class Applied', value: (row) => row.classApplied },
  { header: 'Date of Birth', value: (row) => row.dob },
  { header: 'Status', value: (row) => row.status },
  { header: 'Address', value: (row) => row.address },
  { header: 'Previous School', value: (row) => row.previousSchool },
  { header: 'Remarks', value: (row) => row.remarks },
  { header: 'Linked Student', value: (row) => row.student?.name },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const parentCsvColumns: CsvColumn<ParentRecord>[] = [
  { header: 'Parent Name', value: (row) => row.fullName },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Email', value: (row) => row.email },
  { header: 'Relation Type', value: (row) => row.relationType },
  { header: 'Emergency Contact', value: (row) => row.emergencyContact },
  { header: 'Address', value: (row) => row.address },
  { header: 'Children Count', value: (row) => row.childrenCount },
  {
    header: 'Linked Students',
    value: (row) => row.linkedStudents.map((student) => student.name),
  },
  { header: 'Portal Email', value: (row) => row.portalAccess?.email },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const classCsvColumns: CsvColumn<AcademicClassRecord>[] = [
  { header: 'Class Name', value: (row) => row.className },
  { header: 'Class Code', value: (row) => row.classCode },
  { header: 'Grade Level', value: (row) => row.gradeLevel },
  { header: 'Sort Order', value: (row) => row.sortOrder },
  { header: 'Status', value: (row) => row.status },
  { header: 'Sections', value: (row) => row.sections.map((section) => section.name) },
  { header: 'Subjects', value: (row) => row.subjects.map((subject) => subject.name) },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const sectionCsvColumns: CsvColumn<SectionRecord>[] = [
  { header: 'Section Name', value: (row) => row.sectionName },
  { header: 'Class', value: (row) => row.class.className },
  { header: 'Class Code', value: (row) => row.class.classCode },
  { header: 'Room Number', value: (row) => row.roomNo },
  { header: 'Capacity', value: (row) => row.capacity },
  { header: 'Status', value: (row) => row.status },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const subjectCsvColumns: CsvColumn<SubjectRecord>[] = [
  { header: 'Subject Name', value: (row) => row.subjectName },
  { header: 'Subject Code', value: (row) => row.subjectCode },
  { header: 'Subject Type', value: (row) => row.subjectType },
  { header: 'Optional', value: (row) => row.isOptional },
  { header: 'Status', value: (row) => row.status },
  {
    header: 'Mapped Classes',
    value: (row) => row.classes.map((item) => `${item.className} (${item.sessionName})`),
  },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const schoolCsvColumns: CsvColumn<SchoolRecord>[] = [
  { header: 'School Name', value: (row) => row.name },
  { header: 'School Code', value: (row) => row.schoolCode },
  { header: 'Subdomain', value: (row) => row.subdomain },
  { header: 'Email', value: (row) => row.email },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Timezone', value: (row) => row.timezone },
  { header: 'Active', value: (row) => row.isActive },
  { header: 'Admin Name', value: (row) => row.adminUser?.name },
  { header: 'Admin Email', value: (row) => row.adminUser?.email },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const feeStructureCsvColumns: CsvColumn<FeeStructureRecord>[] = [
  { header: 'Name', value: (row) => row.name },
  { header: 'Fee Code', value: (row) => row.feeCode },
  { header: 'Category', value: (row) => row.category },
  { header: 'Frequency', value: (row) => row.frequency },
  { header: 'Amount', value: (row) => row.amount },
  { header: 'Late Fee Per Day', value: (row) => row.lateFeePerDay },
  { header: 'Optional', value: (row) => row.isOptional },
  { header: 'Class', value: (row) => row.class?.className },
  { header: 'Session', value: (row) => row.session.name },
  { header: 'Due Date', value: (row) => row.dueDate },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const studentFeeCsvColumns: CsvColumn<StudentFeeRecord>[] = [
  { header: 'Student', value: (row) => row.student.name },
  { header: 'Student Code', value: (row) => row.student.studentCode },
  { header: 'Fee Name', value: (row) => row.feeStructure.name },
  { header: 'Fee Code', value: (row) => row.feeStructure.feeCode },
  { header: 'Total Amount', value: (row) => row.totalAmount },
  { header: 'Concession', value: (row) => row.concessionAmount },
  { header: 'Net Amount', value: (row) => row.netAmount },
  { header: 'Paid Amount', value: (row) => row.paidAmount },
  { header: 'Due Amount', value: (row) => row.dueAmount },
  { header: 'Status', value: (row) => row.status },
  { header: 'Due Date', value: (row) => row.dueDate },
  { header: 'Assigned At', value: (row) => row.assignedAt },
];

export const paymentCsvColumns: CsvColumn<PaymentRecord>[] = [
  { header: 'Receipt Number', value: (row) => row.receiptNo },
  { header: 'Student', value: (row) => row.student.name },
  { header: 'Student Code', value: (row) => row.student.studentCode },
  { header: 'Fee Name', value: (row) => row.feeStructure.name },
  { header: 'Fee Code', value: (row) => row.feeStructure.feeCode },
  { header: 'Amount', value: (row) => row.amount },
  { header: 'Payment Date', value: (row) => row.paymentDate },
  { header: 'Payment Method', value: (row) => row.paymentMethod },
  { header: 'Reference', value: (row) => row.reference },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const attendanceCsvColumns: CsvColumn<AttendanceRecord>[] = [
  { header: 'Attendance Date', value: (row) => row.attendanceDate },
  { header: 'Student', value: (row) => row.student.name },
  { header: 'Student Code', value: (row) => row.student.studentCode },
  { header: 'Class', value: (row) => row.class.className },
  { header: 'Section', value: (row) => row.section?.sectionName },
  { header: 'Status', value: (row) => row.status },
  { header: 'Remarks', value: (row) => row.remarks },
  { header: 'Session', value: (row) => row.session.sessionName },
  { header: 'Marked By', value: (row) => row.markedBy?.name },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const examCsvColumns: CsvColumn<ExamRecord>[] = [
  { header: 'Exam Name', value: (row) => row.examName },
  { header: 'Exam Code', value: (row) => row.examCode },
  { header: 'Exam Type', value: (row) => row.examType },
  { header: 'Status', value: (row) => row.status },
  { header: 'Class', value: (row) => row.class?.className },
  { header: 'Session', value: (row) => row.session.name },
  { header: 'Start Date', value: (row) => row.startDate },
  { header: 'End Date', value: (row) => row.endDate },
  { header: 'Subjects', value: (row) => row.subjects.map((subject) => subject.subjectName) },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const examResultCsvColumns: CsvColumn<ExamResultRow>[] = [
  { header: 'Student', value: (row) => row.student.name },
  { header: 'Student Code', value: (row) => row.student.studentCode },
  { header: 'Student Email', value: (row) => row.student.email },
  { header: 'Exam Name', value: (row) => row.exam.examName },
  { header: 'Exam Code', value: (row) => row.exam.examCode },
  { header: 'Total Marks', value: (row) => row.totalMarks },
  { header: 'Obtained Marks', value: (row) => row.obtainedMarks },
  { header: 'Percentage', value: (row) => row.percentage },
  { header: 'Overall Grade', value: (row) => row.overallGrade },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const academicSessionCsvColumns: CsvColumn<AcademicSessionRecord>[] = [
  { header: 'Session Name', value: (row) => row.name },
  { header: 'Start Date', value: (row) => row.startDate },
  { header: 'End Date', value: (row) => row.endDate },
  { header: 'Current', value: (row) => row.isCurrent },
  { header: 'Active', value: (row) => row.isActive },
  { header: 'Status', value: (row) => row.status },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const noticeCsvColumns: CsvColumn<NoticeRecord>[] = [
  { header: 'Title', value: (row) => row.title },
  { header: 'Description', value: (row) => row.description },
  { header: 'Audience', value: (row) => row.audienceType },
  { header: 'Published', value: (row) => row.isPublished },
  { header: 'Expiry Date', value: (row) => row.expiryDate },
  { header: 'School', value: (row) => row.school.name },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const homeworkCsvColumns: CsvColumn<HomeworkRecord>[] = [
  { header: 'Title', value: (row) => row.title },
  { header: 'Description', value: (row) => row.description },
  { header: 'Due Date', value: (row) => row.dueDate },
  { header: 'Class', value: (row) => row.class.name },
  { header: 'Section', value: (row) => row.section?.name },
  { header: 'Subject', value: (row) => row.subject.name },
  { header: 'Subject Code', value: (row) => row.subject.code },
  { header: 'Teacher', value: (row) => row.teacher.name },
  { header: 'Teacher Code', value: (row) => row.teacher.employeeCode },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const holidayCsvColumns: CsvColumn<HolidayRecord>[] = [
  { header: 'Title', value: (row) => row.title },
  { header: 'Type', value: (row) => row.type },
  { header: 'Start Date', value: (row) => row.startDate },
  { header: 'End Date', value: (row) => row.endDate },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const promotionEligibleCsvColumns: CsvColumn<PromotionEligibleStudentRecord>[] = [
  { header: 'Student', value: (row) => row.name },
  { header: 'Student Code', value: (row) => row.studentCode },
  { header: 'Email', value: (row) => row.email },
  { header: 'Phone', value: (row) => row.phone },
  { header: 'Source Admission Number', value: (row) => row.sourceEnrollment?.admissionNo },
  { header: 'Source Roll Number', value: (row) => row.sourceEnrollment?.rollNo },
  { header: 'Source Status', value: (row) => row.sourceEnrollment?.status },
  { header: 'Source Session', value: (row) => row.sourceEnrollment?.academicSession.name },
  { header: 'Source Class', value: (row) => row.sourceEnrollment?.academicClass.name },
  { header: 'Source Section', value: (row) => row.sourceEnrollment?.section?.name },
];

export const promotionHistoryCsvColumns: CsvColumn<PromotionRecord>[] = [
  { header: 'Student', value: (row) => row.student.name },
  { header: 'Student Code', value: (row) => row.student.studentCode },
  { header: 'Action', value: (row) => row.action },
  { header: 'Remarks', value: (row) => row.remarks },
  { header: 'From Session', value: (row) => row.fromAcademicSession.name },
  { header: 'To Session', value: (row) => row.toAcademicSession.name },
  { header: 'From Class', value: (row) => row.fromClass.name },
  { header: 'To Class', value: (row) => row.toClass.name },
  { header: 'From Section', value: (row) => row.fromSection?.name },
  { header: 'To Section', value: (row) => row.toSection?.name },
  { header: 'Promoted At', value: (row) => row.promotedAt },
  { header: 'Promoted By', value: (row) => row.promotedBy?.name },
];

export const promotionPreviewCsvColumns: CsvColumn<PromotionPreviewRecord>[] = [
  { header: 'Student', value: (row) => row.student?.name },
  { header: 'Student Code', value: (row) => row.student?.studentCode },
  { header: 'Action', value: (row) => row.action },
  { header: 'Status', value: (row) => row.status },
  { header: 'Message', value: (row) => row.message },
  { header: 'Current Session', value: (row) => row.currentEnrollment?.academicSession.name },
  { header: 'Current Class', value: (row) => row.currentEnrollment?.academicClass.name },
  { header: 'Current Section', value: (row) => row.currentEnrollment?.section?.name },
  { header: 'Target Session', value: (row) => row.targetEnrollment.academicSession.name },
  { header: 'Target Class', value: (row) => row.targetEnrollment.academicClass.name },
  { header: 'Target Section', value: (row) => row.targetEnrollment.section?.name },
];

export const timetableCsvColumns: CsvColumn<TimetableEntryRecord>[] = [
  { header: 'Day', value: (row) => row.dayOfWeek },
  { header: 'Period', value: (row) => row.periodNumber },
  { header: 'Start Time', value: (row) => row.startTime },
  { header: 'End Time', value: (row) => row.endTime },
  { header: 'Class', value: (row) => row.class.name },
  { header: 'Class Code', value: (row) => row.class.classCode },
  { header: 'Section', value: (row) => row.section?.name },
  { header: 'Subject', value: (row) => row.subject.name },
  { header: 'Subject Code', value: (row) => row.subject.code },
  { header: 'Teacher', value: (row) => row.teacher.name },
];

export const examDateSheetCsvColumns: CsvColumn<ExamDateSheetRecord>[] = [
  { header: 'Exam Name', value: (row) => row.examName },
  { header: 'Published', value: (row) => row.isPublished },
  { header: 'School', value: (row) => row.school.name },
  { header: 'Class', value: (row) => row.class.name },
  {
    header: 'Entries',
    value: (row) =>
      row.entries.map(
        (entry) =>
          `${entry.subject.name} (${entry.examDate} ${entry.startTime}-${entry.endTime})`,
      ),
  },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const messageCsvColumns: CsvColumn<MessageRecord>[] = [
  { header: 'Subject', value: (row) => row.subject },
  { header: 'Message', value: (row) => row.message },
  { header: 'Read', value: (row) => row.isRead },
  { header: 'Sender', value: (row) => row.sender.name },
  { header: 'Sender Role', value: (row) => row.sender.roleType },
  { header: 'Receiver', value: (row) => row.receiver.name },
  { header: 'Receiver Role', value: (row) => row.receiver.roleType },
  { header: 'Created At', value: (row) => row.createdAt },
];

export const attendanceReportCsvColumns: CsvColumn<AttendanceReportPayload['classes'][number]>[] = [
  { header: 'Class', value: (row) => row.className },
  { header: 'Class Code', value: (row) => row.classCode },
  { header: 'Total Records', value: (row) => row.total },
];

export const feesReportCsvColumns: CsvColumn<FeesReportPayload['classes'][number]>[] = [
  { header: 'Class', value: (row) => row.className },
  { header: 'Assigned', value: (row) => row.totalAssigned },
  { header: 'Paid', value: (row) => row.totalPaid },
  { header: 'Due', value: (row) => row.totalDue },
];

export const resultsReportCsvColumns: CsvColumn<ResultsReportPayload['exams'][number]>[] = [
  { header: 'Exam', value: (row) => row.examName },
  { header: 'Class', value: (row) => row.className },
  { header: 'Average Percentage', value: (row) => row.averagePercentage },
  { header: 'Marks Count', value: (row) => row.marksCount },
];
