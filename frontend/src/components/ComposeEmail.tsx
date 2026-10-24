'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { scheduleEmails, getSenders } from '@/lib/api';

interface ComposeEmailProps {
  onClose: () => void;
  onSuccess: () => void;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function parseCSV(text: string): string[] {
  const emails: string[] = [];
  // Split by newline, comma, semicolon, or tab
  const parts = text.split(/[\n,;\t]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    // Extract email-like patterns
    const emailMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      emails.push(emailMatch[0].toLowerCase());
    }
  }
  return [...new Set(emails)]; // Deduplicate
}

export function ComposeEmail({ onClose, onSuccess }: ComposeEmailProps) {
  const [sender, setSender] = useState('');
  const [senders, setSenders] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetween, setDelayBetween] = useState('5');
  const [hourlyLimit, setHourlyLimit] = useState('50');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csvFileName, setCsvFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSenders()
      .then((s) => {
        setSenders(s);
        if (s.length > 0) setSender(s[0]);
      })
      .catch(() => {
        toast('Failed to load senders', 'error');
      });

    // Default start time: 5 minutes from now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setStartTime(local);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsed = parseCSV(text);
      const valid = parsed.filter(isValidEmail);

      if (valid.length === 0) {
        toast('No valid emails found in file', 'error');
        return;
      }

      setRecipients((prev) => {
        const merged = [...new Set([...prev, ...valid])];
        return merged;
      });

      toast(`Added ${valid.length} emails from ${file.name}`, 'success');
    };
    reader.readAsText(file);
  };

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;

    if (!isValidEmail(email)) {
      toast('Invalid email address', 'error');
      return;
    }

    if (recipients.includes(email)) {
      toast('Email already added', 'info');
      return;
    }

    setRecipients((prev) => [...prev, email]);
    setRecipientInput('');
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addRecipient();
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!subject.trim()) {
      toast('Subject is required', 'error');
      return;
    }
    if (!body.trim()) {
      toast('Email body is required', 'error');
      return;
    }
    if (recipients.length === 0) {
      toast('Add at least one recipient', 'error');
      return;
    }
    if (!startTime) {
      toast('Start time is required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await scheduleEmails({
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenSeconds: parseInt(delayBetween) || 5,
        hourlyLimit: parseInt(hourlyLimit) || undefined,
        sender: sender || undefined,
      });

      toast(`Scheduled ${result.count} emails successfully!`, 'success');
      onSuccess();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to schedule emails',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Compose New Email</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 flex gap-8">
          {/* Left: Form */}
          <div className="flex-1 space-y-5">
            {/* From */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 w-12 flex-shrink-0">From</label>
              <select
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {senders.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* To */}
            <div className="flex items-start gap-3">
              <label className="text-sm text-gray-500 w-12 flex-shrink-0 mt-2.5">To</label>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500">
                  {recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium"
                    >
                      {email}
                      <button
                        onClick={() => removeRecipient(email)}
                        className="text-emerald-500 hover:text-emerald-700"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addRecipient}
                    placeholder={recipients.length === 0 ? 'Enter email addresses...' : ''}
                    className="flex-1 min-w-[150px] outline-none text-sm py-0.5 bg-transparent"
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload List
                  </button>
                  {csvFileName && (
                    <span className="text-xs text-gray-400">{csvFileName}</span>
                  )}
                  {recipients.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500 w-12 flex-shrink-0">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Delay and Hourly Limit */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Delay between 2 emails</label>
                <input
                  type="number"
                  value={delayBetween}
                  onChange={(e) => setDelayBetween(e.target.value)}
                  min="0"
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-gray-400">sec</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Hourly Limit</label>
                <input
                  type="number"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(e.target.value)}
                  min="1"
                  className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Body */}
            <div>
              <TextArea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type Your Reply..."
                rows={10}
                className="!min-h-[200px]"
              />
              {/* Toolbar */}
              <div className="flex items-center gap-1 mt-2 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                {['B', 'I', 'U', 'S'].map((btn) => (
                  <button
                    key={btn}
                    className="w-7 h-7 flex items-center justify-center text-sm text-gray-600 hover:bg-gray-200 rounded font-medium"
                  >
                    {btn}
                  </button>
                ))}
                <div className="w-px h-4 bg-gray-300 mx-1" />
                <button className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </button>
                <button className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Send Later panel */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-gray-50 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Send Later</h3>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Pick a date & time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Timezone</label>
                <div className="text-sm text-gray-700">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>

              {startTime && recipients.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-2">Schedule preview</label>
                  <div className="space-y-1">
                    {recipients.slice(0, 5).map((_, i) => {
                      const time = new Date(
                        new Date(startTime).getTime() + i * (parseInt(delayBetween) || 5) * 1000
                      );
                      return (
                        <div key={i} className="text-xs text-gray-600">
                          #{i + 1}: {time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      );
                    })}
                    {recipients.length > 5 && (
                      <div className="text-xs text-gray-400">
                        ... and {recipients.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
