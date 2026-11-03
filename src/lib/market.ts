import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
export type MarketVariant = Tables<'market_variants'>;
export type MarketProduct = Tables<'market_products'> & { variants: MarketVariant[]; image?: string; images: string[] };
export const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value);
export const DEFAULT_DELIVERY = 1000;
export const MAX_PRODUCT_IMAGES = 3;
export function variantTotal(v: Pick<MarketVariant, 'unit' | 'price' | 'weight_kg'>, quantity: number) {
  return Math.round(Number(v.price) * quantity * (v.unit === 'kg' ? Number(v.weight_kg) : 1) * 100) / 100;
}
export function variantOptions(category: string) { return category === 'broiler' ? ['Live', 'Processed', 'Frozen'] : category === 'egg' ? ['Small', 'Medium', 'Big'] : []; }
export const unitLabel = (unit: string, n = 2) => unit === 'crate' ? (n === 1 ? 'crate' : 'crates') : unit === 'kg' ? (n === 1 ? 'bird' : 'birds') : (n === 1 ? 'animal' : 'animals');

export type PodLine = { productName: string; allowPod: boolean; podMinQuantity: number; quantity: number };
export type PodSettings = { enabled: boolean; minTotal: number | null };
/** Mirrors the server rule: returns reasons payment on delivery is not allowed (empty = allowed). */
export function podBlockers(lines: PodLine[], total: number, s: PodSettings): string[] {
  const out: string[] = [];
  if (!s.enabled) return ['Payment on delivery is currently unavailable.'];
  for (const l of lines) {
    if (!l.allowPod) out.push(`${l.productName} must be paid online.`);
    else if (l.quantity < l.podMinQuantity) out.push(`${l.productName}: payment on delivery needs at least ${l.podMinQuantity} units (you have ${l.quantity}).`);
  }
  if (s.minTotal !== null && total < s.minTotal) out.push(`Payment on delivery is only for orders of ${money(s.minTotal)} or more. Your total is ${money(total)}, so please pay online.`);
  return out;
}

// Reuse signed URLs so the browser cache keeps images instead of re-downloading them on each refresh.
const urlCache = new Map<string, { url: string; exp: number }>();
async function signedImages(paths: string[]): Promise<string[]> {
  const now = Date.now(); const missing = paths.filter(p => !(urlCache.get(p)?.exp! > now));
  if (missing.length) {
    const { data } = await supabase.storage.from('market-products').createSignedUrls(missing, 6 * 3600);
    (data || []).forEach(d => { if (d.signedUrl && d.path) { urlCache.set(d.path, { url: d.signedUrl, exp: now + 5 * 3600 * 1000 }); const i = new Image(); i.src = d.signedUrl; } });
  }
  return paths.map(p => urlCache.get(p)?.url).filter(Boolean) as string[];
}
export async function loadMarket(admin = false): Promise<MarketProduct[]> {
  let query = supabase.from('market_products').select('*').order('created_at', { ascending: false });
  if (!admin) query = query.eq('active', true);
  const { data, error } = await query; if (error) throw error;
  const { data: variants, error: ve } = await supabase.from('market_variants').select('*'); if (ve) throw ve;
  return Promise.all((data || []).map(async p => {
    const paths = p.image_paths?.length ? p.image_paths : p.image_path ? [p.image_path] : [];
    const images = await signedImages(paths);
    return { ...p, images, image: images[0], variants: (variants || []).filter(v => v.product_id === p.id && (admin || v.active)) };
  }));
}
