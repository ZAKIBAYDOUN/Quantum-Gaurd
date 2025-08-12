// 5470 Core Wallet - Service Worker for PWA
const CACHE_NAME = '5470-wallet-v1.0.0';
const STATIC_CACHE_NAME = '5470-wallet-static-v1.0.0';

// Critical files to cache for offline functionality
const CRITICAL_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
];

// Static assets to cache
const STATIC_ASSETS = [
  '/icon.svg'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('💎 5470 Wallet SW: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache critical assets
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(CRITICAL_ASSETS);
      }),
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
    ]).then(() => {
      console.log('✅ 5470 Wallet SW: Critical assets cached');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 5470 Wallet SW: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('🗑️ 5470 Wallet SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ 5470 Wallet SW: Activated and ready');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first strategy for API calls, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API calls with network first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for caching
          const responseClone = response.clone();
          
          // Cache successful API responses
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline page for critical APIs
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Handle static assets with cache first strategy
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.split('/').pop()))) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request);
      })
    );
    return;
  }

  // Handle page navigation with network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('/').then((cachedResponse) => {
            return cachedResponse || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Default: try network first, fallback to cache
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Handle background sync for mining updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-mining') {
    console.log('⛏️ 5470 Wallet SW: Background sync mining data');
    event.waitUntil(
      fetch('/api/mining/stats')
        .then(response => response.json())
        .then(data => {
          // Notify clients about mining updates
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'MINING_UPDATE',
                data: data
              });
            });
          });
        })
        .catch(err => console.log('Mining sync failed:', err))
    );
  }
});

// Handle push notifications for mining rewards
self.addEventListener('push', (event) => {
  console.log('📱 5470 Wallet SW: Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New mining reward received!',
      icon: '/icon-192x192.png',
      badge: '/icon-144x144.png',
      vibrate: [200, 100, 200],
      data: {
        url: '/'
      },
      actions: [
        {
          action: 'view',
          title: 'View Wallet',
          icon: '/icon-192x192.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || '5470 Core Wallet',
        options
      )
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 5470 Wallet SW: Notification clicked');
  
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if no existing window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

console.log('💎 5470 Core Wallet Service Worker loaded');