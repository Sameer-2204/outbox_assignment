'use client';

import React from 'react';

interface TabsProps {
  tabs: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    count?: number;
  }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex flex-col gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
            ${
              activeTab === tab.id
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span
              className={`ml-auto text-xs px-2 py-0.5 rounded-full
                ${
                  activeTab === tab.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
