// Service Worker for CallRemind
const CACHE_NAME = 'callremind-v1';
const OFFLINE_URL = 'offline.html';

const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/style.css',
    '/script.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap',
    'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker installed and cached');
                return self.skipWaiting();
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Claiming clients');
            return self.clients.claim();
        })
    );
});

// Fetch event
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // If offline and request is for a page, return offline page
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});

// Background sync for reminders
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event.tag);
    
    if (event.tag === 'reminder-sync') {
        event.waitUntil(syncReminders());
    }
});

// Sync reminders function
async function syncReminders() {
    console.log('Syncing reminders...');
    
    try {
        const clients = await self.clients.matchAll();
        if (clients && clients.length) {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_REMINDERS'
                });
            });
        }
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    let data = {
        title: '📞 Call Reminder',
        body: 'Time to make a call!',
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };
    
    // Try to parse push data
    if (event.data) {
        try {
            const pushData = event.data.json();
            if (pushData.title) data.title = pushData.title;
            if (pushData.body) data.body = pushData.body;
        } catch (e) {
            console.log('Using default push data');
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, data)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            // Focus existing window
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if none exists
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

// Periodic sync for reminders
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-reminders') {
        console.log('Periodic sync for reminders');
        event.waitUntil(checkScheduledReminders());
    }
});

// Check scheduled reminders
async function checkScheduledReminders() {
    try {
        // Get scheduled reminders from localStorage via clients
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'CHECK_SCHEDULED_REMINDERS'
            });
        });
    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        scheduleReminderNotification(event.data.reminder);
    }
});

// Schedule reminder notification
function scheduleReminderNotification(reminder) {
    // This is a simplified version - in a real app, you would use 
    // the Notification API with service worker registration
    console.log('Scheduling reminder:', reminder);
    
    // Store in IndexedDB for background checking
    // For simplicity, we'll just log it here
    // In production, implement proper scheduling
}