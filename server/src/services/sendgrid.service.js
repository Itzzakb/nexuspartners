import sgMail from '@sendgrid/mail';

let configured = false;

export function configureSendGrid() {
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    configured = true;
  }
}

export function isSendGridConfigured() {
  return configured;
}

export async function sendPasswordResetEmail(to, resetUrl) {
  if (!configured) {
    console.log('[SendGrid not configured] Password reset URL:', resetUrl);
    return { sent: false, resetUrl };
  }

  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'hello@nexuspartners.com',
    subject: 'Reset your Nexus Partners password',
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
    `,
  });

  return { sent: true };
}
