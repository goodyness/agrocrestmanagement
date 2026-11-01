import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_DELIVERY, loadMarket, money } from '@/lib/market';
import ProductGrid from '@/components/market/ProductGrid';
import ShopHeader from '@/components/market/ShopHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
export const useMarketSettings = () => useQuery({ queryKey: ['market-delivery'], queryFn: async () => { const { data, error } = await supabase.from('market_settings').select('*').eq('id', 1).maybeSingle(); if (error) throw error; return data; } });
export default function Shop() {
  const products = useQuery({ queryKey: ['public-market'], queryFn: () => loadMarket() });
  const settings = useMarketSettings();
  const delivery = settings.data?.delivery_fee ?? DEFAULT_DELIVERY;
  return <div className="min-h-screen bg-background"><ShopHeader />
    <main className="container py-10 space-y-8"><Link to="/" className="inline-flex gap-2 items-center text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to farm</Link>
      <div><h1 className="text-4xl font-bold">Farm shop</h1><p className="text-muted-foreground mt-3">Poultry, eggs and livestock from Agrocrest Farm.</p></div>
      <p className="text-sm">Delivery: {money(Number(delivery))}{settings.data?.delivery_note ? ` · ${settings.data.delivery_note}` : ''}</p>
      {products.isLoading ? <p>Loading products…</p> : products.isError ? <p className="text-destructive">Products could not load. <Button variant="outline" onClick={() => products.refetch()}>Try again</Button></p> : !products.data?.length ? <div className="py-16 border-y"><h2 className="text-xl">Our next farm collection is on its way.</h2><p className="text-muted-foreground mt-2">Products will appear here when available.</p></div> : <ProductGrid products={products.data} />}
    </main></div>;
}
