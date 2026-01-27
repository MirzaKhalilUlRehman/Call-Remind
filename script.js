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
let installButtonClicked = false;

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
    
    // Initialize Service Worker
    await initServiceWorker();
    checkPWAInstallation();
    
    // Check for missed notifications
    checkMissedNotifications();
    
    // Auto-show install button after delay
    setTimeout(() => {
        showInstallButtonIfPossible();
    }, 2000);
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
    
    // Install button click - TRIGGERS INSTALLATION
    if (installPWA) {
        installPWA.addEventListener('click', async () => {
            await triggerAppInstallation();
        });
    }
    
    // Clear timer on page unload
    window.addEventListener('beforeunload', () => {
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }
    });
    
    // Check notification status
    document.addEventListener('click', checkNotificationOnUserAction);
    
    // PWA Before Install Prompt - THIS IS THE KEY EVENT
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('🔔 beforeinstallprompt event triggered');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button immediately
        if (installPWA && !isPWAInstalled) {
            installPWA.style.display = 'inline-flex';
            installPWA.innerHTML = '<i class="fas fa-download"></i> Install App Now';
            
            // Add animation
            installPWA.style.animation = 'pulse 2s infinite';
            
            // Create pulse animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(76, 201, 240, 0.7); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(76, 201, 240, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(76, 201, 240, 0); }
                }
            `;
            document.head.appendChild(style);
        }
    });
    
    // App installed successfully
    window.addEventListener('appinstalled', (evt) => {
        console.log('✅ App installed successfully');
        isPWAInstalled = true;
        installButtonClicked = false;
        
        // Hide install button
        if (installPWA) {
            installPWA.style.display = 'none';
        }
        
        // Update UI
        updatePWAStatus();
        
        // Show success notification
        showNotification('Success', 'App installed! Now you will get notifications even when Chrome is closed.');
        
        // Force reload to activate service worker in standalone mode
        setTimeout(() => {
            if (window.matchMedia('(display-mode: standalone)').matches) {
                window.location.reload();
            }
        }, 1000);
    });
    
    // Page load
    window.addEventListener('load', () => {
        checkPWAInstallation();
    });
}

// Initialize Service Worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('service-worker.js', {
                scope: './',
                updateViaCache: 'none'
            });
            
            console.log('✅ Service Worker registered:', swRegistration);
            
            // Listen for messages
            navigator.serviceWorker.addEventListener('message', event => {
                handleServiceWorkerMessage(event.data);
            });
            
            // Check if service worker is controlling the page
            if (navigator.serviceWorker.controller) {
                console.log('✅ Service Worker is controlling the page');
            }
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    } else {
        console.log('❌ Service Worker not supported');
    }
}

// Show install button if possible
function showInstallButtonIfPossible() {
    // Check if already installed
    if (isPWAInstalled) {
        if (installPWA) {
            installPWA.style.display = 'none';
        }
        return;
    }
    
    // Check if deferred prompt is available
    if (deferredPrompt && installPWA) {
        installPWA.style.display = 'inline-flex';
        installPWA.innerHTML = '<i class="fas fa-download"></i> Install App Now';
    }
}

// TRIGGER APP INSTALLATION - MAIN FUNCTION
async function triggerAppInstallation() {
    console.log('🚀 Starting app installation...');
    
    if (!deferredPrompt) {
        console.log('❌ No install prompt available');
        
        // Show manual installation instructions
        showNotificationCard('Manual Installation Required',
            'To install CallRemind:<br><br>' +
            '1. Click the <strong>⋮</strong> (menu) in Chrome<br>' +
            '2. Select <strong>"Install CallRemind"</strong><br>' +
            '3. Click <strong>"Install"</strong><br><br>' +
            'After installation, open from home screen.',
            'info'
        );
        return;
    }
    
    // Show loading state
    if (installPWA) {
        const originalText = installPWA.innerHTML;
        installPWA.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
        installPWA.disabled = true;
        installButtonClicked = true;
    }
    
    try {
        // Show the browser's native install prompt
        console.log('📱 Showing install prompt...');
        deferredPrompt.prompt();
        
        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;
        console.log('👤 User choice:', choiceResult);
        
        if (choiceResult.outcome === 'accepted') {
            console.log('✅ User accepted installation');
            
            // The appinstalled event will handle the rest
            showNotification('Installing...', 'App installation started. Please wait...');
            
        } else {
            console.log('❌ User declined installation');
            installButtonClicked = false;
            
            showNotificationCard('Installation Cancelled',
                'You can install later:<br><br>' +
                '1. Click Chrome menu (⋮)<br>' +
                '2. Select "Install CallRemind"<br>' +
                '3. Click "Install"',
                'warning'
            );
        }
        
        // Clear the prompt
        deferredPrompt = null;
        
    } catch (error) {
        console.error('💥 Installation error:', error);
        installButtonClicked = false;
        
        showNotificationCard('Installation Error',
            'Could not install automatically. Try:<br><br>' +
            '1. Use Chrome browser<br>' +
            '2. Enable "Install" in Chrome flags<br>' +
            '3. Try manual installation',
            'error'
        );
        
    } finally {
        // Restore button
        if (installPWA && !isPWAInstalled) {
            installPWA.innerHTML = '<i class="fas fa-download"></i> Install App Now';
            installPWA.disabled = false;
            installPWA.style.animation = 'none';
        }
    }
}

// Check if PWA is installed
function checkPWAInstallation() {
    // Multiple methods to check PWA installation
    
    // Method 1: Display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isPWAInstalled = true;
        console.log('✅ Running as PWA (standalone mode)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    // Method 2: Navigator standalone (iOS)
    if (window.navigator.standalone === true) {
        isPWAInstalled = true;
        console.log('✅ Running as PWA (iOS standalone)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    // Method 3: Check if launched from home screen
    if (window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches) {
        isPWAInstalled = true;
        console.log('✅ Running as PWA (fullscreen/minimal-ui)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    // Method 4: Check referrer
    if (document.referrer.includes('android-app://')) {
        isPWAInstalled = true;
        console.log('✅ Running as PWA (Android)');
        updatePWAStatus();
        if (installPWA) installPWA.style.display = 'none';
        return true;
    }
    
    console.log('❌ Not running as PWA');
    return false;
}

// Update UI for PWA status
function updatePWAStatus() {
    if (isPWAInstalled) {
        // Update tagline
        const tagline = document.querySelector('.tagline');
        if (tagline) {
            tagline.innerHTML = 'Never miss an important call again <span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-left: 5px;">✓ Background Active</span>';
        }
        
        // Update notification status
        if (notificationStatus) {
            notificationStatus.textContent = 'Background Active';
            notificationStatus.className = 'notification-status text-success';
        }
        
        // Show success badge
        const existingBadge = document.querySelector('.pwa-success-badge');
        if (!existingBadge) {
            const pwaBadge = document.createElement('div');
            pwaBadge.className = 'pwa-success-badge';
            pwaBadge.innerHTML = '<i class="fas fa-check-circle"></i> Background Mode Active';
            pwaBadge.style.cssText = `
                position: fixed;
                top: 70px;
                right: 10px;
                background: var(--success);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 0.8rem;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideInRight 0.5s ease;
                border: 2px solid white;
            `;
            document.body.appendChild(pwaBadge);
            
            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
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
    }
}

// Check notification status
function checkNotificationOnUserAction() {
    if ('Notification' in window) {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            notificationStatus.textContent = isPWAInstalled ? 'Background Active' : 'Enabled';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
            disableNotificationsBtn.style.display = 'inline-flex';
            
            // Show install button if not PWA
            if (!isPWAInstalled && installPWA && deferredPrompt) {
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
                    'Notifications are blocked. To enable:<br><br>' +
                    '1. Click lock icon (🔒) in address bar<br>' +
                    '2. Change "Notifications" to "Allow"<br>' +
                    '3. Refresh page',
                    'warning'
                );
                
                localStorage.setItem(RETRY_ENABLE_KEY, now.toString());
            }
        }
    }
}

// Check for missed notifications
function checkMissedNotifications() {
    const now = new Date();
    const nowTime = now.getTime();
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const reminderTime = reminderDateTime.getTime();
        
        if (reminderTime <= nowTime && 
            (nowTime - reminderTime) < 24 * 60 * 60 * 1000 && 
            !reminder.notified && 
            !reminder.isExpired) {
            
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
    
    saveReminders();
    renderReminders();
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
        showNotification('Success', 'Notifications enabled! Install app for background mode.');
        
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'inline-flex';
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'notification-status text-success';
        
        localStorage.removeItem(RETRY_ENABLE_KEY);
        
        // Show install button
        if (installPWA && !isPWAInstalled) {
            showInstallButtonIfPossible();
        }
        
    } else if (permission === 'denied') {
        showNotificationCard('Notifications Blocked', 
            'You blocked notifications. To enable:<br><br>' +
            '1. Click lock icon (🔒) in address bar<br>' +
            '2. Change "Notifications" to "Allow"<br>' +
            '3. Refresh page',
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
            'To disable:<br><br>' +
            '1. Click lock icon (🔒) in address bar<br>' +
            '2. Change "Notifications" to "Block"<br>' +
            '3. Refresh page',
            'warning'
        );
    }
}

// Local Storage functions
function saveReminders() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
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
        
        if (!isPWAInstalled && installPWA) {
            showInstallButtonIfPossible();
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
                vibrate: [200, 100, 200],
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
                if (reminderId) markAsCompleted(reminderId);
            };

            setTimeout(() => notification.close(), 10000);
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
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        ">
            <strong>${title}</strong>
            <p style="margin: 5px 0 0; font-size: 0.9rem;">${message}</p>
        </div>
    `;

    document.body.appendChild(notificationEl);

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
        isExpired: false
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    
    if (isPWAInstalled) {
        showNotification('Reminder Added', 
            `✅ Call reminder for ${reminder.contactName} scheduled!<br>You will be notified even when app is closed.`);
    } else {
        showNotification('Reminder Added', 
            `✅ Call reminder for ${reminder.contactName} scheduled!<br>Install app for background notifications.`);
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
        showNotification('Reminder Deleted', `Reminder for ${reminderToDelete.contactName} deleted.`);
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
        showNotification('Call Completed', `Reminder for ${reminder.contactName} marked done.`);
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

        const reminderElement = document.createElement('div');
        reminderElement.className = `reminder-item ${isUrgent ? 'urgent' : ''} ${isExpired ? 'expired' : ''}`;
        reminderElement.innerHTML = `
            <div class="reminder-header">
                <div>
                    <div class="reminder-contact">
                        <i class="fas fa-user"></i> ${reminder.contactName}
                        ${isPWAInstalled && !isExpired ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 5px;">✓ Background</span>' : ''}
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
            </div>
        `;

        reminderList.appendChild(reminderElement);
    });

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
            
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendBrowserNotification('Call in 5 minutes!', `Call ${nextReminder.contactName} in 5 minutes`, nextReminder.id);
                nextReminder.notified = true;
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
