import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
export type MarketVariant = Tables<'market_variants'>;
export type MarketProduct = Tables<'market_products'> & { variants: MarketVariant[]; image?: string };
export const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value);
export const DEFAULT_DELIVERY = 1000;
export function variantTotal(v: Pick<MarketVariant, 'unit' | 'price' | 'weight_kg'>, quantity: number) {
  return Math.round(Number(v.price) * quantity * (v.unit === 'kg' ? Number(v.weight_kg) : 1) * 100) / 100;
}
export function variantOptions(category: string) { return category === 'broiler' ? ['Live', 'Processed', 'Frozen'] : category === 'egg' ? ['Small', 'Medium', 'Big'] : []; }
export async function loadMarket(admin = false): Promise<MarketProduct[]> {
  let query = supabase.from('market_products').select('*').order('created_at', { ascending: false });
  if (!admin) query = query.eq('active', true);
  const { data, error } = await query; if (error) throw error;
  const { data: variants, error: ve } = await supabase.from('market_variants').select('*'); if (ve) throw ve;
  return Promise.all((data || []).map(async p => {
    let image: string | undefined;
    if (p.image_path) { const { data: signed } = await supabase.storage.from('market-products').createSignedUrl(p.image_path, 3600); image = signed?.signedUrl; }
    return { ...p, image, variants: (variants || []).filter(v => v.product_id === p.id && (admin || v.active)) };
  }));
}