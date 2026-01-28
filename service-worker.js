self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    return self.clients.claim();
});

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {title: 'Call Reminder', body: 'Time to call!'};
    
    const options = {
        body: data.body,
        requireInteraction: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({type: 'window'}).then(clientList => {
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