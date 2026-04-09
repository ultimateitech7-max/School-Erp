'use client';

export type StudentHistoryTabId =
  | 'overview'
  | 'timeline'
  | 'academics'
  | 'attendance'
  | 'fees'
  | 'results';

interface StudentHistoryTabsProps {
  activeTab: StudentHistoryTabId;
  onChange: (nextTab: StudentHistoryTabId) => void;
}

const tabs: Array<{ id: StudentHistoryTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'academics', label: 'Academics' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fees' },
  { id: 'results', label: 'Results' },
];

export function StudentHistoryTabs({
  activeTab,
  onChange,
}: StudentHistoryTabsProps) {
  return (
    <div className="promotion-tabs history-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`promotion-tab ${activeTab === tab.id ? 'promotion-tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
