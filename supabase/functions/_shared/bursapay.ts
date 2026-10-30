// BursaPay REST API (https://bursapay.com/docs). Secret key lives in the BURSAPAY_SECRET_KEY backend secret.
const BASE = 'https://api.bursapay.com/api/v1';
function key() { const k = Deno.env.get('BURSAPAY_SECRET_KEY'); if (!k) throw new Error('Online payment is not configured'); return k; }
async function call(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json?.message || json?.error || `BursaPay error ${res.status}`);
  return json.data ?? json;
}
export type BpPayment = { reference: string; amount: string; base_amount?: string; status: string; authorization_url?: string; metadata?: Record<string, unknown>; paid_at?: string | null };
export const initializePayment = (p: { amount: number; email: string; callback_url: string; order_id: string; order_number: string; attempt: number }) =>
  call('/payments/initialize/', { amount: p.amount, email: p.email, currency: 'NGN', callback_url: p.callback_url, idempotency_key: `${p.order_id}-${p.attempt}`, metadata: { order_id: p.order_id, order_number: p.order_number } }) as Promise<BpPayment>;
export const verifyPayment = (reference: string) => call('/payments/verify/', { reference }) as Promise<BpPayment>;
export const isPaidStatus = (s: string) => ['success', 'successful', 'succeeded', 'completed', 'paid'].includes(String(s).toLowerCase());
export const isFailedStatus = (s: string) => ['failed', 'abandoned', 'reversed', 'cancelled', 'expired'].includes(String(s).toLowerCase());
