// Service Worker for CallRemind - Background Notifications
const CACHE_NAME = 'callremind-pwa-v1';
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
                console.log('[Service Worker] Caching app files');
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

// Fetch event - Cache first, then network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
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
                        // Return cached HTML if network fails
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

// Schedule reminder for background
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
        
        scheduledReminders.push(reminderData);
        saveReminderToStorage(reminderData);
        
        console.log(`[Service Worker] Reminder scheduled: ${reminder.contactName} at ${reminder.callTime}`);
    }
}

// Start checking reminders
function startReminderChecker() {
    console.log('[Service Worker] Starting reminder checker');
    
    // Load reminders from storage
    loadRemindersFromStorage();
    
    // Check every minute
    setInterval(checkReminders, 60000);
    
    // Check immediately
    checkReminders();
}

// Check and trigger reminders
function checkReminders() {
    const now = Date.now();
    console.log(`[Service Worker] Checking ${scheduledReminders.length} reminders`);
    
    scheduledReminders.forEach((reminderData, index) => {
        // 5 minutes before reminder
        const fiveMinutesBefore = reminderData.triggerTime - (5 * 60 * 1000);
        
        // Send 5-minute warning
        if (now >= fiveMinutesBefore && now < reminderData.triggerTime) {
            sendBackgroundNotification(
                '⏰ Call Reminder',
                `Call ${reminderData.contactName} in 5 minutes!`,
                reminderData
            );
        }
        
        // Exact time (within 1 minute window)
        if (now >= reminderData.triggerTime && now < reminderData.triggerTime + 60000) {
            sendBackgroundNotification(
                '📞 Time to Call!',
                `Call ${reminderData.contactName} now!${reminderData.phoneNumber ? `\nPhone: ${reminderData.phoneNumber}` : ''}`,
                reminderData
            );
            
            // Notify the app
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'REMINDER_TRIGGERED',
                        reminderId: reminderData.id
                    });
                });
            });
            
            // Remove from array
            scheduledReminders.splice(index, 1);
            removeReminderFromStorage(reminderData.id);
        }
        
        // Remove if more than 1 hour past
        if (now > reminderData.triggerTime + 3600000) {
            scheduledReminders.splice(index, 1);
            removeReminderFromStorage(reminderData.id);
        }
    });
}

// Send background notification
function sendBackgroundNotification(title, body, reminderData) {
    console.log('[Service Worker] Sending notification:', title);
    
    self.registration.showNotification(title, {
        body: body,
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
        requireInteraction: true,
        tag: `reminder-${reminderData.id}`,
        data: {
            reminderId: reminderData.id,
            contactName: reminderData.contactName,
            phoneNumber: reminderData.phoneNumber
        },
        actions: [
            {
                action: 'snooze',
                title: '⏰ Snooze 5 min'
            }
        ]
    });
}

// Storage functions for reminders
function saveReminderToStorage(reminderData) {
    // Using IndexedDB or localStorage via postMessage
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                type: 'SAVE_REMINDER',
                reminder: reminderData
            });
        });
    });
}

function loadRemindersFromStorage() {
    // Reminders will be sent by main app when service worker starts
}

function removeReminderFromStorage(reminderId) {
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({
                type: 'REMOVE_REMINDER',
                reminderId: reminderId
            });
        });
    });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.notification.data);
    
    event.notification.close();
    
    if (event.action === 'snooze') {
        // Snooze for 5 minutes
        const reminderData = event.notification.data;
        if (reminderData) {
            const snoozedReminder = {
                ...reminderData,
                triggerTime: Date.now() + (5 * 60 * 1000)
            };
            scheduledReminders.push(snoozedReminder);
        }
    }
    
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

// Push notifications (optional)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    let data = {
        title: 'Call Reminder',
        body: 'You have a call reminder!'
    };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            data.body = event.data.text() || data.body;
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            requireInteraction: true
        })
    );
});