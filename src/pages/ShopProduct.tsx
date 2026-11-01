import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadMarket, money, unitLabel, variantTotal } from '@/lib/market';
import { useCart } from '@/hooks/useCart';
import ShopHeader from '@/components/market/ShopHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Minus, Package, Plus, ShieldCheck, Truck, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useMarketSettings } from './Shop';
export default function ShopProduct() {
  const { id } = useParams(); const nav = useNavigate(); const { add } = useCart();
  const products = useQuery({ queryKey: ['public-market'], queryFn: () => loadMarket() });
  const settings = useMarketSettings();
  const p = products.data?.find(x => x.id === id);
  const [img, setImg] = useState(0); const [variantId, setVariantId] = useState(''); const [qty, setQty] = useState(1);
  if (products.isLoading) return <div className="min-h-screen"><ShopHeader /><p className="container py-10">Loading…</p></div>;
  if (!p) return <div className="min-h-screen"><ShopHeader /><div className="container py-16"><h1 className="text-2xl font-bold">Product not found</h1><Button asChild className="mt-4"><Link to="/shop">Back to shop</Link></Button></div></div>;
  const variants = p.variants.filter(v => v.active);
  const v = variants.find(x => x.id === variantId) || variants.find(x => x.stock > 0) || variants[0];
  const podOn = settings.data?.pod_enabled ?? true;
  function addToCart(go: boolean) {
    if (!v || v.stock < 1) return;
    if (!Number.isInteger(qty) || qty < 1) { toast.error('Enter a valid quantity'); return; }
    const ok = add({ productId: p!.id, product: p!.name, variantId: v.id, variant: v.name, unit: v.unit, price: Number(v.price), weight_kg: v.weight_kg === null ? null : Number(v.weight_kg), stock: v.stock, quantity: qty, allowPod: p!.allow_pod, podMinQuantity: p!.pod_min_quantity, image: p!.image });
    if (!ok) { toast.error('Quantity exceeds available stock'); return; }
    toast.success('Added to basket'); if (go) nav('/shop/checkout');
  }
  return <div className="min-h-screen bg-background"><ShopHeader />
    <main className="container py-8 space-y-6"><Link to="/shop" className="inline-flex gap-2 items-center text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />All products</Link>
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="aspect-square rounded-xl border bg-muted overflow-hidden flex items-center justify-center">{p.images[img] ? <img src={p.images[img]} alt={`${p.name} photo ${img + 1}`} className="h-full w-full object-cover" /> : <Package className="h-20 w-20 text-muted-foreground" />}</div>
          {p.images.length > 1 && <div className="grid grid-cols-3 gap-3">{p.images.map((src, i) => <button key={i} onClick={() => setImg(i)} aria-label={`Show photo ${i + 1}`} className={`aspect-square rounded-lg overflow-hidden border-2 ${i === img ? 'border-primary' : 'border-transparent'}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        </section>
        <section className="space-y-6">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category}</p><h1 className="text-3xl md:text-4xl font-bold mt-1">{p.name}</h1>{v && <p className="text-2xl font-semibold mt-3">{money(Number(v.price))}<span className="text-base font-normal text-muted-foreground"> / {v.unit === 'kg' ? 'kg' : v.unit}</span></p>}</div>
          {p.description && <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{p.description}</p>}
          {variants.length > 0 && <div className="space-y-2"><p className="font-medium">Choose option</p><div className="flex flex-wrap gap-2">{variants.map(x => <Button key={x.id} type="button" variant={x.id === v?.id ? 'default' : 'outline'} disabled={x.stock < 1} onClick={() => { setVariantId(x.id); setQty(1); }}>{x.name}{x.unit === 'kg' ? ` · ${x.weight_kg}kg` : ''}{x.stock < 1 ? ' · sold out' : ''}</Button>)}</div>{v && <p className="text-sm text-muted-foreground">{v.stock} {unitLabel(v.unit, v.stock)} available{v.unit === 'kg' ? ` · about ${v.weight_kg}kg per bird, priced per kg` : ''}</p>}</div>}
          {v && v.stock > 0 && <div className="space-y-2"><p className="font-medium">Quantity ({unitLabel(v.unit)})</p><div className="flex items-center gap-3"><Button size="icon" variant="outline" aria-label="Decrease" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Minus className="h-4 w-4" /></Button><input aria-label="Quantity" className="w-20 h-10 border rounded-md bg-background text-center" type="number" min={1} max={v.stock} value={qty} onChange={e => setQty(Math.floor(Number(e.target.value)))} /><Button size="icon" variant="outline" aria-label="Increase" disabled={qty >= v.stock} onClick={() => setQty(qty + 1)}><Plus className="h-4 w-4" /></Button><span className="ml-auto text-xl font-bold">{money(variantTotal(v, qty || 0))}</span></div></div>}
          <div className="flex flex-col sm:flex-row gap-3"><Button size="lg" className="flex-1" disabled={!v || v.stock < 1} onClick={() => addToCart(true)}>Buy now</Button><Button size="lg" variant="outline" className="flex-1" disabled={!v || v.stock < 1} onClick={() => addToCart(false)}>Add to basket</Button></div>
          <div className="rounded-lg border divide-y text-sm">
            <p className="p-3 flex gap-3"><CreditCard className="h-4 w-4 mt-0.5 text-primary" />Pay securely online with card, transfer or USSD.</p>
            <p className="p-3 flex gap-3"><Truck className="h-4 w-4 mt-0.5 text-primary" />{podOn && p.allow_pod ? <>Payment on delivery available{p.pod_min_quantity > 1 ? ` for orders of ${p.pod_min_quantity}+ ${unitLabel(v?.unit || 'animal')}` : ''}.</> : 'Online payment required for this product.'}</p>
            <p className="p-3 flex gap-3"><ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />Delivery {money(Number(settings.data?.delivery_fee ?? 1000))}{settings.data?.delivery_note ? ` · ${settings.data.delivery_note}` : ''}</p>
          </div>
          {podOn && p.allow_pod && <Badge variant="secondary">Pay on delivery eligible</Badge>}
        </section>
      </div></main></div>;
}
