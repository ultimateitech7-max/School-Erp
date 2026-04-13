import { Spinner } from '@/components/ui/spinner';

export default function DashboardLoading() {
  return (
    <div className="dashboard-loading-shell">
      <Spinner label="Loading workspace..." />
    </div>
  );
}
