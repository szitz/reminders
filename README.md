# Reminders — a shared WhatsApp-style reminder list

A tiny installable web app (PWA) for two people. Type or record a reminder;
timed ones sync to Google Calendar so your phone alerts you 30 min before and
at the time. Runs on free tiers (Supabase) + a few dollars of OpenAI Whisper.

## What's here
```
index.html              the whole app (UI + logic)
manifest.webmanifest    installability + WhatsApp "share to app"
sw.js                   service worker (install, offline, share hand-off)
schema.sql              Supabase database table
icon-192.png / 512.png  app icons
supabase/functions/
  transcribe/           voice note → text (OpenAI Whisper; key stays server-side)
  sync-calendar/        timed reminder → Google Calendar event (30-min + at-time alerts)
```

## Three ways a reminder gets in
1. Type it in the app (natural language like "call the dentist tomorrow at 3").
2. Tap the mic and talk, then Send (WhatsApp-style).
3. In WhatsApp, long-press her message → Share → **Reminders**.

Anytime reminders stay in the list. Timed ones also appear as Google Calendar events.

---

## Setup (about 20 minutes, once)

### 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → paste `schema.sql` → run.
3. Project settings → API → copy the **Project URL** and **anon key**.

### 2. Whisper transcription (~$5 lasts a long time)
1. Get an OpenAI API key.
2. `supabase secrets set OPENAI_API_KEY=sk-...`
3. `supabase functions deploy transcribe`

### 3. Google Calendar sync
1. Google Cloud console → new project → enable **Google Calendar API**.
2. Create a **Service Account** → **Keys** → add key → JSON → download.
3. Open Google Calendar (web) → your calendar → Settings → **Share with specific people** →
   add the service account's `client_email` → permission **Make changes to events**.
4. Set the secrets and deploy:
   ```
   supabase secrets set GOOGLE_SERVICE_ACCOUNT='<the whole JSON on one line>'
   supabase secrets set GOOGLE_CALENDAR_ID='your-gmail@gmail.com'
   supabase functions deploy sync-calendar
   ```

### 4. Fill in the app
Edit the `CONFIG` block at the top of `index.html`:
```js
SUPABASE_URL:      "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "eyJ...",
TRANSCRIBE_URL:    "https://xxxx.supabase.co/functions/v1/transcribe",
CALENDAR_SYNC_URL: "https://xxxx.supabase.co/functions/v1/sync-calendar",
```

### 5. Host it on GitHub Pages
1. New repo → upload all files (keep the folder structure).
2. Settings → Pages → deploy from `main` / root.
3. Open the URL on each Android phone → Chrome menu → **Install app / Add to home screen**.

Done. Open it, record a note, watch it land in the list — and if it had a time,
check your Google Calendar.

---

## Notes
- **anon key is safe to expose** (that's its purpose); it's protected by the row-level
  security policy in `schema.sql`. For extra privacy, switch to the password-gate option
  in `schema.sql` and set `USE_PASSWORD_GATE`, `SHARED_EMAIL` in CONFIG.
- **No backend yet?** Leave the CONFIG fields blank — the app still runs on one phone
  using local storage and the phone's built-in voice dictation. Fill them in to sync
  both phones and enable Whisper + Calendar.
- Time phrases understood: today/tonight/tomorrow, weekdays ("monday", "next friday"),
  "at 3", "3:30pm", "in 20 minutes", "in 2 hours", noon, this morning/afternoon/evening.
  No time found → it's an "Anytime" reminder.
