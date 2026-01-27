// DOM Elements
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const enableNotificationsBtn = document.getElementById('enableNotifications');
const notificationStatus = document.getElementById('notificationStatus');
const contactNameInput = document.getElementById('contactName');
const phoneNumberInput = document.getElementById('phoneNumber');
const callDateInput = document.getElementById('callDate');
const callTimeInput = document.getElementById('callTime');
const notesInput = document.getElementById('notes');

// Modal elements
const confirmationModal = document.getElementById('confirmationModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const reminderDetails = document.getElementById('reminderDetails');

// Notification elements
const notificationConfirmation = document.getElementById('notificationConfirmation');
const notificationCardTitle = document.getElementById('notificationCardTitle');
const notificationCardMessage = document.getElementById('notificationCardMessage');
const confirmNotificationBtn = document.getElementById('confirmNotification');
const closeNotificationCardBtn = document.getElementById('closeNotificationCard');
const disableNotificationsBtn = document.getElementById('disableNotifications');

// PWA elements
const installPWA = document.getElementById('installPWA');

// Constants
const RETRY_ENABLE_KEY = 'callremind_notification_retry';
const STORAGE_KEY = 'callremind_reminders';

// Variables
let reminders = [];
let reminderToDelete = null;
let lastUpdateTime = 0;
let swRegistration = null;
let isPWAInstalled = false;
let deferredPrompt = null;
let autoInstallAttempted = false;

// Initialize the application
window.addEventListener('DOMContentLoaded', async () => {
    initializeForm();
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    reminders = loadReminders();
    renderReminders();
    updateUpcomingCall();
    checkNotificationPermission();
    startCountdownTimer();
    
    setupEventListeners();
    showRetryNotificationIfBlocked();
    
    // Initialize Service Worker and PWA
    await initServiceWorker();
    checkPWAInstallation();
    
    // Check for missed notifications on page load
    checkMissedNotifications();
    
    // Auto-show install prompt on first load (after 3 seconds)
    setTimeout(() => {
        autoShowInstallPrompt();
    }, 3000);
});

// Initialize form with default values
function initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    callDateInput.min = today;
    callDateInput.value = today;

    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const timeString = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
    callTimeInput.value = timeString;
}

// Set up all event listeners
function setupEventListeners() {
    // Modal events
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal();
        }
    });
    
    // Form submission
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notification events
    enableNotificationsBtn.addEventListener('click', handleEnableNotifications);
    disableNotificationsBtn.addEventListener('click', handleDisableNotifications);
    
    // Notification card events
    closeNotificationCardBtn.addEventListener('click', () => {
        notificationConfirmation.classList.add('hidden');
    });
    
    confirmNotificationBtn.addEventListener('click', () => {
        notificationConfirmation.classList.add('hidden');
    });
    
    notificationConfirmation.addEventListener('click', (e) => {
        if (e.target === notificationConfirmation) {
            notificationConfirmation.classList.add('hidden');
        }
    });
    
    // PWA install button
    if (installPWA) {
        installPWA.addEventListener('click', () => {
            installApp();
        });
    }
    
    // Clear timer on page unload
    window.addEventListener('beforeunload', () => {
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }
    });
    
    // Check notification status on user action
    document.addEventListener('click', checkNotificationOnUserAction);
    
    // PWA installation event - this fires automatically when browser is ready to install
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button immediately
        if (installPWA) {
            installPWA.style.display = 'inline-flex';
        }
    });
    
    // Detect when PWA is installed
    window.addEventListener('appinstalled', (evt) => {
        console.log('App installed successfully');
        isPWAInstalled = true;
        if (installPWA) {
            installPWA.style.display = 'none';
        }
        
        // Update UI
        updatePWAStatus();
        
        showNotification('Success', 'App installed! Now you will get notifications even when Chrome is closed.');
        
        // Show success message
        showNotificationCard('App Installed Successfully', 
            '✅ CallRemind has been installed on your device!<br><br>' +
            'Now you will receive call reminders even when:<br>' +
            '• Chrome is closed<br>' +
            '• Phone is locked<br>' +
            '• App is in background<br><br>' +
            'You can find the app on your home screen.',
            'success'
        );
    });
    
    // Check if running as PWA
    window.addEventListener('load', () => {
        checkPWAInstallation();
    });
}

// Initialize Service Worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('service-worker.js', {
                scope: '/'
            });
            console.log('Service Worker registered:', swRegistration);
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', event => {
                handleServiceWorkerMessage(event.data);
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    } else {
        console.log('Service Worker not supported');
    }
}

// Auto-show install prompt on first load
function autoShowInstallPrompt() {
    // Only auto-show if:
    // 1. Not already installed as PWA
    // 2. Not already attempted
    // 3. User has enabled notifications
    // 4. Deferred prompt is available
    if (!isPWAInstalled && !autoInstallAttempted && deferredPrompt && 
        Notification.permission === 'granted' && installPWA) {
        
        // Show button with animation
        installPWA.style.display = 'inline-flex';
        installPWA.style.animation = 'pulse 2s infinite';
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(76, 201, 240, 0.7); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(76, 201, 240, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(76, 201, 240, 0); }
            }
        `;
        document.head.appendChild(style);
        
        // Show hint after 5 seconds
        setTimeout(() => {
            if (!isPWAInstalled && installPWA.style.display !== 'none') {
                showNotification('Get Background Notifications', 
                    'Click "Install App" to get reminders when Chrome is closed');
            }
        }, 5000);
    }
}

// Install App function - TRIGGERS AUTOMATIC INSTALLATION
async function installApp() {
    if (!deferredPrompt) {
        // If deferred prompt not available, show instructions
        showNotificationCard('Installation Instructions',
            'To install CallRemind for background notifications:<br><br>' +
            '1. Click the <strong>⋮</strong> menu in Chrome<br>' +
            '2. Select <strong>"Install CallRemind"</strong><br>' +
            '3. Follow the on-screen instructions<br><br>' +
            'Or wait for the install prompt to appear automatically.',
            'info'
        );
        return;
    }
    
    console.log('Starting app installation...');
    
    // Show loading state
    if (installPWA) {
        const originalText = installPWA.innerHTML;
        installPWA.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
        installPWA.disabled = true;
    }
    
    try {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const choiceResult = await deferredPrompt.userChoice;
        
        console.log('User choice result:', choiceResult);
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
            isPWAInstalled = true;
            autoInstallAttempted = true;
            
            // The appinstalled event will handle the rest
        } else {
            console.log('User dismissed the install prompt');
            autoInstallAttempted = true;
            
            showNotificationCard('Installation Skipped',
                'You skipped the installation. Without installing:<br><br>' +
                '• Notifications only work when this tab is open<br>' +
                '• Chrome must remain open for reminders<br><br>' +
                'You can install later from Chrome menu.',
                'warning'
            );
        }
        
        // Clear the deferredPrompt variable
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Installation error:', error);
        
        showNotificationCard('Installation Failed',
            'Could not install the app automatically. Try:<br><br>' +
            '1. Click Chrome menu (⋮)<br>' +
            '2. Select "Install CallRemind"<br>' +
            '3. Follow the instructions',
            'error'
        );
    } finally {
        // Restore button state
        if (installPWA) {
            installPWA.innerHTML = '<i class="fas fa-download"></i> Install App for Background';
            installPWA.disabled = false;
            installPWA.style.animation = 'none';
            
            // Hide button if installed or if user dismissed
            if (isPWAInstalled || autoInstallAttempted) {
                installPWA.style.display = 'none';
            }
        }
    }
}

// Check if PWA is installed
function checkPWAInstallation() {
    // Check display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isPWAInstalled = true;
        console.log('Running as PWA (standalone mode)');
        
        // Update UI
        updatePWAStatus();
        
        // Hide install button
        if (installPWA) {
            installPWA.style.display = 'none';
        }
        
        return true;
    }
    
    // Check if launched from home screen
    if (window.navigator.standalone === true) {
        isPWAInstalled = true;
        console.log('Running as PWA (iOS standalone)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    // Check referrer for iOS
    if (document.referrer.includes('android-app://')) {
        isPWAInstalled = true;
        console.log('Running as PWA (Android)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    return false;
}

// Update UI for PWA status
function updatePWAStatus() {
    if (isPWAInstalled) {
        // Update tagline
        document.querySelector('.tagline').innerHTML = 
            'Never miss an important call again <span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-left: 5px;">✓ Background Mode Active</span>';
        
        // Update notification status
        if (notificationStatus) {
            notificationStatus.textContent = 'Background Active';
            notificationStatus.className = 'notification-status text-success';
        }
        
        // Show success indicator in UI
        const pwaBadge = document.createElement('div');
        pwaBadge.className = 'pwa-badge';
        pwaBadge.innerHTML = '<i class="fas fa-check-circle"></i> Background Notifications Active';
        pwaBadge.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: var(--success);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideInRight 0.5s ease;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(pwaBadge);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (pwaBadge.parentNode) {
                pwaBadge.style.transition = 'all 0.5s ease';
                pwaBadge.style.opacity = '0';
                setTimeout(() => {
                    if (pwaBadge.parentNode) {
                        document.body.removeChild(pwaBadge);
                    }
                }, 500);
            }
        }, 5000);
    }
}

// Handle messages from service worker
function handleServiceWorkerMessage(data) {
    if (data.type === 'REMINDER_TRIGGERED' && data.reminderId) {
        const reminder = reminders.find(r => r.id === data.reminderId);
        if (reminder && !reminder.notified) {
            reminder.notified = true;
            reminder.isExpired = true;
            saveReminders();
            renderReminders();
            updateUpcomingCall();
        }
    } else if (data.type === 'SNOOZE_REMINDER' && data.reminderId) {
        snoozeReminder(data.reminderId, data.minutes || 5);
    }
}

// Check notification status on user action
function checkNotificationOnUserAction() {
    if ('Notification' in window) {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            notificationStatus.textContent = isPWAInstalled ? 'Background Active' : 'Enabled';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
            disableNotificationsBtn.style.display = 'inline-flex';
            
            // Show install button if not PWA
            if (!isPWAInstalled && installPWA && !autoInstallAttempted) {
                installPWA.style.display = 'inline-flex';
            }
        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'notification-status text-danger';
            enableNotificationsBtn.style.display = 'inline-flex';
            disableNotificationsBtn.style.display = 'none';
            if (installPWA) installPWA.style.display = 'none';
        } else {
            notificationStatus.textContent = 'Click to enable';
            notificationStatus.className = 'notification-status text-warning';
            enableNotificationsBtn.style.display = 'inline-flex';
            disableNotificationsBtn.style.display = 'none';
            if (installPWA) installPWA.style.display = 'none';
        }
    }
}

// Show retry notification if blocked
function showRetryNotificationIfBlocked() {
    if ('Notification' in window) {
        if (Notification.permission === 'denied') {
            const lastShown = localStorage.getItem(RETRY_ENABLE_KEY);
            const now = new Date().getTime();
            
            if (!lastShown || (now - parseInt(lastShown)) > 24 * 60 * 60 * 1000) {
                showNotificationCard('Notifications Blocked',
                    'Notifications are currently blocked. You will not receive any reminders.<br><br>' +
                    'To enable:<br>' +
                    '1. Click the lock icon (🔒) in address bar<br>' +
                    '2. Change "Notifications" to "Allow"<br>' +
                    '3. Refresh the page',
                    'warning'
                );
                
                enableNotificationsBtn.style.display = 'inline-flex';
                disableNotificationsBtn.style.display = 'none';
                localStorage.setItem(RETRY_ENABLE_KEY, now.toString());
            }
        }
    }
}

// Check for missed notifications
function checkMissedNotifications() {
    const now = new Date();
    const nowTime = now.getTime();
    let missedCount = 0;
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const reminderTime = reminderDateTime.getTime();
        
        if (reminderTime <= nowTime && 
            (nowTime - reminderTime) < 24 * 60 * 60 * 1000 && 
            !reminder.notified && 
            !reminder.isExpired) {
            
            missedCount++;
            reminder.notified = true;
            reminder.isExpired = true;
            
            if (isPWAInstalled) {
                sendBrowserNotification('Missed Call Reminder', 
                    `You missed a call to ${reminder.contactName}`, 
                    reminder.id
                );
            }
        }
    });
    
    if (missedCount > 0) {
        saveReminders();
        renderReminders();
    }
}

// Form submission handler
function handleFormSubmit(e) {
    e.preventDefault();

    const reminder = {
        contactName: contactNameInput.value.trim(),
        phoneNumber: phoneNumberInput.value.trim(),
        callDate: callDateInput.value,
        callTime: callTimeInput.value,
        notes: notesInput.value.trim()
    };

    if (!reminder.contactName) {
        showNotification('Error', 'Please enter a contact name');
        contactNameInput.focus();
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showNotification('Error', 'Please select a future date and time');
        return;
    }

    addReminder(reminder);
    resetForm();
    contactNameInput.focus();
}

// Notification permission handlers
async function handleEnableNotifications() {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        showNotificationCard('Notifications Enabled', 
            'You will now receive call reminders!<br><br>' +
            '<strong>Click "Install App" button below to get background notifications when Chrome is closed.</strong>',
            'success'
        );
        
        showNotification('Success', 'Notifications enabled! Click "Install App" for background mode.');
        
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'inline-flex';
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'notification-status text-success';
        
        localStorage.removeItem(RETRY_ENABLE_KEY);
        
        // Show install button if available
        if (installPWA && !isPWAInstalled && !autoInstallAttempted) {
            installPWA.style.display = 'inline-flex';
        }
        
    } else if (permission === 'denied') {
        showNotificationCard('Notifications Blocked', 
            'You have blocked notifications. To enable them:<br><br>' +
            '1. Click the lock icon (🔒) in address bar<br>' +
            '2. Change "Notifications" to "Allow"<br>' +
            '3. Refresh the page',
            'error'
        );
        
        enableNotificationsBtn.style.display = 'inline-flex';
        disableNotificationsBtn.style.display = 'none';
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'notification-status text-danger';
    }
}

function handleDisableNotifications() {
    if (Notification.permission === 'granted') {
        showNotificationCard('Disable Notifications', 
            'To disable notifications:<br><br>' +
            '1. Click the lock icon (🔒) in address bar<br>' +
            '2. Change "Notifications" to "Block"<br>' +
            '3. Refresh the page',
            'warning'
        );
    }
}

// Local Storage functions
function saveReminders() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    
    if (swRegistration && swRegistration.active) {
        const activeReminders = reminders.filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > new Date() && !r.isExpired;
        });
        
        if (activeReminders.length > 0) {
            swRegistration.active.postMessage({
                type: 'UPDATE_REMINDERS',
                reminders: activeReminders
            });
        }
    }
}

function loadReminders() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Check notification permission
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Not supported';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'none';
        if (installPWA) installPWA.style.display = 'none';
        return;
    }

    const permission = Notification.permission;
    
    if (permission === 'granted') {
        notificationStatus.textContent = isPWAInstalled ? 'Background Active' : 'Enabled';
        notificationStatus.className = 'notification-status text-success';
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'inline-flex';
        
        if (!isPWAInstalled && installPWA && !autoInstallAttempted) {
            installPWA.style.display = 'inline-flex';
        }
        
    } else if (permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'inline-flex';
        disableNotificationsBtn.style.display = 'none';
        if (installPWA) installPWA.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Click to enable';
        notificationStatus.className = 'notification-status text-warning';
        enableNotificationsBtn.style.display = 'inline-flex';
        disableNotificationsBtn.style.display = 'none';
        if (installPWA) installPWA.style.display = 'none';
    }
}

// Send browser notification
function sendBrowserNotification(title, body, reminderId = null) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    try {
        if (swRegistration && isPWAInstalled) {
            swRegistration.showNotification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                tag: `reminder-${reminderId || Date.now()}`,
                renotify: true,
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200],
                actions: [
                    {
                        action: 'mark-done',
                        title: '✓ Mark Done'
                    },
                    {
                        action: 'snooze',
                        title: '⏰ Snooze 5min'
                    }
                ],
                data: {
                    url: window.location.origin,
                    reminderId: reminderId
                }
            });
        } else {
            const notification = new Notification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                
                if (reminderId) {
                    markAsCompleted(reminderId);
                }
            };

            setTimeout(() => notification.close(), 30000);
        }
        
    } catch (error) {
        console.log('Notification error:', error);
    }
}

// Show notification card
function showNotificationCard(title, message, type = 'info') {
    notificationCardTitle.textContent = title;
    notificationCardMessage.innerHTML = message;
    
    const header = notificationConfirmation.querySelector('.notification-card-header');
    header.style.background = type === 'success' ? 'var(--success-light)' : 
                             type === 'error' ? 'var(--danger-light)' : 
                             type === 'warning' ? 'var(--warning-light)' : 
                             'var(--primary-light)';
    header.style.color = type === 'success' ? 'var(--success-dark)' : 
                        type === 'error' ? 'var(--danger-dark)' : 
                        type === 'warning' ? 'var(--warning-dark)' : 
                        'var(--primary-dark)';
    
    notificationConfirmation.classList.remove('hidden');
}

// Show notification toast
function showNotification(title, message) {
    const notificationEl = document.createElement('div');
    notificationEl.className = 'notification-toast';
    notificationEl.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: var(--box-shadow);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        ">
            <strong>${title}</strong>
            <p style="margin: 5px 0 0; font-size: 0.9rem;">${message}</p>
        </div>
    `;

    document.body.appendChild(notificationEl);

    if (title.includes('Notifications')) {
        const type = title.includes('Enabled') || title.includes('Success') ? 'success' : 
                     title.includes('Blocked') || title.includes('Error') ? 'error' : 'warning';
        showNotificationCard(title, message, type);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        notificationEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notificationEl.parentNode) {
                document.body.removeChild(notificationEl);
            }
        }, 300);
    }, 3000);
}

// Reminder CRUD operations
function addReminder(reminder) {
    const newReminder = {
        id: Date.now(),
        contactName: reminder.contactName,
        phoneNumber: reminder.phoneNumber || '',
        callDate: reminder.callDate,
        callTime: reminder.callTime,
        notes: reminder.notes || '',
        createdAt: new Date().toISOString(),
        notified: false,
        isExpired: false,
        notificationStage: 'none'
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    
    if (isPWAInstalled) {
        showNotification('Reminder Added', 
            `Call reminder for ${reminder.contactName} scheduled!<br>You will be notified even when app is closed.`);
    } else {
        showNotification('Reminder Added', 
            `Call reminder for ${reminder.contactName} scheduled!<br>Install app for background notifications.`);
    }
}

function deleteReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminderToDelete = reminder;
        showDeleteConfirmation(reminder);
    }
}

function showDeleteConfirmation(reminder) {
    const formattedDate = new Date(reminder.callDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const formattedTime = new Date(`${reminder.callDate}T${reminder.callTime}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    reminderDetails.innerHTML = `
        <strong><i class="fas fa-user"></i> ${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div class="reminder-time"><i class="far fa-calendar"></i> ${formattedDate} at ${formattedTime}</div>
    `;

    confirmationModal.classList.remove('hidden');
}

function closeModal() {
    confirmationModal.classList.add('hidden');
    reminderToDelete = null;
}

function confirmDelete() {
    if (reminderToDelete) {
        reminders = reminders.filter(reminder => reminder.id !== reminderToDelete.id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        showNotification('Reminder Deleted', `Reminder for ${reminderToDelete.contactName} has been deleted.`);
        closeModal();
    }
}

function markAsCompleted(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        showNotification('Call Completed', `Reminder for ${reminder.contactName} marked as done.`);
    }
}

function snoozeReminder(id, minutes) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        const originalDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const newDateTime = new Date(originalDateTime.getTime() + (minutes * 60 * 1000));
        
        reminder.callDate = newDateTime.toISOString().split('T')[0];
        reminder.callTime = newDateTime.getHours().toString().padStart(2, '0') + ':' + 
                           newDateTime.getMinutes().toString().padStart(2, '0');
        reminder.notified = false;
        reminder.isExpired = false;
        reminder.notificationStage = 'none';
        
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        
        showNotification('Reminder Snoozed', `Reminder for ${reminder.contactName} snoozed for ${minutes} minutes`);
    }
}

function resetForm() {
    reminderForm.reset();
    const today = new Date().toISOString().split('T')[0];
    callDateInput.value = today;

    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

// UI Rendering functions
function renderReminders() {
    reminders.sort((a, b) => {
        const dateA = new Date(`${a.callDate}T${a.callTime}`);
        const dateB = new Date(`${b.callDate}T${b.callTime}`);
        return dateA - dateB;
    });

    reminderCount.textContent = reminders.length;
    reminderList.innerHTML = '';

    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders yet</h3>
                <p>Add your first call reminder above!</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000;
        const isExpired = timeDiff <= 0 || reminder.isExpired;

        const formattedDate = new Date(reminder.callDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const formattedTime = new Date(`${reminder.callDate}T${reminder.callTime}`).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const pwaBadge = isPWAInstalled && !isExpired ? 
            '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 5px;">✓ Background</span>' : '';

        const reminderElement = document.createElement('div');
        reminderElement.className = `reminder-item ${isUrgent ? 'urgent' : ''} ${isExpired ? 'expired' : ''}`;
        reminderElement.innerHTML = `
            <div class="reminder-header">
                <div>
                    <div class="reminder-contact">
                        <i class="fas fa-user"></i> ${reminder.contactName}${pwaBadge}
                    </div>
                    ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
                </div>
                <div class="reminder-time">
                    <i class="far fa-calendar"></i> ${formattedDate} at ${formattedTime}
                </div>
            </div>
            ${reminder.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
            <div class="reminder-actions">
                <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary complete-btn" data-id="${reminder.id}">
                    <i class="fas fa-check"></i> Mark Done
                </button>
                ${!isExpired ? `<button class="btn btn-secondary snooze-btn" data-id="${reminder.id}" data-minutes="5">
                    <i class="fas fa-clock"></i> Snooze 5min
                </button>` : ''}
            </div>
        `;

        reminderList.appendChild(reminderElement);
    });

    // Attach event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            deleteReminder(id);
        });
    });

    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            markAsCompleted(id);
        });
    });

    document.querySelectorAll('.snooze-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const minutes = parseInt(e.currentTarget.dataset.minutes);
            snoozeReminder(id, minutes);
        });
    });
}

function updateUpcomingCall() {
    if (reminders.length === 0) {
        upcomingCall.classList.add('hidden');
        return;
    }

    const now = new Date();
    
    const nextReminder = reminders
        .filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired;
        })
        .sort((a, b) => {
            const dateA = new Date(`${a.callDate}T${a.callTime}`);
            const dateB = new Date(`${b.callDate}T${b.callTime}`);
            return dateA - dateB;
        })[0];

    if (!nextReminder) {
        upcomingCall.classList.add('hidden');
        return;
    }

    upcomingCall.classList.remove('hidden');

    const formattedTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    upcomingContact.textContent = nextReminder.contactName;
    upcomingTime.textContent = formattedTime;
    
    if (isPWAInstalled) {
        upcomingCall.querySelector('.upcoming-details').innerHTML += 
            '<p style="font-size: 0.9rem; margin-top: 5px;"><i class="fas fa-check-circle"></i> Background notifications active</p>';
    } else {
        upcomingCall.querySelector('.upcoming-details').innerHTML += 
            '<p style="font-size: 0.9rem; margin-top: 5px;"><i class="fas fa-exclamation-triangle"></i> Install app for background notifications</p>';
    }
}

// Countdown Timer functions
function startCountdownTimer() {
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        
        if (now.getTime() - lastUpdateTime > 5000) {
            updateRemindersStatus(now);
            lastUpdateTime = now.getTime();
        }
        
        const upcomingReminders = reminders.filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired;
        });
        
        if (upcomingReminders.length === 0) {
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            return;
        }
        
        const nextReminder = upcomingReminders.sort((a, b) => {
            const dateA = new Date(`${a.callDate}T${a.callTime}`);
            const dateB = new Date(`${b.callDate}T${b.callTime}`);
            return dateA - dateB;
        })[0];
        
        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        
        if (timeDiff > 0) {
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            if (days > 0) {
                countdownElement.textContent = `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            upcomingCall.classList.remove('hidden');
            const formattedTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            upcomingContact.textContent = nextReminder.contactName;
            upcomingTime.textContent = formattedTime;
            
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified && nextReminder.notificationStage !== '5min') {
                sendBrowserNotification('Call in 5 minutes!', `Call ${nextReminder.contactName} in 5 minutes`, nextReminder.id);
                nextReminder.notificationStage = '5min';
                saveReminders();
            } else if (timeDiff <= 60 * 1000 && !nextReminder.notified && nextReminder.notificationStage !== '1min') {
                sendBrowserNotification('Call in 1 minute!', `Call ${nextReminder.contactName} in 1 minute`, nextReminder.id);
                nextReminder.notificationStage = '1min';
                saveReminders();
            }
        } else {
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            
            if (!nextReminder.notified) {
                sendBrowserNotification('Time to Call!', `It's time to call ${nextReminder.contactName}!`, nextReminder.id);
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
            }
        }
    }, 1000);
}

function updateRemindersStatus(currentTime) {
    let needsUpdate = false;
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const timeDiff = reminderDateTime - currentTime;
        
        if (timeDiff <= 0 && !reminder.isExpired) {
            reminder.isExpired = true;
            reminder.notified = true;
            needsUpdate = true;
        }
    });
    
    if (needsUpdate) {
        saveReminders();
        renderReminders();
        updateUpcomingCall();
    }
}

// Clean up old reminders
window.addEventListener('load', () => {
    const now = new Date();
    const validReminders = reminders.filter(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        return reminderDateTime > now || (now - reminderDateTime) < 24 * 60 * 60 * 1000;
    });

    if (validReminders.length !== reminders.length) {
        reminders = validReminders;
        saveReminders();
        renderReminders();
    }
});
