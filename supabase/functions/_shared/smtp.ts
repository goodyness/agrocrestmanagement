import nodemailer from 'npm:nodemailer@6.10.1';

export async function sendSmtp(to: string, subject: string, html: string, text: string) {
  const user = Deno.env.get('GMAIL_USER');
  const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) throw new Error('Farm email service is not configured');
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
  try {
    await transport.sendMail({ from: { name: 'Agrocrest Farm', address: user }, to, subject, html, text });
  } finally { transport.close(); }
}