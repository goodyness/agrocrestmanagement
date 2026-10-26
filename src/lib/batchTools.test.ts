/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { outstanding, simulateProfit, waterChange } from './batchTools';
describe('Customer unpaid goods', () => {
  test('partial payment leaves only the unpaid balance', () => expect(outstanding({ total_amount: 20000, amount_paid: 5000, payment_status: 'partial' })).toBe(15000));
  test('fully paid sales never generate debt', () => expect(outstanding({ total_amount: 20000, amount_paid: 0, payment_status: 'paid' })).toBe(0));
});
describe('What-if forecast remains separate from actuals', () => {
  test('25kg bag costs are included once and scenario compounds output and price', () => {
    const input = { dailyRevenue: 10000, dailyFeedCost: 15300 * 25 / 25, dailyOtherCost: 100, openingBalance: -200000, days: 30, outputChange: 10, priceChange: 10, feedChange: -50, otherChange: 0 };
    const result = simulateProfit(input);
    expect(result.revenue).toBeCloseTo(12100); expect(result.cost).toBe(7750); expect(result.finalBalance).toBeCloseTo(-69500); expect(input.openingBalance).toBe(-200000);
  });
  test('negative daily profit has no breakeven date', () => expect(simulateProfit({ dailyRevenue: 10, dailyFeedCost: 20, dailyOtherCost: 0, openingBalance: -100, days: 30, outputChange: 0, priceChange: 0, feedChange: 0, otherChange: 0 }).breakEvenDays).toBeNull());
});
test('water decline is normalized to previous intake', () => expect(waterChange(150, 200)).toBe(-25));