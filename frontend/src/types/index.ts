// API response types

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Email {
  id: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenSeconds: number;
  hourlyLimit?: number;
  sender?: string;
}

export interface ScheduleResponse {
  message: string;
  count: number;
  emailIds: string[];
}

export interface EmailStats {
  scheduled: number;
  sent: number;
}

export interface SlackStatus {
  connected: boolean;
  channelName: string | null;
  teamName: string | null;
}

export interface SlackInstallResponse {
  url: string;
}
