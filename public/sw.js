/* Iyer Mess service worker: shows order-status notifications and opens the right page on tap. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "Iyer Mess", {
        body: data.body || "",
        icon: "/icon-512.png",
        tag: data.tag,
        renotify: Boolean(data.tag), // a new status for the same order still alerts
        requireInteraction: data.kind === "staff", // shop devices keep new orders on screen
        vibrate: [120, 60, 120, 60, 240],
        silent: false,
        data: { url: data.url || "/" },
      });
      // open tabs play the in-app chime (browsers don't allow custom sounds on notifications)
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      tabs.forEach((tab) => tab.postMessage({ type: "iyer-push", payload: data }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = tabs.find((t) => t.url === url);
      if (same) return same.focus();
      if (tabs[0] && "navigate" in tabs[0]) {
        await tabs[0].navigate(url);
        return tabs[0].focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
