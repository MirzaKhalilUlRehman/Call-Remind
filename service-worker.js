// Service Worker for CallRemind - Background Notifications
const CACHE_NAME = 'callremind-v2';
const APP_NAME = 'CallRemind';
const NOTIFICATION_ICON = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png';

// URLs to cache
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap'
];

// Install event - Cache all necessary files
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[Service Worker] Install completed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activation completed');
            return self.clients.claim();
        })
    );
});

// Fetch event - Serve from cache first, then network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip chrome-extension requests
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if available
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Check if we received a valid response
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
                    })
                    .catch(() => {
                        // If both cache and network fail, show offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Push notification event - HANDLES BACKGROUND NOTIFICATIONS
self.addEventListener('push', event => {
    console.log('[Service Worker] Push received:', event);

    if (!event.data) {
        console.log('[Service Worker] No push data');
        return;
    }

    let data = {};
    try {
        data = event.data.json();
    } catch (error) {
        console.log('[Service Worker] Parsing push data failed:', error);
        data = {
            title: 'Call Reminder',
            body: event.data.text() || 'Time to make a call!'
        };
    }

    const options = {
        body: data.body || 'You have a call reminder',
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: `call-reminder-${data.reminderId || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            url: data.url || '/',
            reminderId: data.reminderId,
            timestamp: new Date().toISOString()
        },
        actions: [
            {
                action: 'mark-done',
                title: '✓ Mark Done'
            },
            {
                action: 'snooze',
                title: '⏰ Snooze 5min'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Call Reminder', options)
            .then(() => {
                console.log('[Service Worker] Notification shown successfully');

                // Send message to all clients
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'REMINDER_TRIGGERED',
                            reminderId: data.reminderId
                        });
                    });
                });
            })
            .catch(error => {
                console.error('[Service Worker] Failed to show notification:', error);
            })
    );
});

// Notification click event
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked:', event);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';
    const reminderId = event.notification.data?.reminderId;

    // Handle action buttons
    if (event.action === 'mark-done' && reminderId) {
        // Mark as done
        self.clients.matchAll().then(clients => {
            if (clients.length > 0) {
                clients[0].postMessage({
                    type: 'REMINDER_TRIGGERED',
                    reminderId: reminderId
                });
                clients[0].focus();
            }
        });
    } else if (event.action === 'snooze' && reminderId) {
        // Snooze reminder
        self.clients.matchAll().then(clients => {
            if (clients.length > 0) {
                clients[0].postMessage({
                    type: 'SNOOZE_REMINDER',
                    reminderId: reminderId,
                    minutes: 5
                });
                clients[0].focus();
            }
        });
    } else {
        // Regular click - open/focus the app
        event.waitUntil(
            self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then(clientList => {
                // Check if app is already open
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        client.postMessage({
                            type: 'FOCUS_APP',
                            reminderId: reminderId
                        });
                        return client.focus();
                    }
                }

                // Open new window if app not open
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
        );
    }
});

// Message event from main app
self.addEventListener('message', event => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'UPDATE_REMINDERS') {
        handleUpdateReminders(event.data.reminders);
    } else if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        scheduleNotification(event.data);
    } else if (event.data && event.data.type === 'TEST_NOTIFICATION') {
        self.registration.showNotification('Test Notification', {
            body: 'Service Worker is working correctly!',
            icon: NOTIFICATION_ICON,
            tag: 'test-notification'
        });
    }
});

// Handle updating reminders in background
function handleUpdateReminders(reminders) {
    console.log('[Service Worker] Received reminders:', reminders);

    // Store reminders in IndexedDB for background use
    if (reminders && reminders.length > 0) {
        // For now, just log them
        reminders.forEach(reminder => {
            const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
            const now = new Date();
            const timeDiff = reminderTime - now;

            console.log(`[Service Worker] Reminder scheduled: ${reminder.contactName} at ${reminder.callTime} (in ${Math.round(timeDiff / 60000)} minutes)`);
        });
    }
}

// Schedule a notification (simplified version)
function scheduleNotification(data) {
    console.log('[Service Worker] Scheduling notification:', data);

    // In a real implementation, you would use the Push API
    // or scheduled notifications (Chrome 80+)

    // For now, we rely on push notifications from a server
    // This is where you would integrate with a push notification service
}

// Background sync (if needed in future)
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-reminders') {
        event.waitUntil(syncReminders());
    }
});

async function syncReminders() {
    // Sync logic here
    console.log('[Service Worker] Syncing reminders...');
}