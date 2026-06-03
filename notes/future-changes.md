# FieldFlow — Future Changes & Deferred Features

## Email Automation via n8n (Phase 2 — deferred)
**What:** When a quote is created/sent, automatically email the client with the quote link.
Also: automated follow-up reminders if client hasn't approved after X days.
**How:**
- FieldFlow API fires a webhook to n8n when quote status changes to 'sent'
- n8n sends email via Gmail/Outlook/SMTP with the public quote link
- Webhook payload: client_name, client_email, quote_title, total, quote_link, expiry_date
- Store n8n webhook URL as QUOTES_N8N_WEBHOOK_URL in Vercel env vars
**Status:** Deferred — user has n8n running, needs workflow setup first

## Future Phases
- Phase 3: Jobs & Scheduling (fieldflow-jobs Supabase on Neon.tech)
- Phase 4: Invoicing — generate from accepted quotes (fieldflow-invoices)
- Phase 5: Dashboard stats across all modules, PDF export, search
