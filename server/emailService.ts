import type { User, Alert } from '@shared/schema';

/**
 * Sends a critical alert email to a user.
 * 
 * In a production environment, this function would use a transactional email service
 * like SendGrid, Postmark, or AWS SES. For this example, we will log the email
 * content to the console.
 * 
 * @param user The user to send the email to.
 * @param alert The critical alert that was triggered.
 */
export async function sendCriticalAlertEmail(user: User, alert: Alert): Promise<void> {
  const email = {
    to: user.email,
    from: 'alerts@sentinelscope.com',
    subject: `[CRITICAL] SentinelScope Alert: ${alert.title}`,
    html: `
      <h1>Critical Security Alert</h1>
      <p>Hello ${user.displayName || user.email},</p>
      <p>A new critical threat has been detected on your account:</p>
      <ul>
        <li><strong>Title:</strong> ${alert.title}</li>
        <li><strong>Severity:</strong> ${alert.severity}</li>
        <li><strong>Message:</strong> ${alert.message}</li>
        <li><strong>Timestamp:</strong> ${new Date(alert.timestamp).toUTCString()}</li>
      </ul>
      <p>Please log in to your SentinelScope dashboard immediately to review the details and take action.</p>
      <p>Thank you,<br/>The SentinelScope Team</p>
    `,
  };

  console.log('--- SENDING CRITICAL ALERT EMAIL ---');
  console.log(`To: ${email.to}`);
  console.log(`Subject: ${email.subject}`);
  console.log('------------------------------------');
  // In a real implementation, you would make an API call to your email provider here.
  // For example: await sendgrid.send(email);
}