// Service Worker for background notifications
let scheduledReminders = [];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
});

// Handle messages from main app
self.addEventListener('message', (event) => {
    console.log('Message received in service worker:', event.data);
    
    if (event.data.type === 'SCHEDULE_REMINDER') {
        scheduleReminder(event.data.reminder);
    }
});

// Schedule reminder
function scheduleReminder(reminder) {
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        scheduledReminders.push({
            reminder: reminder,
            triggerTime: reminderDateTime.getTime()
        });
        
        console.log(`Reminder scheduled: ${reminder.contactName} at ${reminder.callTime}`);
        
        // Check reminders every minute
        setInterval(checkReminders, 60000);
    }
}

// Check scheduled reminders
function checkReminders() {
    const now = Date.now();
    
    scheduledReminders.forEach((scheduled, index) => {
        if (now >= scheduled.triggerTime - 300000) { // 5 minutes before
            // Send notification
            self.registration.showNotification('Call Reminder', {
                body: `Call ${scheduled.reminder.contactName} in 5 minutes!`,
                requireInteraction: true,
                tag: `reminder-${scheduled.reminder.id}`,
                data: { reminderId: scheduled.reminder.id }
            });
            
            // Remove from array
            scheduledReminders.splice(index, 1);
        }
    });
}

// Push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
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
        requireInteraction: true,
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'check-reminders') {
        event.waitUntil(checkReminders());
    }
});

// Periodic background sync
if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('check-reminders', {
        minInterval: 5 * 60 * 1000 // 5 minutes
    }).then(() => {
        console.log('Periodic sync registered');
    });
}