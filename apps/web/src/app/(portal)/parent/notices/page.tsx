import { PortalNoticePage } from '@/components/portal/portal-shared-pages';

export default function ParentNoticesPage() {
  return (
    <PortalNoticePage
      description="Read parent-facing school announcements and important updates."
      emptyDescription="Published parent notices will appear here."
      emptyTitle="No active notices"
      title="Parent Notices"
    />
  );
}
