export const outstanding = (sale: { total_amount: number; amount_paid?: number | null; payment_status?: string }) => Math.max(0, Number(sale.total_amount) - (sale.payment_status === 'paid' ? Number(sale.total_amount) : Number(sale.amount_paid || 0)));

export function simulateProfit(input: { dailyRevenue: number; dailyFeedCost: number; dailyOtherCost: number; openingBalance: number; days: number; outputChange: number; priceChange: number; feedChange: number; otherChange: number }) {
  const revenue = input.dailyRevenue * (1 + input.outputChange / 100) * (1 + input.priceChange / 100);
  const cost = input.dailyFeedCost * (1 + input.feedChange / 100) + input.dailyOtherCost * (1 + input.otherChange / 100);
  const dailyNet = revenue - cost;
  const breakEvenDays = input.openingBalance >= 0 ? 0 : dailyNet > 0 ? Math.ceil(-input.openingBalance / dailyNet) : null;
  return { revenue, cost, dailyNet, breakEvenDays, finalBalance: input.openingBalance + dailyNet * input.days };
}

export function waterChange(current: number, previous: number) { return previous > 0 ? (current - previous) / previous * 100 : null; }
export const money = (value: number) => `₦${Math.round(value).toLocaleString()}`;