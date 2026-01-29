// Service Worker for CallRemind
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

// Fetch event - Cache first
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

// Schedule reminder
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
        
        // Save to IndexedDB
        saveReminderToDB(reminderData);
        
        console.log(`[Service Worker] Reminder scheduled: ${reminder.contactName} at ${reminder.callTime}`);
    }
}

// Start checking reminders
function startReminderChecker() {
    console.log('[Service Worker] Starting reminder checker');
    
    // Load reminders from DB
    loadRemindersFromDB();
    
    // Check every 30 seconds
    setInterval(checkReminders, 30000);
    
    // Check immediately
    checkReminders();
}

// Check reminders
function checkReminders() {
    const now = Date.now();
    
    scheduledReminders.forEach((reminderData, index) => {
        // 5-minute warning
        const fiveMinutesBefore = reminderData.triggerTime - (5 * 60 * 1000);
        
        if (now >= fiveMinutesBefore && now < reminderData.triggerTime) {
            sendReminderNotification(
                '⏰ Call Reminder',
                `Call ${reminderData.contactName} in 5 minutes!`,
                reminderData
            );
        }
        
        // Exact time
        if (now >= reminderData.triggerTime && now < reminderData.triggerTime + 60000) {
            sendReminderNotification(
                '📞 Time to Call!',
                `Call ${reminderData.contactName} now!${reminderData.phoneNumber ? `\nPhone: ${reminderData.phoneNumber}` : ''}`,
                reminderData
            );
            
            // Notify app
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'REMINDER_TRIGGERED',
                        reminderId: reminderData.id
                    });
                });
            });
            
            // Remove
            scheduledReminders.splice(index, 1);
            deleteReminderFromDB(reminderData.id);
        }
    });
}

// Send notification
function sendReminderNotification(title, body, reminderData) {
    console.log('[Service Worker] Sending notification:', title);
    
    self.registration.showNotification(title, {
        body: body,
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        tag: `reminder-${reminderData.id}`,
        data: {
            reminderId: reminderData.id
        }
    });
}

// IndexedDB functions
function saveReminderToDB(reminderData) {
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
        store.put(reminderData);
    };
}

function loadRemindersFromDB() {
    const request = indexedDB.open('CallRemindDB', 1);
    
    request.onsuccess = function(event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('reminders')) return;
        
        const transaction = db.transaction(['reminders'], 'readonly');
        const store = transaction.objectStore('reminders');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = function() {
            scheduledReminders = getAllRequest.result || [];
            console.log(`[Service Worker] Loaded ${scheduledReminders.length} reminders from DB`);
        };
    };
}

function deleteReminderFromDB(reminderId) {
    const request = indexedDB.open('CallRemindDB', 1);
    
    request.onsuccess = function(event) {
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