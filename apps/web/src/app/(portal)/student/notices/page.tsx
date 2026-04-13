import { PortalNoticePage } from '@/components/portal/portal-shared-pages';

export default function StudentNoticesPage() {
  return (
    <PortalNoticePage
      description="Read student-facing notices, announcements, and school reminders."
      emptyDescription="Student notices will appear here once published."
      emptyTitle="No active notices"
      title="Notice Board"
    />
  );
}
