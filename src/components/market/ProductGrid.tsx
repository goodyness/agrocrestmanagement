import { MarketProduct, money, variantTotal } from '@/lib/market';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Package } from 'lucide-react';
export default function ProductGrid({ products, onSelect }: { products: MarketProduct[]; onSelect: (p: MarketProduct) => void }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map(p => {
    const available = p.variants.filter(v => v.active && v.stock > 0);
    const lowest = available.length ? Math.min(...available.map(v => variantTotal(v, 1))) : null;
    return <article key={p.id} className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-[4/3] bg-muted flex items-center justify-center">{p.image ? <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" /> : <Package className="h-14 w-14 text-muted-foreground" />}</div>
      <div className="p-5 space-y-3"><p className="text-xs uppercase text-muted-foreground">{p.category}</p><h3 className="text-xl font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p><div className="flex items-center justify-between gap-3"><span className="font-semibold">{lowest === null ? 'Sold out' : `From ${money(lowest)}`}</span><Button disabled={!available.length} onClick={() => onSelect(p)}>Buy <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div></div>
    </article>;
  })}</div>;
}