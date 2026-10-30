import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
// deno-lint-ignore no-explicit-any
type Db = any;
export type Order = {
  id: string; order_number: string; access_token: string; customer_name: string; email: string; phone: string; delivery_address: string;
  items: { product: string; variant: string; quantity: number; unit: string; weight_kg: number | null; line_total: number }[];
  subtotal: number; delivery_fee: number; total: number; amount_charged: number | null; payment_status: string; payment_mode: string; status: string; admin_note: string; created_at: string;
};
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
export const fmt = (n: number) => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const td = 'padding:10px 8px;border-bottom:1px solid #e3ebe5;font-size:14px';

const STATUS_COPY: Record<string, [string, string]> = {
  pending: ['Order received', 'We have received your order and will confirm it shortly.'],
  processing: ['Your order is being prepared', 'Our team is now preparing your order.'],
  dispatched: ['Your order is on its way', 'Your order has left the farm and is heading to your delivery address.'],
  delivered: ['Order delivered', 'Your order has been delivered. Thank you for buying from Agrocrest Farm!'],
  cancelled: ['Order cancelled', 'Your order has been cancelled. If you already paid, the farm will contact you about a refund.'],
};

function layout(title: string, intro: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1d2b22">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="background:#1f5130;border-radius:12px 12px 0 0;padding:22px 24px;color:#ffffff">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.8">Agrocrest Farm</div>
      <div style="font-size:22px;font-weight:bold;margin-top:6px">${esc(title)}</div>
    </div>
    <div style="border:1px solid #e3ebe5;border-top:0;border-radius:0 0 12px 12px;padding:24px">
      <p style="font-size:15px;line-height:1.6;margin-top:0">${intro}</p>${body}
      <p style="font-size:12px;color:#6b7d71;margin-top:28px;border-top:1px solid #e3ebe5;padding-top:14px">This is an automated message from Agrocrest Farm. Reply to this email if you need help with your order.</p>
    </div></div></body></html>`;
}

function orderTable(o: Order) {
  const rows = o.items.map(l => `<tr><td style="${td}"><b>${esc(l.product)}</b><br><span style="color:#6b7d71;font-size:12px">${esc(l.variant)} × ${l.quantity} ${l.unit === 'crate' ? 'crate(s)' : l.unit === 'kg' ? `bird(s) · ${l.weight_kg}kg each` : 'animal(s)'}</span></td><td style="${td};text-align:right">${fmt(l.line_total)}</td></tr>`).join('');
  const paid = o.amount_charged && Number(o.amount_charged) > Number(o.total) ? `<tr><td style="${td};color:#6b7d71">Amount charged (incl. payment fees)</td><td style="${td};text-align:right">${fmt(Number(o.amount_charged))}</td></tr>` : '';
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}
    <tr><td style="${td};color:#6b7d71">Products</td><td style="${td};text-align:right">${fmt(o.subtotal)}</td></tr>
    <tr><td style="${td};color:#6b7d71">Delivery</td><td style="${td};text-align:right">${fmt(o.delivery_fee)}</td></tr>
    <tr><td style="padding:12px 8px;font-weight:bold;font-size:16px">Order total</td><td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px">${fmt(o.total)}</td></tr>${paid}</table>`;
}

function details(o: Order) {
  const mode = o.payment_mode === 'pod' ? 'Payment on delivery' : 'Paid online (BursaPay)';
  const pay = o.payment_status === 'paid' ? 'Paid' : o.payment_status === 'failed' ? 'Payment failed' : 'Not yet paid';
  return `<table style="width:100%;font-size:14px;background:#f4f8f5;border-radius:8px;padding:12px;margin:12px 0">
  <tr><td style="padding:4px 8px;color:#6b7d71">Order</td><td style="padding:4px 8px"><b>${esc(o.order_number)}</b></td></tr>
  <tr><td style="padding:4px 8px;color:#6b7d71">Payment</td><td style="padding:4px 8px">${mode} · ${pay}</td></tr>
  <tr><td style="padding:4px 8px;color:#6b7d71">Customer</td><td style="padding:4px 8px">${esc(o.customer_name)} · ${esc(o.phone)} · ${esc(o.email)}</td></tr>
  <tr><td style="padding:4px 8px;color:#6b7d71">Deliver to</td><td style="padding:4px 8px">${esc(o.delivery_address)}</td></tr></table>`;
}

async function banksHtml(db: Db, o: Order) {
  const { data } = await db.from('bank_accounts').select('bank_name,account_name,account_number').eq('is_active', true).order('bank_name');
  const list = (data || []) as { bank_name: string; account_name: string; account_number: string }[];
  if (!list.length) return '<p style="font-size:14px">The farm will share payment details with you on delivery.</p>';
  return `<p style="font-size:14px;margin-bottom:6px"><b>Pay on delivery into any of these farm accounts</b> (use <b>${esc(o.order_number)}</b> as reference):</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${list.map(b => `<tr><td style="padding:10px;border:1px solid #e3ebe5"><b>${esc(b.bank_name)}</b><br>${esc(b.account_name)}</td><td style="padding:10px;border:1px solid #e3ebe5;font-family:monospace;font-size:17px">${esc(b.account_number)}</td></tr>`).join('')}</table>`;
}

async function send(to: string, subject: string, html: string) {
  const user = Deno.env.get('GMAIL_USER'); const pass = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!user || !pass) throw new Error('SMTP not configured');
  const client = new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: user, password: pass } } });
  try { await client.send({ from: `Agrocrest Farm <${user}>`, to, subject, content: subject, html }); } finally { await client.close(); }
}

export function orderLink(origin: string, o: Order) { return `${origin}/shop/order?id=${o.id}&token=${o.access_token}`; }

/** Booking confirmation to buyer + new-order alert to admin. Never throws. */
export async function sendBookingEmails(db: Db, o: Order, origin: string) {
  const link = orderLink(origin, o);
  const btn = `<p style="margin:20px 0"><a href="${link}" style="background:#1f5130;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View your order</a></p>`;
  const pod = o.payment_mode === 'pod' ? await banksHtml(db, o) : '';
  const intro = o.payment_mode === 'pod'
    ? `Hello ${esc(o.customer_name)}, thank you for your order! You chose <b>payment on delivery</b>. Please pay ${fmt(o.total)} when your order arrives.`
    : `Hello ${esc(o.customer_name)}, thank you! Your payment of <b>${fmt(Number(o.amount_charged || o.total))}</b> was received and your order is confirmed.`;
  const admin = Deno.env.get('GMAIL_RECEIVER') || Deno.env.get('GMAIL_USER') || '';
  const results = await Promise.allSettled([
    send(o.email, `Order ${o.order_number} confirmed • ${fmt(o.total)}`, layout('Thank you for your order', intro, details(o) + orderTable(o) + pod + btn)),
    admin ? send(admin, `New shop order ${o.order_number} • ${o.payment_mode === 'pod' ? 'Pay on delivery' : 'Paid online'} • ${fmt(o.total)}`, layout('New shop order', `A new order was placed by <b>${esc(o.customer_name)}</b>.`, details(o) + orderTable(o))) : Promise.resolve(),
  ]);
  return results.every(r => r.status === 'fulfilled');
}

export async function sendStatusEmail(db: Db, o: Order, origin: string, event: 'status' | 'paid') {
  const [title, text] = event === 'paid' ? ['Payment received', `We have received your payment of ${fmt(o.total)}. Thank you!`] : (STATUS_COPY[o.status] || STATUS_COPY.pending);
  const note = o.admin_note ? `<p style="font-size:14px;background:#fff8e6;padding:12px;border-radius:8px"><b>Note from the farm:</b> ${esc(o.admin_note)}</p>` : '';
  const pod = event === 'status' && o.payment_mode === 'pod' && o.payment_status !== 'paid' && o.status !== 'cancelled' ? await banksHtml(db, o) : '';
  const btn = `<p style="margin:20px 0"><a href="${orderLink(origin, o)}" style="background:#1f5130;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Track your order</a></p>`;
  await send(o.email, `${title} • Order ${o.order_number}`, layout(title, `Hello ${esc(o.customer_name)}, ${esc(text)}`, note + details(o) + orderTable(o) + pod + btn));
}

export function safeOrigin(req: Request) {
  const o = req.headers.get('origin') || '';
  if (/^https:\/\/([a-z0-9-]+\.)*(lovable\.app|lovableproject\.com|agrocrestfarm\.app)$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o)) return o;
  return 'https://agrocrestfarm.app';
}
