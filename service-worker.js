// Service Worker for CallRemind
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    return self.clients.claim();
});

self.addEventListener('push', event => {
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
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📞</text></svg>',
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('Notification clicked');
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(clientList => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
