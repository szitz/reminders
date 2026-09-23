// Supabase Edge Function: transcribe
// Receives a voice note (multipart form field "file") and returns { text } using OpenAI Whisper.
// The OpenAI key stays server-side.
//
// Deploy:  supabase functions deploy transcribe
// Secret:  supabase secrets set OPENAI_API_KEY=sk-...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return json({ error: "no audio file" }, 400);
    if (file.size > 25 * 1024 * 1024) return json({ error: "file too large (25MB max)" }, 413);

    const out = new FormData();
    out.append("file", file, file.name || "note.webm");
    out.append("model", "whisper-1");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });
    if (!r.ok) return json({ error: "whisper failed", detail: await r.text() }, 502);
    const data = await r.json();
    return json({ text: (data.text || "").trim() });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
