export type ManagerProduction = { id: string; date: string; created_at: string; crates: number; pieces: number; cracked_pieces?: number; egg_type?: string; comment?: string | null; notes?: string | null };
export type ManagerSale = { id: string; date: string; created_at: string; product_name: string; quantity: number; unit: string; total_amount: number; buyer_name: string; payment_status: string | null };
export type ManagerExpense = { id: string; date: string; created_at: string; expense_type: string; amount: number; description: string | null };
export type ManagerMortality = { id: string; date: string; created_at: string; quantity_dead: number; reason: string; observation_notes: string | null; batch_id: string | null };
export const afterOnboarding = <T extends { created_at: string }>(rows: T[], cutoff: string) => rows.filter(row => Date.parse(row.created_at) >= Date.parse(cutoff));
export function managerMetrics(production: ManagerProduction[], sales: ManagerSale[], expenses: ManagerExpense[]) {
  let eggs = 0; let cracked = 0;
  const months = new Map<string, { month: string; eggs: number; sales: number; expenses: number }>();
  const month = (date: string) => { const key = date.slice(0, 7); if (!months.has(key)) months.set(key, { month: key, eggs: 0, sales: 0, expenses: 0 }); return months.get(key); };
  production.forEach(r => {
    const good = r.egg_type === 'cracked' ? 0 : Number(r.crates) * 30 + Number(r.pieces);
    const bad = r.egg_type === 'cracked' ? Number(r.crates) * 30 + Number(r.pieces) : Number(r.cracked_pieces || 0);
    eggs += good + bad; cracked += bad; const m = month(r.date); if (m) m.eggs += good + bad;
  });
  sales.forEach(r => { const m = month(r.date); if (m) m.sales += Number(r.total_amount); });
  expenses.forEach(r => { const m = month(r.date); if (m) m.expenses += Number(r.amount); });
  return { eggs, cracked, good: eggs - cracked, sales: sales.reduce((s, r) => s + Number(r.total_amount), 0), expenses: expenses.reduce((s, r) => s + Number(r.amount), 0), months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)) };
}