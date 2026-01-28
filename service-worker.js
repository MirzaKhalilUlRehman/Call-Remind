// Service Worker for CallRemind - Background Notifications
const CACHE_NAME = 'callremind-v2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500&display=swap',
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
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
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
            
            // Load scheduled reminders from storage
            loadScheduledReminders();
            
            // Start checking reminders
            startReminderChecker();
            
            return self.clients.claim();
        })
    );
});

// Fetch event - Cache first strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
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
                        // If network fails and no cache, return offline page
                        if (event.request.url.includes('.html')) {
                            return caches.match('./index.html');
                        }
                        return new Response('Network error', { status: 408, statusText: 'Offline' });
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
    } else if (event.data && event.data.type === 'CLEAR_REMINDERS') {
        clearAllReminders();
    }
});

// Schedule a new reminder
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
            notes: reminder.notes,
            triggerTime: reminderDateTime.getTime(),
            createdAt: Date.now()
        };
        
        // Add to array
        scheduledReminders.push(reminderData);
        
        // Save to IndexedDB for persistence
        saveReminderToDB(reminderData);
        
        console.log(`[Service Worker] Reminder scheduled for ${reminder.contactName} at ${reminder.callTime}`);
        
        // Send confirmation back to client
        sendMessageToClients({
            type: 'REMINDER_SCHEDULED',
            reminderId: reminder.id,
            contactName: reminder.contactName
        });
    }
}

// Start checking reminders periodically
function startReminderChecker() {
    console.log('[Service Worker] Starting reminder checker');
    
    // Check immediately
    checkReminders();
    
    // Then check every minute
    setInterval(checkReminders, 60000);
}

// Check and trigger reminders
function checkReminders() {
    const now = Date.now();
    console.log(`[Service Worker] Checking ${scheduledReminders.length} scheduled reminders`);
    
    scheduledReminders = scheduledReminders.filter(reminderData => {
        // Check if it's time to trigger (5 minutes before or exact time)
        const fiveMinutesBefore = reminderData.triggerTime - (5 * 60 * 1000);
        const oneMinuteAfter = reminderData.triggerTime + (60 * 1000);
        
        // 5-minute warning
        if (now >= fiveMinutesBefore && now < reminderData.triggerTime) {
            sendReminderNotification(reminderData, '5_MINUTE_WARNING');
            return true; // Keep for exact time trigger
        }
        
        // Exact time (within 1 minute window)
        if (now >= reminderData.triggerTime && now < oneMinuteAfter) {
            sendReminderNotification(reminderData, 'EXACT_TIME');
            
            // Notify client app
            sendMessageToClients({
                type: 'REMINDER_TRIGGERED',
                reminderId: reminderData.id
            });
            
            // Remove from storage
            deleteReminderFromDB(reminderData.id);
            return false; // Remove from array
        }
        
        // If more than 1 minute past, remove
        if (now > oneMinuteAfter) {
            deleteReminderFromDB(reminderData.id);
            return false; // Remove from array
        }
        
        return true; // Keep for future checking
    });
}

// Send reminder notification
function sendReminderNotification(reminderData, type) {
    let title, body;
    
    if (type === '5_MINUTE_WARNING') {
        title = 'Call Reminder';
        body = `Call ${reminderData.contactName} in 5 minutes!`;
    } else {
        title = 'Time to Call!';
        body = `Call ${reminderData.contactName} now!`;
        
        if (reminderData.phoneNumber) {
            body += `\nPhone: ${reminderData.phoneNumber}`;
        }
    }
    
    const options = {
        body: body,
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        tag: `reminder-${reminderData.id}`,
        data: {
            reminderId: reminderData.id,
            type: type,
            contactName: reminderData.contactName,
            phoneNumber: reminderData.phoneNumber
        },
        actions: [
            {
                action: 'call',
                title: '📞 Call Now'
            },
            {
                action: 'snooze',
                title: '⏰ Snooze 5 min'
            }
        ]
    };
    
    self.registration.showNotification(title, options);
    console.log(`[Service Worker] Notification sent: ${title} - ${body}`);
}

// Send message to all clients
function sendMessageToClients(message) {
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage(message);
        });
    });
}

// IndexedDB for reminder persistence
const DB_NAME = 'CallRemindDB';
const DB_VERSION = 1;
const STORE_NAME = 'reminders';

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('triggerTime', 'triggerTime', { unique: false });
                console.log('[Service Worker] IndexedDB store created');
            }
        };
    });
}

// Save reminder to IndexedDB
function saveReminderToDB(reminderData) {
    initDB().then((db) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(reminderData);
    }).catch(console.error);
}

// Delete reminder from IndexedDB
function deleteReminderFromDB(reminderId) {
    initDB().then((db) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(reminderId);
    }).catch(console.error);
}

// Load scheduled reminders from IndexedDB
function loadScheduledReminders() {
    initDB().then((db) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            scheduledReminders = request.result || [];
            console.log(`[Service Worker] Loaded ${scheduledReminders.length} reminders from storage`);
            
            // Clean up old reminders (older than 1 day)
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            scheduledReminders = scheduledReminders.filter(reminder => {
                if (reminder.createdAt < oneDayAgo) {
                    deleteReminderFromDB(reminder.id);
                    return false;
                }
                return true;
            });
        };
        
        request.onerror = () => console.error('[Service Worker] Failed to load reminders from DB');
    }).catch(console.error);
}

// Clear all reminders
function clearAllReminders() {
    initDB().then((db) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        scheduledReminders = [];
        console.log('[Service Worker] All reminders cleared');
    }).catch(console.error);
}

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.notification.data);
    
    event.notification.close();
    
    const notificationData = event.notification.data;
    
    // Handle action buttons
    if (event.action === 'call' && notificationData.phoneNumber) {
        // In a real app, you would initiate a phone call
        // For web, we can try to open tel: link or just show the number
        console.log('Call action clicked for:', notificationData.phoneNumber);
    } else if (event.action === 'snooze') {
        // Snooze for 5 minutes
        const snoozedReminder = {
            ...notificationData,
            triggerTime: Date.now() + (5 * 60 * 1000)
        };
        scheduledReminders.push(snoozedReminder);
        saveReminderToDB(snoozedReminder);
    }
    
    // Focus or open the app
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

// Push notifications (optional - for future use)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    let data = {
        title: 'Call Reminder',
        body: 'You have a scheduled call reminder!'
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

// Background sync (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-reminders') {
        console.log('[Service Worker] Background sync for reminders');
        event.waitUntil(syncReminders());
    }
});

function syncReminders() {
    // Sync logic would go here
    return Promise.resolve();
}

// Periodic sync (if supported)
if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('reminder-check', {
        minInterval: 5 * 60 * 1000 // 5 minutes
    }).then(() => {
        console.log('[Service Worker] Periodic sync registered');
    }).catch(console.error);
}