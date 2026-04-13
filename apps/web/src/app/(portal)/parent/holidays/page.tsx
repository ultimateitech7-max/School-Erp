import { PortalHolidayPage } from '@/components/portal/portal-shared-pages';

export default function ParentHolidaysPage() {
  return (
    <PortalHolidayPage
      description="Stay on top of holidays and school events that affect your family schedule."
      emptyDescription="School holidays and events will appear here."
      emptyTitle="No upcoming holidays"
      title="Holiday Calendar"
    />
  );
}
