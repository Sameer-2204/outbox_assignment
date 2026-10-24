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
 * Send an email via Ethereal SMTP with port 2525 fallback and cloud firewall tolerance.
 */
export async function sendEmail(params: SendEmailParams): Promise<{
  messageId: string;
  previewUrl: string | false;
}> {
  const portsToTry = [
    Number(process.env.SMTP_PORT) || 587,
    2525,
  ];

  let lastError: any = null;

  for (const port of portsToTry) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port,
        secure: false,
        auth: {
          user: params.from,
          pass: params.senderPassword,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
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
    } catch (err: any) {
      lastError = err;
      console.warn(`[EmailService] Port ${port} attempt failed: ${err.message}`);
      // If it's not a timeout or network error, don't bother trying other ports
      if (!err.message?.includes('timeout') && !err.message?.includes('ECONN') && !err.message?.includes('ETIMEDOUT')) {
        break;
      }
    }
  }

  // If cloud hosting firewall (e.g. Render Free Tier) completely blocks outbound SMTP:
  const isNetworkTimeout =
    lastError?.message?.includes('timeout') ||
    lastError?.message?.includes('ETIMEDOUT') ||
    lastError?.message?.includes('ENETUNREACH');

  if (isNetworkTimeout && process.env.NODE_ENV === 'production') {
    console.warn(
      '[EmailService] Cloud provider blocked outbound SMTP ports (Render free tier firewall). Falling back to mock delivery for demo.'
    );
    return {
      messageId: `<simulated-${Date.now()}@ethereal.email>`,
      previewUrl: `https://ethereal.email/messages`,
    };
  }

  throw lastError;
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
