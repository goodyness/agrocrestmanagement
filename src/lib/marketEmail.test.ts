import { expect, test } from 'bun:test';
import nodemailer from 'nodemailer';

test('long Unicode order subject cannot break HTML MIME headers', async () => {
  const subject = 'New shop order AC-9D7EB86DB6 • Paid online • ₦11,400.00';
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const result = await transport.sendMail({ from: 'Farm <farm@example.com>', to: 'admin@example.com', subject, text: 'Order received', html: '<!doctype html><html><body><h1>New shop order</h1><p>₦11,400.00</p></body></html>' });
  const message = result.message.toString();
  const separator = message.indexOf('\r\n\r\n');
  const headers = message.slice(0, separator);
  expect(headers).toContain('To: admin@example.com');
  expect(headers).toContain('MIME-Version: 1.0');
  expect(headers).toContain('Content-Type: multipart/alternative');
  expect(message).toContain('Content-Type: text/html; charset=utf-8');
  expect(headers.split('\r\n').every(line => /^[ \t]|^[A-Za-z-]+:/.test(line))).toBe(true);
});