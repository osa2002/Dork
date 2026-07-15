const CACHE_NAME = "dork-queue-v1";

// Cache essential static assets on installation
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/manifest.json",
        "/icon.svg",
        "/icon-192.png",
        "/icon-512.png",
        "/screenshot-desktop.jpg",
        "/screenshot-mobile.jpg"
      ]).catch((err) => {
        console.warn("Pre-caching warning (this is fine, assets will be cached on demand):", err);
      });
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Deleting old service worker cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First with Cache Fallback fetching strategy
self.addEventListener("fetch", (event) => {
  // We only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Exclude Firestore API calls, Firebase Auth, and third-party WebSocket/SSE connections
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.pathname.startsWith("/__/") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  ) {
    return;
  }

  // Only handle HTTP/HTTPS protocols (avoid chrome-extension issues)
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If we got a valid response, cache it on the fly for future offline use
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fetch fails (offline), search in cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If SPA page navigation fails, return the cached root '/' (index.html)
          if (event.request.mode === "navigate") {
            return caches.match("/").then((cachedIndex) => {
              if (cachedIndex) return cachedIndex;
              return openDB().then(db => {
                return new Promise((resolve) => {
                  const tx = db.transaction("cached_data", "readonly");
                  const store = tx.objectStore("cached_data");
                  const req = store.get("sw_fallback_ticket");
                  req.onsuccess = () => resolve(req.result ? req.result.value : null);
                  req.onerror = () => resolve(null);
                });
              }).then(ticket => {
                if (ticket) {
                  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>تذكرتي (وضع عدم الاتصال)</title><style>body { font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #0f172a; } .card { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); text-align: center; width: 100%; max-width: 400px; } .number { font-size: 80px; font-weight: 900; color: #4f46e5; margin: 20px 0; } .status { background: #e0e7ff; color: #4338ca; padding: 8px 16px; border-radius: 99px; font-weight: bold; display: inline-block; margin-bottom: 20px; } .offline-badge { background: #fef08a; color: #854d0e; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; margin-bottom: 20px; display: inline-block; }</style></head><body><div class="card"><div class="offline-badge">وضع عدم الاتصال 📶❌</div><h2>${ticket.shopName || "تذكرتي"}</h2><div class="number">${String(ticket.ticketNumber).padStart(2, "0")}</div><div class="status">${ticket.status === "waiting" ? "في الانتظار" : ticket.status === "calling" ? "يتم المناداة" : ticket.status === "completed" ? "مكتمل" : ticket.status}</div><div>الخدمة: ${ticket.serviceName}</div><div style="margin-top: 10px; font-size: 0.9rem; color: #64748b;">العميل: ${ticket.customerName}</div></div></body></html>`;
                  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
                }
                return null;
              });
            });
          }

          return null;
        });
      })
  );
});

// IndexedDB Initialization inside the Service Worker
const DB_NAME = "dork-queue-db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("cached_data")) {
        db.createObjectStore("cached_data", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pending_tickets")) {
        db.createObjectStore("pending_tickets", { keyPath: "id" });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// Background Sync Event Listener
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tickets") {
    console.log("[Service Worker] Sync event fired for tag: sync-tickets");
    event.waitUntil(notifyClientsToSync());
  }
});

// Broadcast synchronization signal to all open client tabs
async function notifyClientsToSync() {
  const allClients = await self.clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type: "TRIGGER_OFFLINE_SYNC" });
  }
}

// Listen to postMessage from tabs
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CACHE_TICKET_DATA") {
    event.waitUntil(
      openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction("cached_data", "readwrite");
          const store = transaction.objectStore("cached_data");
          store.put({ key: "sw_fallback_ticket", value: event.data.payload, timestamp: Date.now() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      })
    );
  }

  if (event.data && event.data.type === "OFFLINE_SYNC_TRIGGER") {
    event.waitUntil(notifyClientsToSync());
  }
});

