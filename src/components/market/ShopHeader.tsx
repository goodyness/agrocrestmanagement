import { Link } from 'react-router-dom';
import { ShoppingBag, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/useCart';
export default function ShopHeader() {
  const { count } = useCart();
  return <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-30"><div className="container py-4 flex items-center justify-between gap-3">
    <Link to="/shop" className="font-semibold flex gap-2 items-center"><Sprout className="text-success" />Agrocrest Farm Shop</Link>
    <Button variant="outline" asChild><Link to="/shop/checkout"><ShoppingBag className="mr-2 h-4 w-4" />Basket ({count})</Link></Button>
  </div></header>;
}
