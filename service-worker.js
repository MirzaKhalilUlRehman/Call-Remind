const CACHE_NAME = 'callremind-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});

// Push notifications
self.addEventListener('push', (event) => {
    let data = {
        title: '📞 Call Reminder',
        body: 'Time to make a call!',
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };
    
    if (event.data) {
        try {
            const pushData = event.data.json();
            if (pushData.title) data.title = pushData.title;
            if (pushData.body) data.body = pushData.body;
            if (pushData.reminderId) data.data = { reminderId: pushData.reminderId };
        } catch (e) {
            console.log('Push data parse error:', e);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, data)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
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
            // Open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

// Background sync for reminders
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reminders') {
        event.waitUntil(syncReminders());
    }
});

// Sync reminders
async function syncReminders() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_REMINDERS',
                timestamp: Date.now()
            });
        });
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Message handling
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'TEST_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
        });
    }
    
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        scheduleReminder(event.data.reminder);
    }
});

// Schedule reminder in background
function scheduleReminder(reminder) {
    const reminderTime = new Date(`${reminder.date}T${reminder.time}`).getTime();
    const now = Date.now();
    const delay = reminderTime - now;
    
    if (delay > 0) {
        setTimeout(() => {
            self.registration.showNotification('📞 Call Reminder', {
                body: `Time to call ${reminder.contactName}!`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                data: { reminderId: reminder.id }
            });
            
            // Notify the client
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'REMINDER_TRIGGERED',
                        reminderId: reminder.id
                    });
                });
            });
        }, delay);
    }
}