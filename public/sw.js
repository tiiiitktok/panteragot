// Service Worker do Noxion — roda em segundo plano no celular (depois
// que o site é adicionado à tela de início) e é o responsável por exibir
// a notificação do sistema quando o servidor envia um push.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Noxion", body: "Nova notificação de venda." };
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "noxion",
    renotify: true,
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(data.title || "Noxion", options));
});

// Ao tocar na notificação, abre (ou foca) o painel
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
