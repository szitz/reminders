-- Reminders app — Supabase schema
-- Run this in the Supabase SQL editor (or let Claude apply it for you).

create table if not exists public.reminders (
  id              uuid primary key default gen_random_uuid(),
  text            text not null,
  due_at          timestamptz,               -- null = "anytime" / general reminder
  done            boolean not null default false,
  done_at         timestamptz,
  google_event_id text,                       -- set once synced to Google Calendar
  created_at      timestamptz not null default now()
);

create index if not exists reminders_active_idx on public.reminders (done, due_at);

alter table public.reminders enable row level security;

-- ---- Choose ONE access model ----

-- (A) SIMPLE: anon key can read/write (fine for a private 2-person tool; anyone with
--     your URL + anon key could reach the data, so keep those out of public repos).
create policy "anon full access" on public.reminders
  for all to anon using (true) with check (true);

-- (B) SAFER (recommended): comment out policy (A) above, set USE_PASSWORD_GATE=true in
--     the app, create ONE shared Supabase Auth user, and use this instead:
-- create policy "authed full access" on public.reminders
--   for all to authenticated using (true) with check (true);

-- Realtime so both phones stay in sync live:
alter publication supabase_realtime add table public.reminders;
