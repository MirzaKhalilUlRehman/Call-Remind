// Service Worker for CallRemind
const CACHE_NAME = 'callremind-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed:', error);
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - Cache first, then network strategy
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Check if we received a valid response
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
                        // If both cache and network fail, show offline page
                        return caches.match('/index.html');
                    });
            })
    );
});

// Handle messages from main app
let scheduledReminders = [];

self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        scheduleReminder(event.data.reminder);
    }
});

// Schedule reminder
function scheduleReminder(reminder) {
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    console.log('Service Worker: Scheduling reminder for', reminder.contactName, 'in', timeDiff, 'ms');
    
    if (timeDiff > 0) {
        const reminderData = {
            reminder: reminder,
            triggerTime: reminderDateTime.getTime()
        };
        
        scheduledReminders.push(reminderData);
        
        // Store in IndexedDB for persistence
        storeReminder(reminderData);
        
        // Set up periodic check
        if (!window.reminderCheckInterval) {
            window.reminderCheckInterval = setInterval(checkReminders, 60000); // Check every minute
        }
        
        // Send confirmation to client
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'REMINDER_SCHEDULED',
                    reminderId: reminder.id
                });
            });
        });
    }
}

// Check reminders
function checkReminders() {
    const now = Date.now();
    
    console.log('Service Worker: Checking', scheduledReminders.length, 'scheduled reminders');
    
    scheduledReminders.forEach((scheduled, index) => {
        // 5 minutes before
        if (now >= scheduled.triggerTime - 300000 && now < scheduled.triggerTime) {
            console.log('Service Worker: Sending 5-minute notification for', scheduled.reminder.contactName);
            
            self.registration.showNotification('Call Reminder', {
                body: `Call ${scheduled.reminder.contactName} in 5 minutes!`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: `reminder-${scheduled.reminder.id}`,
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                data: { 
                    reminderId: scheduled.reminder.id,
                    type: '5_MINUTE_WARNING'
                }
            });
        }
        
        // Exact time
        if (now >= scheduled.triggerTime && now < scheduled.triggerTime + 60000) { // Within 1 minute of exact time
            console.log('Service Worker: Sending exact time notification for', scheduled.reminder.contactName);
            
            self.registration.showNotification('Time to Call!', {
                body: `Call ${scheduled.reminder.contactName} now!`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: `reminder-${scheduled.reminder.id}`,
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                data: { 
                    reminderId: scheduled.reminder.id,
                    type: 'EXACT_TIME'
                }
            });
            
            // Notify the client
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'REMINDER_TRIGGERED',
                        reminderId: scheduled.reminder.id
                    });
                });
            });
            
            // Remove from array
            scheduledReminders.splice(index, 1);
            removeReminder(scheduled.reminder.id);
        }
    });
    
    // Clean up old reminders (more than 1 hour past)
    scheduledReminders = scheduledReminders.filter(scheduled => {
        return now < scheduled.triggerTime + 3600000; // Keep if less than 1 hour past
    });
}

// Simple storage using IndexedDB
function storeReminder(reminderData) {
    // Using IndexedDB for persistence
    const request = indexedDB.open('CallRemindDB', 1);
    
    request.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) {
            db.createObjectStore('reminders', { keyPath: 'id' });
        }
    };
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        
        store.put({
            id: reminderData.reminder.id,
            data: reminderData,
            timestamp: Date.now()
        });
    };
}

function removeReminder(reminderId) {
    const request = indexedDB.open('CallRemindDB', 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        
        store.delete(reminderId);
    };
}

// Load reminders from IndexedDB on service worker activation
function loadRemindersFromStorage() {
    const request = indexedDB.open('CallRemindDB', 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) {
            return;
        }
        
        const transaction = db.transaction(['reminders'], 'readonly');
        const store = transaction.objectStore('reminders');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = function() {
            const storedReminders = getAllRequest.result;
            scheduledReminders = storedReminders.map(item => item.data);
            console.log('Service Worker: Loaded', scheduledReminders.length, 'reminders from storage');
        };
    };
}

// Load reminders when service worker activates
loadRemindersFromStorage();

// Push notifications (if you add push support later)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    let data = {
        title: 'Call Reminder',
        body: 'Time to make a call!'
    };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            data.body = event.data.text() || data.body;
        }
    }
    
    const options = {
        body: data.body,
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked', event.notification.data);
    
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
                return self.clients.openWindow('/');
            }
        })
    );
});

// Background sync (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reminders') {
        event.waitUntil(syncReminders());
    }
});

function syncReminders() {
    console.log('Service Worker: Background sync running');
    // Add your sync logic here
    return Promise.resolve();
}