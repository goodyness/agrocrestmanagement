
## Overview
Build a complete partner-lifecycle flow: onboarding → batch acceptance/complaint → contribution → sales → wallet/withdrawal → analytics/projections. Admin sets budget on assignment; partner confirms and adds contribution on acceptance. Profit accrues only after all recorded expenses are covered by sales, then splits per profit_share_percentage.

## 1. Database (single migration)

**New tables** (each with GRANT + RLS)
- `partner_bank_details` — profile_id (unique), full_name, phone, address, bank_name, account_number, account_name. Partner reads/writes own; admin reads all.
- `batch_acceptances` — batch_id, partner_id, status (pending/accepted/disputed), accepted_budget, partner_contribution, admin_contribution_snapshot, notes, resolved_at. Partner writes own; admin reads all + can resolve.
- `batch_complaints` — acceptance_id, partner_id, batch_id, message, status (open/resolved), admin_response, resolved_by, resolved_at. Partner insert/read own; admin read/update all.
- `batch_sales` — batch_id, sale_date, quantity, unit_price, total_amount, buyer, notes, recorded_by. Admin all + partner insert/read for own batches.
- `wallet_withdrawals` — profile_id, batch_id (nullable), amount, status (pending/approved/rejected/paid), admin_note, requested_at, resolved_at, resolved_by. Partner reads own + inserts; admin all.
- `batch_projections` — batch_id (unique), mode ('per_bird' | 'per_kg'), weeks_to_raise, expected_price_per_bird, expected_price_per_kg, expected_avg_weight_kg, notes. Admin all + partner read own.

**Alter existing**
- `livestock_batches`: already has `budget` — add `admin_contribution` numeric default 0.
- `partner_batches`: add `partner_contribution` numeric default 0.

**View / RPC** (SECURITY DEFINER)
- `get_batch_financials(batch_id)` — returns budget, total_expenses, total_sales, gross_profit (sales - expenses), status (in_budget / breakeven / profit), and per-partner allocations.
- `get_partner_wallet(profile_id)` — sums profit share across accepted batches minus approved withdrawals.

## 2. Edge functions
- `notify-admin-complaint` — email admin via existing Gmail secrets when a complaint is filed.
- `notify-admin-withdrawal` — email admin on withdrawal request.
- `notify-partner-batch-assigned` — send in-app notification + email when admin assigns a batch.

## 3. Frontend

**First-login gate for partners** (`PartnerDashboard.tsx`)
- If no row in `partner_bank_details` → block dashboard with `PartnerOnboardingDialog` (full name, phone, address, bank name, account number, account name; zod-validated).
- After saving, load list of pending `batch_acceptances`. For each, show `BatchAcceptanceDialog` (batch summary, budget, ownership %, profit share %, admin contribution). Buttons: **Accept** (opens contribution input; writes acceptance) or **Dispute** (opens complaint form).

**Admin — RegisterBatchDialog** & ManagePartnerBatchesDialog
- Add "Admin Contribution (₦)" field alongside existing budget.
- When assigning batch to partner, auto-create `batch_acceptances` row (pending) and trigger notification.

**Batch Detail View**
- New `BatchFinancialsCard`: Budget, Total Expenses, Total Sales, Remaining Budget, Gross Profit, status pill.
- New `BatchSalesTab` (visible when batch has partner OR always for admin): list + AddSaleDialog.
- New `BatchProjectionCard` (broiler-only or when category set) — admin sets mode + inputs; shows projected revenue/profit vs current spend.

**Analytics chart section on Batch page** (Recharts)
- Line chart: cumulative expenses vs cumulative sales over time.
- Stacked bar: feed / vaccine / care / misc per week.
- Donut: expense breakdown by category.
- Bar: monthly production (from `daily_production`).
- CSV export button for each chart (using existing `exportUtils`).

**Partner Dashboard**
- Wallet card: available balance, pending withdrawals, "Request Withdrawal" button (disabled if < ₦5,000).
- `WithdrawalRequestDialog` (amount, batch, note).
- New charts: monthly production trend, expense breakdown donut, budget-vs-sales line, projected profit gauge. All exportable to CSV.
- Sales tab for their partnered batches (insert + list).

**Admin — new PartnerWithdrawalsTab** (under People group)
- Table of pending requests. Approve (with note) / Reject (with note). Approval deducts virtually via `get_partner_wallet` calculation; sets status paid on second click.

**Admin — ComplaintsTab** (under People/Partners)
- Pending complaints list; admin can respond and mark resolved.

## 4. Technical details
- All monetary displays use `₦` and `toLocaleString('en-NG')`.
- Zod schemas for every new form (onboarding, acceptance, sale, withdrawal, projection).
- RLS: partners can only touch rows tied to their `partners.profile_id` via `partner_has_batch()` helper (already exists).
- Wallet balance calc: `sum(gross_profit_per_batch * profit_share_pct)` where `gross_profit_per_batch = max(0, total_sales - total_expenses)` for batches the partner has accepted, minus `sum(withdrawals where status in ('approved','paid'))`.
- Projections use whichever mode admin picked; unused fields ignored.

## 5. Files
**Migrations:** 1 SQL file (tables + grants + RLS + rpcs + alters).
**Edge functions:** `notify-admin-complaint`, `notify-admin-withdrawal`, `notify-partner-batch-assigned`.
**New components:**
- `src/components/dashboard/partner/PartnerOnboardingDialog.tsx`
- `src/components/dashboard/partner/BatchAcceptanceDialog.tsx`
- `src/components/dashboard/partner/ComplaintDialog.tsx`
- `src/components/dashboard/partner/WalletCard.tsx`
- `src/components/dashboard/partner/WithdrawalRequestDialog.tsx`
- `src/components/dashboard/partner/PartnerAnalyticsCharts.tsx`
- `src/components/dashboard/admin/livestock/BatchFinancialsCard.tsx`
- `src/components/dashboard/admin/livestock/BatchSalesTab.tsx`
- `src/components/dashboard/admin/livestock/BatchProjectionCard.tsx`
- `src/components/dashboard/admin/livestock/BatchAnalyticsCharts.tsx`
- `src/components/dashboard/admin/PartnerWithdrawalsTab.tsx`
- `src/components/dashboard/admin/PartnerComplaintsTab.tsx`
- `src/components/dashboard/admin/dialogs/AddBatchSaleDialog.tsx`

**Edited components:**
- `PartnerDashboard.tsx`, `AdminSidebar.tsx`, `AdminDashboard.tsx`, `RegisterBatchDialog.tsx`, `ManagePartnerBatchesDialog.tsx`, `BatchDetailView.tsx`.

## Next step
On approval I'll run the migration first (approval-gated), then build the code in parallel batches.
