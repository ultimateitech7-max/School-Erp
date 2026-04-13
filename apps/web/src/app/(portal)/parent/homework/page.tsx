import { PortalHomeworkPage } from '@/components/portal/portal-shared-pages';

export default function ParentHomeworkPage() {
  return (
    <PortalHomeworkPage
      description="Track assignments published for your linked children."
      emptyDescription="Homework published for your linked children will appear here."
      emptyTitle="No homework assigned"
      title="Children Homework"
    />
  );
}
