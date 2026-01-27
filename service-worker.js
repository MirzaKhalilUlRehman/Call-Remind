// Service Worker for CallRemind
const CACHE_NAME = 'callremind-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
];

// Install event
self.addEventListener('install', event => {
    console.log('Service Worker installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache opened');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');

    // Clean up old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - Serve from cache first, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    // Cache the new resource
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Push notification event
self.addEventListener('push', event => {
    console.log('Push notification received:', event);

    if (!event.data) {
        console.log('No notification data');
        return;
    }

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: 'Call Reminder',
            body: event.data.text() || 'Time to make a call!'
        };
    }

    const options = {
        body: data.body || 'Call reminder!',
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        tag: 'call-reminder',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/',
            reminderId: data.reminderId
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Call Reminder', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }

            // Open new window if app not open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Message event from main app
self.addEventListener('message', event => {
    console.log('Message received in service worker:', event.data);

    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        // You can implement scheduled notifications here
        console.log('Schedule notification:', event.data);
    }
});