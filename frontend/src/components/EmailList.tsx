'use client';

import React from 'react';
import type { Email } from '@/types';

interface EmailListProps {
  emails: Email[];
  isLoading: boolean;
  type: 'scheduled' | 'sent';
}

function StatusBadge({ status }: { status: Email['status'] }) {
  const styles = {
    SCHEDULED: 'bg-orange-100 text-orange-700 border-orange-200',
    SENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    FAILED: 'bg-red-100 text-red-700 border-red-200',
  };

  const labels = {
    SCHEDULED: 'Scheduled',
    SENT: 'Sent',
    FAILED: 'Failed',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[date.getDay()];

  return `${day} ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-4 border-b border-gray-50 animate-pulse"
        >
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-5 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="flex-1 h-4 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ type }: { type: 'scheduled' | 'sent' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        {type === 'scheduled' ? (
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">
        {type === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
      </h3>
      <p className="text-sm text-gray-500">
        {type === 'scheduled'
          ? 'Schedule your first email campaign to see it here.'
          : 'Sent and failed emails will appear here.'}
      </p>
    </div>
  );
}

export function EmailList({ emails, isLoading, type }: EmailListProps) {
  if (isLoading) return <LoadingSkeleton />;
  if (emails.length === 0) return <EmptyState type={type} />;

  return (
    <div className="divide-y divide-gray-50">
      {emails.map((email) => (
        <div
          key={email.id}
          className="flex items-center gap-4 px-4 py-3.5 hover:bg-amber-50/40 transition-colors cursor-default group"
        >
          {/* Recipient */}
          <div className="w-40 flex-shrink-0">
            <span className="text-sm text-gray-500">To: </span>
            <span className="text-sm font-medium text-gray-900">
              {email.recipient.split('@')[0]}
            </span>
          </div>

          {/* Time badge */}
          <div className="flex-shrink-0">
            {type === 'scheduled' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDateTime(email.scheduledAt)}
              </span>
            ) : (
              <StatusBadge status={email.status} />
            )}
          </div>

          {/* Subject */}
          <span className="text-sm font-semibold text-gray-900 flex-shrink-0 max-w-[200px] truncate">
            {email.subject}
          </span>

          {/* Body preview */}
          <span className="text-sm text-gray-400 truncate flex-1 min-w-0">
            - {truncate(stripHtml(email.body), 60)}
          </span>

          {/* Status for scheduled */}
          {type === 'scheduled' && (
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <StatusBadge status={email.status} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
