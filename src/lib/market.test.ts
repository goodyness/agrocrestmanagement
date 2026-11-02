import { describe, test, expect } from 'bun:test';
import { DEFAULT_DELIVERY, variantTotal, variantOptions } from './market';
describe('Market pricing rules', () => {
  test('delivery defaults to 1000 naira', () => expect(DEFAULT_DELIVERY).toBe(1000));
  test('broilers are charged per kg for each selected bird', () => expect(variantTotal({ unit: 'kg', price: 3000, weight_kg: 2.5 }, 2)).toBe(15000));
  test('eggs are charged per crate without multiplying bird weight', () => expect(variantTotal({ unit: 'crate', price: 5000, weight_kg: null }, 3)).toBe(15000));
  test('broiler options are live, processed and frozen', () => expect(variantOptions('broiler')).toEqual(['Live', 'Processed', 'Frozen']));
  test('egg sizes are small, medium and big', () => expect(variantOptions('egg')).toEqual(['Small', 'Medium', 'Big']));
});import { podBlockers } from './market';
describe('Payment on delivery rules', () => {
  const on = { enabled: true, maxTotal: null };
  test('eggs below the 2-crate minimum must pay online', () => expect(podBlockers([{ productName: 'Eggs', allowPod: true, podMinQuantity: 2, quantity: 1 }], 6000, on)).toHaveLength(1));
  test('eggs at 2 crates may pay on delivery', () => expect(podBlockers([{ productName: 'Eggs', allowPod: true, podMinQuantity: 2, quantity: 2 }], 11000, on)).toEqual([]));
  test('products with pay on delivery disabled must pay online', () => expect(podBlockers([{ productName: 'Frozen', allowPod: false, podMinQuantity: 1, quantity: 5 }], 5000, on)).toHaveLength(1));
  test('orders above the maximum total must pay online', () => expect(podBlockers([{ productName: 'Eggs', allowPod: true, podMinQuantity: 1, quantity: 9 }], 50001, { enabled: true, maxTotal: 50000 })).toHaveLength(1));
  test('payment on delivery switched off blocks everything', () => expect(podBlockers([], 100, { enabled: false, maxTotal: null })).toHaveLength(1));
});
