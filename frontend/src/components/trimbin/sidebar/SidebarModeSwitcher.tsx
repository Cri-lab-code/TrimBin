import React from 'react';

export type SidebarTabMode = 'silence' | 'sections' | 'transcribe' | 'export';

interface SidebarModeSwitcherProps {
  activeTab: SidebarTabMode;
  onTabChange: (tab: SidebarTabMode) => void;
}

export const SidebarModeSwitcher: React.FC<SidebarModeSwitcherProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: SidebarTabMode; label: string }[] = [
    { id: 'silence', label: 'SILENCE' },
    { id: 'sections', label: 'CLIPS' },
    { id: 'transcribe', label: 'TEXT' },
    { id: 'export', label: 'EXPORT' },
  ];

  return (
    <div className="keybank-4gang">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`keybank-btn ${activeTab === tab.id ? 'active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
