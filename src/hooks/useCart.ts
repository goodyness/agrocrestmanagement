import { useEffect, useState } from 'react';
export type CartLine = { productId: string; product: string; variantId: string; variant: string; unit: string; price: number; weight_kg: number | null; stock: number; quantity: number; allowPod: boolean; podMinQuantity: number; image?: string };
const KEY = 'agrocrest-cart';
const read = (): CartLine[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export function useCart() {
  const [cart, setCartState] = useState<CartLine[]>(read);
  useEffect(() => { const sync = () => setCartState(read()); window.addEventListener('cart-change', sync); window.addEventListener('storage', sync); return () => { window.removeEventListener('cart-change', sync); window.removeEventListener('storage', sync); }; }, []);
  const setCart = (next: CartLine[]) => { localStorage.setItem(KEY, JSON.stringify(next)); window.dispatchEvent(new Event('cart-change')); };
  const add = (line: CartLine) => { const old = cart.find(c => c.variantId === line.variantId); const qty = (old?.quantity || 0) + line.quantity; if (qty > line.stock) return false; setCart(old ? cart.map(c => c.variantId === line.variantId ? { ...line, quantity: qty } : c) : [...cart, line]); return true; };
  const update = (variantId: string, quantity: number) => setCart(cart.map(c => c.variantId === variantId ? { ...c, quantity: Math.max(1, Math.min(c.stock, quantity)) } : c));
  const remove = (variantId: string) => setCart(cart.filter(c => c.variantId !== variantId));
  const clear = () => setCart([]);
  return { cart, add, update, remove, clear, count: cart.reduce((s, c) => s + c.quantity, 0) };
}
