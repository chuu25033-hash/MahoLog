// 詠唱の満了・静息明けの通知を出すためだけの service worker。
// 通信には関わらない（fetch を扱わないので、キャッシュもしない）。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// 通知に触れたら、開いている詠唱の間へ戻る（無ければ開く）
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).pathname.startsWith("/timer")) ?? list[0];
      if (open) return open.focus();
      return self.clients.openWindow("/timer");
    }),
  );
});
