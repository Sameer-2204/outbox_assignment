'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { EmailList } from '@/components/EmailList';
import { ComposeEmail } from '@/components/ComposeEmail';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import {
  getScheduledEmails,
  getSentEmails,
  getEmailStats,
  searchEmails as searchEmailsApi,
  getSlackStatus,
  getSlackInstallUrl,
  disconnectSlack,
} from '@/lib/api';
import type { Email, EmailStats, SlackStatus } from '@/types';

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<EmailStats>({ scheduled: 0, sent: 0 });
  const [isLoadingEmails, setIsLoadingEmails] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false, channelName: null, teamName: null });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Check URL params for Slack connection result
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true') {
      toast('Slack connected successfully!', 'success');
      window.history.replaceState({}, '', '/');
      fetchSlackStatus();
    } else if (params.get('slack_error')) {
      toast(`Slack connection failed: ${params.get('slack_error')}`, 'error');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!user) return;
    setIsLoadingEmails(true);
    try {
      const [scheduled, sent, emailStats] = await Promise.all([
        getScheduledEmails(),
        getSentEmails(),
        getEmailStats(),
      ]);
      setScheduledEmails(scheduled);
      setSentEmails(sent);
      setStats(emailStats);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [user]);

  const fetchSlackStatus = async () => {
    try {
      const status = await getSlackStatus();
      setSlackStatus(status);
    } catch {
      // Slack status check is not critical
    }
  };

  useEffect(() => {
    if (user) {
      fetchEmails();
      fetchSlackStatus();
    }
  }, [user, fetchEmails]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [user, fetchEmails]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchEmailsApi(query);
      setSearchResults(results as Email[]);
    } catch {
      toast('Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnectSlack = async () => {
    try {
      const { url } = await getSlackInstallUrl();
      window.location.href = url;
    } catch {
      toast('Failed to start Slack connection', 'error');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      await disconnectSlack();
      setSlackStatus({ connected: false, channelName: null, teamName: null });
      toast('Slack disconnected', 'info');
    } catch {
      toast('Failed to disconnect Slack', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  if (showCompose) {
    return (
      <ComposeEmail
        onClose={() => setShowCompose(false)}
        onSuccess={() => {
          setShowCompose(false);
          fetchEmails();
        }}
      />
    );
  }

  const displayEmails = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-gray-800 text-gray-400 text-sm px-4 py-2">
        Homepage
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSearchResults(null);
            setSearchQuery('');
          }}
          onCompose={() => setShowCompose(true)}
          stats={stats}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search bar */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Filter icon */}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>

            {/* Refresh icon */}
            <button
              onClick={fetchEmails}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Slack connection bar */}
          <div className="px-6 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {slackStatus.connected ? (
                <span className="text-emerald-600">
                  Slack connected
                  {slackStatus.teamName && ` to ${slackStatus.teamName}`}
                  {slackStatus.channelName && ` (#${slackStatus.channelName})`}
                </span>
              ) : (
                <span className="text-gray-500">Slack not connected</span>
              )}
            </div>
            {slackStatus.connected ? (
              <Button variant="ghost" size="sm" onClick={handleDisconnectSlack}>
                Disconnect
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleConnectSlack}>
                Connect Slack
              </Button>
            )}
          </div>

          {/* Email list */}
          <div className="flex-1 overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-6 w-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <EmailList
                emails={displayEmails}
                isLoading={isLoadingEmails}
                type={searchResults !== null ? 'sent' : activeTab as 'scheduled' | 'sent'}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
