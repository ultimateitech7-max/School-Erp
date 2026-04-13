import { PortalHolidayPage } from '@/components/portal/portal-shared-pages';

export default function StudentHolidaysPage() {
  return (
    <PortalHolidayPage
      description="Track upcoming holidays and events relevant to your school calendar."
      emptyDescription="Published holiday calendar items will appear here."
      emptyTitle="No upcoming holidays"
      title="Holiday Calendar"
    />
  );
}
