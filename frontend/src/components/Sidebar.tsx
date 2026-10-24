'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import type { EmailStats } from '@/types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCompose: () => void;
  stats: EmailStats;
}

export function Sidebar({ activeTab, onTabChange, onCompose, stats }: SidebarProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const tabs = [
    {
      id: 'scheduled',
      label: 'Scheduled',
      count: stats.scheduled,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'sent',
      label: 'Sent',
      count: stats.sent,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-56 border-r border-gray-200 flex flex-col bg-white h-full">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          ON<span className="text-emerald-500">B</span>
        </h1>
      </div>

      {/* User info */}
      <div className="px-4 pb-4">
        <div
          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors relative"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
              {user?.name?.[0] || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{user?.name}</div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown */}
        {showUserMenu && (
          <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 relative">
            <button
              onClick={logout}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Compose button */}
      <div className="px-4 pb-4">
        <Button variant="outline" className="w-full" onClick={onCompose}>
          Compose
        </Button>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          CORE
        </div>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}
