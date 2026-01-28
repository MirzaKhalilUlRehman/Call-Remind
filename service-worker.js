// Simple Service Worker for CallRemind
const CACHE_NAME = 'callremind-v1';

// Files to cache
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Install complete');
                return self.skipWaiting();
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        // Cache the new response
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // If network fails, return offline page
                        if (event.request.url.includes('.html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    // You can add message handling here if needed
});

// Handle push notifications (if you add push support later)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    const options = {
        body: 'You have a call reminder!',
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification('CallRemind', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Otherwise open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow('./');
            }
        })
    );
});