Given the scope (13 substantial features, each requiring new tables, RLS, UI, and in some cases edge functions/cron/storage), I'll ship them in 4 focused phases. Each phase is committed and verifiable before the next starts.

## Phase 1 — Inventory Expansion
1. **Medicine & Vaccine Stock** — `medicines` table (name, type, unit, current_stock, expiry_date, branch_id), `medicine_movements` (purchase/use), expiry alerts on dashboard, dosage logs linked to `clinic_treatments`.
2. **General Supplies** — `supplies` table (name, category, unit, qty, reorder_point, branch_id) + `supply_movements`. Low-stock badge.
3. **Purchase Orders** — `purchase_orders` (supplier, status: draft/sent/partial/received, total) + `purchase_order_items`. On receipt → auto-increment matching feed/medicine/supplies inventory.

## Phase 2 — Operations & Equipment
4. **Equipment Maintenance Log** — `equipment` (name, type, purchase_date, warranty_end, branch) + `maintenance_logs` (date, type, cost, next_due). Dashboard alert when next_due ≤ 7d or warranty ≤ 30d.
5. **Biosecurity Checklist** — `biosecurity_checks` (date, type: visitor/footbath/disinfection, photo_url, performed_by, notes) using existing `evidence-photos` bucket.
6. **Task Assignment Board** — `farm_tasks` (title, description, assigned_to, due_date, priority, status, branch). Worker dashboard tab + admin Kanban.

## Phase 3 — Livestock Depth
7. **Weight-Growth Curves** — `weight_records` (batch_id, date, avg_weight_g, sample_size) + chart vs breed targets stored in `breed_targets` table.
8. **Breeding & Pedigree** — `breeding_records` (sire_batch, dam_batch, mating_date) + `hatching_records` linkage; pedigree view per batch.
9. **Incubation/Hatching Tracker** — `incubation_batches` (eggs_set, set_date, candling_results jsonb, hatch_date, hatched_count, transferred_to_batch_id). Hatch-rate KPI.

## Phase 4 — Analytics, Intelligence & Voice
10. **Period Comparison Tool** — New admin tab. Side-by-side: production, sales, mortality, feed cost, FCR for any two periods (or two batches).
11. **Weather-Production Correlation** — Pull Open-Meteo history for branch coords, overlay temp/humidity on production line chart, highlight days with >15% production drop coinciding with >35°C or >85% humidity.
12. **Automated Scheduled Reports** — Edge function `scheduled-reports` generates weekly+monthly PDF (jspdf) and emails via existing Gmail SMTP. `pg_cron` schedules (Mon 06:00 weekly, 1st 06:00 monthly).
13. **Voice Note Attachments** — New `voice-notes` storage bucket. **Mandatory** voice memo on every mortality record (block submit without recording). Optional on care logs. Stored URL on `mortality_records.voice_note_url` and `livestock_care_logs.voice_note_url`. Browser MediaRecorder → webm upload.

## Conventions applied to every phase
- All tables: `branch_id`, RLS (admins manage; authenticated view), GRANTs to `authenticated`/`service_role`, audit_trail triggers where financial.
- 15-item pagination on every list.
- Semantic tokens only.
- After each phase: I'll confirm before starting the next.

Starting now with **Phase 1 — Inventory Expansion**.