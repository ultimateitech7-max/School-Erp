import { Spinner } from '@/components/ui/spinner';

export default function PortalLoading() {
  return (
    <div className="dashboard-loading-shell">
      <Spinner label="Loading portal..." />
    </div>
  );
}
