// Supabase Edge Function: sync-calendar
// Creates / updates / deletes a Google Calendar event for a timed reminder.
// Adds two alerts: a popup 30 minutes before, and a popup at the time.
//
// One-time Google setup (see README):
//   1. Create a Google Cloud project, enable the Google Calendar API.
//   2. Create a Service Account, make a JSON key, download it.
//   3. In Google Calendar settings, share YOUR calendar with the service account's
//      email ("client_email") with "Make changes to events".
//
// Deploy:  supabase functions deploy sync-calendar
// Secrets:
//   supabase secrets set GOOGLE_SERVICE_ACCOUNT='<paste the whole JSON key on one line>'
//   supabase secrets set GOOGLE_CALENDAR_ID='your-gmail@gmail.com'   (the calendar to write to)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const CAL = () => encodeURIComponent(Deno.env.get("GOOGLE_CALENDAR_ID") || "primary");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const token = await getAccessToken();

    if (body.action === "delete") {
      if (body.event_id) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${CAL()}/events/${body.event_id}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      }
      return json({ ok: true });
    }

    // upsert
    const start = new Date(body.due_at);
    const end = new Date(start.getTime() + 30 * 60000);
    const event = {
      summary: body.text,
      description: "Added from Reminders",
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "popup", minutes: 0 },
        ],
      },
    };

    let url = `https://www.googleapis.com/calendar/v3/calendars/${CAL()}/events`;
    let method = "POST";
    if (body.event_id) { url += `/${body.event_id}`; method = "PATCH"; }

    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!r.ok) return json({ error: "calendar failed", detail: await r.text() }, 502);
    const data = await r.json();
    return json({ eventId: data.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

/* ---- Service-account OAuth (JWT bearer → access token), no external libs ---- */
async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT") || "{}");
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc(claim)}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tok = await res.json();
  if (!tok.access_token) throw new Error("token error: " + JSON.stringify(tok));
  return tok.access_token;
}

function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBytes(pem: string): Uint8Array {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
