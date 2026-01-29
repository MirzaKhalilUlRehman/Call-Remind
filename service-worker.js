// Service Worker for CallRemind - Background Notifications
const CACHE_NAME = 'callremind-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
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
            
            // Start checking reminders
            startReminderChecker();
            
            return self.clients.claim();
        })
    );
});

// Fetch event - Cache first strategy
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        if (event.request.url.includes('.html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// Handle messages from main app
let scheduledReminders = [];

self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
        scheduleReminder(event.data.reminder);
    }
});

// Schedule a reminder
function scheduleReminder(reminder) {
    console.log('[Service Worker] Scheduling reminder:', reminder.contactName);
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        const reminderData = {
            id: reminder.id,
            contactName: reminder.contactName,
            phoneNumber: reminder.phoneNumber,
            callDate: reminder.callDate,
            callTime: reminder.callTime,
            triggerTime: reminderDateTime.getTime()
        };
        
        scheduledReminders.push(reminderData);
        
        // Save to storage
        saveReminder(reminderData);
        
        console.log(`[Service Worker] Reminder scheduled: ${reminder.contactName} at ${reminder.callTime}`);
    }
}

// Start checking reminders
function startReminderChecker() {
    console.log('[Service Worker] Starting reminder checker');
    
    // Load reminders from storage
    loadReminders();
    
    // Check every 30 seconds
    setInterval(checkReminders, 30000);
    
    // Check immediately
    checkReminders();
}

// Check and trigger reminders
function checkReminders() {
    const now = Date.now();
    
    scheduledReminders.forEach((reminderData, index) => {
        // Check for 5-minute warning
        const fiveMinutesBefore = reminderData.triggerTime - (5 * 60 * 1000);
        
        if (now >= fiveMinutesBefore && now < reminderData.triggerTime) {
            console.log('[Service Worker] Sending 5-minute warning for:', reminderData.contactName);
            
            self.registration.showNotification('⏰ Call Reminder', {
                body: `Call ${reminderData.contactName} in 5 minutes!`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: `reminder-${reminderData.id}`
            });
        }
        
        // Check for exact time (within 1 minute)
        if (now >= reminderData.triggerTime && now < reminderData.triggerTime + 60000) {
            console.log('[Service Worker] Sending reminder for:', reminderData.contactName);
            
            self.registration.showNotification('📞 Time to Call!', {
                body: `Call ${reminderData.contactName} now!${reminderData.phoneNumber ? `\nPhone: ${reminderData.phoneNumber}` : ''}`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: `reminder-${reminderData.id}`,
                data: {
                    reminderId: reminderData.id
                }
            });
            
            // Notify the main app
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'REMINDER_TRIGGERED',
                        reminderId: reminderData.id
                    });
                });
            });
            
            // Remove from scheduled reminders
            scheduledReminders.splice(index, 1);
            removeReminder(reminderData.id);
        }
        
        // Remove if more than 1 hour past
        if (now > reminderData.triggerTime + 3600000) {
            scheduledReminders.splice(index, 1);
            removeReminder(reminderData.id);
        }
    });
}

// Save reminder to storage
function saveReminder(reminderData) {
    const idbRequest = indexedDB.open('CallRemindDB', 1);
    
    idbRequest.onupgradeneeded = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) {
            db.createObjectStore('reminders', { keyPath: 'id' });
        }
    };
    
    idbRequest.onsuccess = function(event) {
        const db = event.target.result;
        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        store.put(reminderData);
    };
}

// Load reminders from storage
function loadReminders() {
    const idbRequest = indexedDB.open('CallRemindDB', 1);
    
    idbRequest.onsuccess = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) return;
        
        const transaction = db.transaction(['reminders'], 'readonly');
        const store = transaction.objectStore('reminders');
        const request = store.getAll();
        
        request.onsuccess = function() {
            scheduledReminders = request.result || [];
            console.log(`[Service Worker] Loaded ${scheduledReminders.length} reminders from storage`);
        };
    };
}

// Remove reminder from storage
function removeReminder(reminderId) {
    const idbRequest = indexedDB.open('CallRemindDB', 1);
    
    idbRequest.onsuccess = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) return;
        
        const transaction = db.transaction(['reminders'], 'readwrite');
        const store = transaction.objectStore('reminders');
        store.delete(reminderId);
    };
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    // Focus or open the app
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            
            if (self.clients.openWindow) {
                return self.clients.openWindow('./');
            }
        })
    );
});

// Push notifications
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