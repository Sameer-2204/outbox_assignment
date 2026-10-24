import nodemailer from 'nodemailer';
import { config } from '../config';

interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  body: string;
  senderPassword: string;
}

/**
 * Send an email via Ethereal SMTP.
 * Returns the message info including the Ethereal preview URL.
 */
export async function sendEmail(params: SendEmailParams): Promise<{
  messageId: string;
  previewUrl: string | false;
}> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: params.from,
      pass: params.senderPassword,
    },
  });

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.body,
    text: params.body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

/**
 * Get the password for a sender email from the configured accounts.
 */
export function getSenderPassword(senderEmail: string): string | undefined {
  const account = config.etherealAccounts.find((a) => a.email === senderEmail);
  return account?.password;
}

/**
 * Get all configured sender emails.
 */
export function getSenderEmails(): string[] {
  return config.etherealAccounts.map((a) => a.email);
}
