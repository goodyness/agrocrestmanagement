import { describe, test, expect } from 'bun:test';
import { DEFAULT_DELIVERY, variantTotal, variantOptions } from './market';
describe('Market pricing rules', () => {
  test('delivery defaults to 1000 naira', () => expect(DEFAULT_DELIVERY).toBe(1000));
  test('broilers are charged per kg for each selected bird', () => expect(variantTotal({ unit: 'kg', price: 3000, weight_kg: 2.5 }, 2)).toBe(15000));
  test('eggs are charged per crate without multiplying bird weight', () => expect(variantTotal({ unit: 'crate', price: 5000, weight_kg: null }, 3)).toBe(15000));
  test('broiler options are live, processed and frozen', () => expect(variantOptions('broiler')).toEqual(['Live', 'Processed', 'Frozen']));
  test('egg sizes are small, medium and big', () => expect(variantOptions('egg')).toEqual(['Small', 'Medium', 'Big']));
});