# Project architecture
- Keep batch extensions as separate batch-scoped tabs and use database-enforced admin/assigned-partner access for new records and files; shared batch views serve both audiences.
- Customer credit is enforced against canonical sales records, and individual reminders resolve recipients and unpaid balances server-side using existing Gmail secrets; client-supplied addresses or balances are never trusted.
- QR codes link to an authenticated traceability page backed by a permission-checked summary function; a QR code grants no access.
- Keep what-if calculations pure and separate from saved records so simulations never change actual production, expenses or profit.
- Market catalog and guest orders are separate from operational farm sales; calculate checkout prices server-side and permit fulfilment only after verified payment to prevent tampered totals and unpaid dispatch.
- Market authorization uses protected user_roles and market_is_admin, never editable profile fields; product images use permission-gated signed storage URLs.