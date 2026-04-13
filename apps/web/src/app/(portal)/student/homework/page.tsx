import { PortalHomeworkPage } from '@/components/portal/portal-shared-pages';

export default function StudentHomeworkPage() {
  return (
    <PortalHomeworkPage
      description="Review all assignments, due dates, and subject-wise homework in one place."
      emptyDescription="New assignments will appear here when teachers publish them."
      emptyTitle="No homework assigned"
      title="Homework"
    />
  );
}
