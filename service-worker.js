// Simple Service Worker for CallRemind
const CACHE_NAME = 'callremind-v1';

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(self.clients.claim());
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
        console.log(`[Service Worker] Reminder scheduled: ${reminder.contactName}`);
        
        // Start checking if not already started
        if (!window.reminderCheckInterval) {
            window.reminderCheckInterval = setInterval(checkReminders, 60000); // Check every minute
            checkReminders();
        }
    }
}

// Check reminders
function checkReminders() {
    const now = Date.now();
    
    scheduledReminders.forEach((reminderData, index) => {
        // Check for 5-minute warning
        const fiveMinutesBefore = reminderData.triggerTime - (5 * 60 * 1000);
        
        if (now >= fiveMinutesBefore && now < reminderData.triggerTime) {
            self.registration.showNotification('⏰ Call Reminder', {
                body: `Call ${reminderData.contactName} in 5 minutes!`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: `reminder-${reminderData.id}`
            });
        }
        
        // Check for exact time
        if (now >= reminderData.triggerTime && now < reminderData.triggerTime + 60000) {
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
            
            // Remove from array
            scheduledReminders.splice(index, 1);
        }
    });
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
                return self.clients.openWindow('/');
            }
        })
    );
});