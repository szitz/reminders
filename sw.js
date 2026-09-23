/* Reminders PWA service worker */
const CACHE = "reminders-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "share-inbox").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // --- Share target: WhatsApp (or anything) shares audio/text into the app ---
  if (e.request.method === "POST" && url.searchParams.has("share-target")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const inbox = await caches.open("share-inbox");
        const file = form.get("files") || form.get("file");
        const text = (form.get("text") || form.get("title") || "").toString();
        if (file && file.size) {
          await inbox.put("shared-file", new Response(file, { headers: { "Content-Type": file.type || "audio/webm" } }));
        } else if (text) {
          await inbox.put("shared-text", new Response(text));
        }
      } catch (err) { /* ignore */ }
      return Response.redirect("./?share-target", 303);
    })());
    return;
  }

  // --- App shell: network-first for navigation, cache fallback (offline) ---
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// --- Optional push (Calendar is the default alert mechanism; this is just a fallback hook) ---
self.addEventListener("push", e => {
  let data = { title: "\u23F0 Reminder", body: "" };
  try { data = e.data.json(); } catch (_) { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title || "\u23F0 Reminder", {
    body: data.body || "", icon: "./icon-192.png", badge: "./icon-192.png", vibrate: [120, 60, 120]
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return clients.openWindow("./");
  }));
});
