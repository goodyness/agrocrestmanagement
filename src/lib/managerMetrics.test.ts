import { describe, expect, test } from 'bun:test';
import { afterOnboarding, managerMetrics } from './managerMetrics';
describe('Manager scope and totals', () => {
  test('records before onboarding are excluded, including same-day earlier records', () => {
    const rows = [{ created_at: '2026-11-04T08:59:59Z' }, { created_at: '2026-11-04T09:00:00Z' }, { created_at: '2026-11-05T09:00:00Z' }];
    expect(afterOnboarding(rows, '2026-11-04T09:00:00Z')).toEqual(rows.slice(1));
  });
  test('backdated entries are included only when created after onboarding', () => {
    expect(afterOnboarding([{ date: '2026-10-01', created_at: '2026-11-05T00:00:00Z' }], '2026-11-04T09:00:00Z')).toHaveLength(1);
  });
  test('crate and piece eggs include cracked eggs without inflating good eggs', () => {
    const result = managerMetrics([{ id: 'a', date: '2026-11-04', created_at: '', crates: 3, pieces: 4, cracked_pieces: 2 }], [], []);
    expect(result.eggs).toBe(96); expect(result.good).toBe(94); expect(result.cracked).toBe(2);
  });
  test('monthly sales and expense totals use source amounts', () => {
    const r = managerMetrics([], [{ id: 's', date: '2026-11-04', created_at: '', product_name: 'Egg', buyer_name: '', quantity: 3, unit: 'crate', total_amount: 15000, payment_status: 'paid' }], [{ id: 'e', date: '2026-11-05', created_at: '', expense_type: 'feed', amount: 4000, description: null }]);
    expect(r.sales).toBe(15000); expect(r.expenses).toBe(4000); expect(r.months[0]).toEqual({ month: '2026-11', eggs: 0, sales: 15000, expenses: 4000 });
  });
});