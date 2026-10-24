import type {
  Email,
  ScheduleRequest,
  ScheduleResponse,
  EmailStats,
  SlackStatus,
  SlackInstallResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// Email APIs
export async function scheduleEmails(data: ScheduleRequest): Promise<ScheduleResponse> {
  return apiFetch('/api/emails/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getScheduledEmails(): Promise<Email[]> {
  return apiFetch('/api/emails/scheduled');
}

export async function getSentEmails(): Promise<Email[]> {
  return apiFetch('/api/emails/sent');
}

export async function searchEmails(query: string, status?: string): Promise<Email[]> {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (status) params.set('status', status);
  return apiFetch(`/api/emails/search?${params.toString()}`);
}

export async function getEmailStats(): Promise<EmailStats> {
  return apiFetch('/api/emails/stats');
}

export async function getSenders(): Promise<string[]> {
  return apiFetch('/api/emails/senders');
}

// Slack APIs
export async function getSlackStatus(): Promise<SlackStatus> {
  return apiFetch('/api/slack/status');
}

export async function getSlackInstallUrl(): Promise<SlackInstallResponse> {
  return apiFetch('/api/slack/install');
}

export async function disconnectSlack(): Promise<void> {
  await apiFetch('/api/slack/disconnect', { method: 'DELETE' });
}
