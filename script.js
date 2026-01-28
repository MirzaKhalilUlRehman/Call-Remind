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
const installButton = document.getElementById('installButton');
const installedButton = document.getElementById('installedButton');
const installInfo = document.getElementById('installInfo');
const pwaStatus = document.getElementById('pwaStatus');
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

// Toast element
const toastElement = document.getElementById('toast');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;
let serviceWorkerRegistration = null;

// Check if app is already installed
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://') ||
           window.location.protocol === 'file:';
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default date/time
    initializeDateTime();
    
    // Load reminders from localStorage
    loadReminders();
    
    // Render UI
    renderReminders();
    updateUpcomingCall();
    checkNotificationPermission();
    startCountdownTimer();
    
    // Initialize Service Worker
    await initServiceWorker();
    
    // Check PWA installation status
    checkPWAStatus();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check for existing reminders and schedule them
    scheduleExistingReminders();
    
    // Show welcome message
    showToast('Welcome to CallRemind!', 'info');
});

// Initialize date and time inputs
function initializeDateTime() {
    const today = new Date().toISOString().split('T')[0];
    callDateInput.min = today;
    callDateInput.value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

// Load reminders from localStorage
function loadReminders() {
    try {
        const storedReminders = localStorage.getItem('callremind_reminders');
        reminders = storedReminders ? JSON.parse(storedReminders) : [];
        
        // Validate and clean up expired reminders
        const now = new Date();
        reminders.forEach(reminder => {
            const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
            if (reminderDateTime <= now) {
                reminder.isExpired = true;
            }
        });
        
        // Remove very old reminders (older than 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        reminders = reminders.filter(reminder => {
            const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
            return reminderDateTime > thirtyDaysAgo;
        });
        
        saveReminders();
        
    } catch (error) {
        console.error('Error loading reminders:', error);
        reminders = [];
        showToast('Error loading reminders', 'error');
    }
}

// Initialize Service Worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('service-worker.js', {
                scope: './'
            });
            
            console.log('Service Worker registered successfully');
            
            // Check for service worker updates
            serviceWorkerRegistration.addEventListener('updatefound', () => {
                const newWorker = serviceWorkerRegistration.installing;
                console.log('Service Worker update found:', newWorker.state);
                
                newWorker.addEventListener('statechange', () => {
                    console.log('New Service Worker state:', newWorker.state);
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('New version available! Refresh to update.', 'info');
                    }
                });
            });
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', event => {
                console.log('Message from Service Worker:', event.data);
                
                if (event.data && event.data.type === 'REMINDER_TRIGGERED') {
                    const reminderId = event.data.reminderId;
                    const reminder = reminders.find(r => r.id === reminderId);
                    if (reminder) {
                        reminder.notified = true;
                        reminder.isExpired = true;
                        saveReminders();
                        renderReminders();
                        updateUpcomingCall();
                        
                        // Show notification even if app is open
                        showToast(`Time to call ${reminder.contactName}!`, 'warning');
                    }
                }
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            showToast('Service Worker failed to register', 'error');
        }
    } else {
        console.log('Service Workers are not supported');
        showToast('Background notifications not supported', 'warning');
    }
}

// Check PWA status and show appropriate buttons
function checkPWAStatus() {
    const isInstalled = isPWAInstalled();
    
    if (isInstalled) {
        console.log('PWA is already installed');
        installButton.classList.add('hidden');
        installedButton.classList.remove('hidden');
        installInfo.classList.add('hidden');
        pwaStatus.classList.remove('hidden');
    } else {
        console.log('PWA is not installed');
        installButton.classList.add('hidden'); // Hidden by default, will show when installable
        installedButton.classList.add('hidden');
        installInfo.classList.remove('hidden');
        pwaStatus.classList.add('hidden');
    }
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast:not(.hidden)');
    if (existingToast) {
        existingToast.classList.add('hidden');
    }
    
    // Set toast content and style
    toastElement.textContent = message;
    toastElement.className = `toast ${type}`;
    toastElement.classList.remove('hidden');
    
    // Add icon based on type
    let icon = 'ℹ️';
    switch(type) {
        case 'success': icon = '✅'; break;
        case 'warning': icon = '⚠️'; break;
        case 'error': icon = '❌'; break;
        case 'info': icon = 'ℹ️'; break;
    }
    toastElement.textContent = `${icon} ${message}`;
    
    // Auto hide after duration
    setTimeout(() => {
        toastElement.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            toastElement.classList.add('hidden');
            toastElement.style.animation = '';
        }, 300);
    }, duration);
}

// Event Listeners
function setupEventListeners() {
    // Modal events
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal();
        }
    });
    
    // Form submission
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notifications
    enableNotificationsBtn.addEventListener('click', handleEnableNotifications);
    
    // Install button
    installButton.addEventListener('click', handleInstall);
    
    // PWA install prompt - This event shows the install button
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button with animation
        installButton.classList.remove('hidden');
        installButton.classList.add('pulse');
        
        showToast('Install CallRemind for background notifications!', 'info', 5000);
    });
    
    // App installed successfully
    window.addEventListener('appinstalled', () => {
        console.log('App installed successfully');
        deferredPrompt = null;
        
        // Update UI
        installButton.classList.add('hidden');
        installButton.classList.remove('pulse');
        installedButton.classList.remove('hidden');
        installInfo.classList.add('hidden');
        pwaStatus.classList.remove('hidden');
        
        showToast('CallRemind installed successfully! You will now get background notifications.', 'success');
        
        // Reschedule all reminders with background support
        scheduleExistingReminders();
    });
    
    // Handle Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !confirmationModal.classList.contains('hidden')) {
            closeModal();
        }
    });
    
    // Handle online/offline status
    window.addEventListener('online', () => {
        showToast('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
        showToast('You are offline. Some features may be limited.', 'warning');
    });
}

// Handle PWA installation
async function handleInstall() {
    if (!deferredPrompt) {
        // Show manual installation instructions
        showManualInstallInstructions();
        return;
    }
    
    // Show loading state
    const originalText = installButton.innerHTML;
    installButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    installButton.disabled = true;
    
    try {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
            // The appinstalled event will handle the UI update
        } else {
            console.log('User dismissed install');
            showToast('Installation cancelled', 'warning');
            
            // Reset button
            installButton.innerHTML = originalText;
            installButton.disabled = false;
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Install error:', error);
        showToast('Installation failed. Please try again.', 'error');
        
        // Reset button
        installButton.innerHTML = originalText;
        installButton.disabled = false;
    }
}

// Show manual installation instructions
function showManualInstallInstructions() {
    const instructions = `
How to install CallRemind:

On Chrome/Edge (Desktop):
1. Click the menu button (⋮) in the top right
2. Select "Install CallRemind" or "Add to Home Screen"
3. Click "Install"

On Chrome (Android):
1. Tap the menu button (⋮) in the top right
2. Tap "Add to Home screen"
3. Tap "Add"

On Safari (iPhone/iPad):
1. Tap the Share button (📤)
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add"

Installing the app enables background notifications!`;

    if (confirm(instructions)) {
        // User acknowledged
    }
}

// Form Submit Handler
function handleFormSubmit(e) {
    e.preventDefault();

    const reminder = {
        contactName: contactNameInput.value.trim(),
        phoneNumber: phoneNumberInput.value.trim(),
        callDate: callDateInput.value,
        callTime: callTimeInput.value,
        notes: notesInput.value.trim()
    };

    // Validation
    if (!reminder.contactName) {
        showToast('Please enter a contact name', 'error');
        contactNameInput.focus();
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    
    if (reminderDateTime <= now) {
        showToast('Please select a future date and time', 'error');
        return;
    }

    // Add reminder
    addReminder(reminder);
    
    // Reset form
    reminderForm.reset();
    initializeDateTime();
    
    // Focus on contact name
    contactNameInput.focus();
}

// Notifications
async function handleEnableNotifications() {
    if (!('Notification' in window)) {
        showToast('Notifications are not supported in your browser', 'error');
        return;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'notification-status text-success';
        enableNotificationsBtn.style.display = 'none';
        showToast('Notifications enabled!', 'success');
        
        // Show install button if PWA is installable
        if (deferredPrompt && !isPWAInstalled()) {
            installButton.classList.remove('hidden');
        }
        
    } else if (permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
        showToast('Notifications blocked. Please enable in browser settings.', 'warning');
    }
}

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'No support';
        enableNotificationsBtn.style.display = 'none';
        return;
    }

    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'notification-status text-success';
        enableNotificationsBtn.style.display = 'none';
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Enable';
        notificationStatus.className = 'notification-status text-warning';
        enableNotificationsBtn.style.display = 'inline-flex';
    }
}

function sendNotification(title, body, reminderId = null) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            // Try to use service worker if available
            if (serviceWorkerRegistration) {
                serviceWorkerRegistration.showNotification(title, {
                    body: body,
                    icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                    badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                    requireInteraction: true,
                    tag: `reminder-${reminderId || Date.now()}`,
                    data: { 
                        reminderId: reminderId,
                        type: 'REMINDER'
                    }
                });
            } else {
                // Fallback to regular notification
                const notification = new Notification(title, { 
                    body: body,
                    icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
                });
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
            }
        } catch (error) {
            console.log('Notification error:', error);
        }
    }
}

// Reminder Functions
function addReminder(reminder) {
    const newReminder = {
        id: Date.now(),
        contactName: reminder.contactName,
        phoneNumber: reminder.phoneNumber || '',
        callDate: reminder.callDate,
        callTime: reminder.callTime,
        notes: reminder.notes || '',
        notified: false,
        isExpired: false,
        createdAt: new Date().toISOString()
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    
    // Schedule background notification
    scheduleReminderForBackground(newReminder);
    
    // Show success message
    const reminderDateTime = new Date(`${newReminder.callDate}T${newReminder.callTime}`);
    const formattedDate = reminderDateTime.toLocaleDateString();
    const formattedTime = reminderDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const message = isPWAInstalled() 
        ? `Reminder set for ${newReminder.contactName}! You'll get notifications even when the app is closed.`
        : `Reminder set for ${newReminder.contactName} on ${formattedDate} at ${formattedTime}`;
    
    showToast(message, 'success');
}

// Schedule reminder for background notifications
function scheduleReminderForBackground(reminder) {
    if (!serviceWorkerRegistration) {
        console.log('Service Worker not available for background scheduling');
        return;
    }
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        // Send reminder to service worker for background scheduling
        const target = serviceWorkerRegistration.active || 
                      serviceWorkerRegistration.waiting || 
                      serviceWorkerRegistration.installing;
        
        if (target) {
            target.postMessage({
                type: 'SCHEDULE_REMINDER',
                reminder: reminder
            });
            console.log('Reminder scheduled in background:', reminder.contactName);
        }
    }
}

// Schedule all existing reminders for background notifications
function scheduleExistingReminders() {
    if (!serviceWorkerRegistration || !isPWAInstalled()) {
        return;
    }
    
    const now = new Date();
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        if (reminderDateTime > now && !reminder.isExpired) {
            scheduleReminderForBackground(reminder);
        }
    });
}

function deleteReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminderToDelete = reminder;
        showDeleteConfirmation(reminder);
    }
}

function showDeleteConfirmation(reminder) {
    reminderDetails.innerHTML = `
        <strong><i class="fas fa-user"></i> ${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div class="reminder-time"><i class="far fa-calendar"></i> ${formatDate(reminder.callDate)} at ${reminder.callTime}</div>
        ${reminder.notes ? `<div class="reminder-notes" style="margin-top: 10px; font-size: 0.9rem;"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
    `;
    confirmationModal.classList.remove('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function closeModal() {
    confirmationModal.classList.add('hidden');
    reminderToDelete = null;
}

function confirmDelete() {
    if (reminderToDelete) {
        reminders = reminders.filter(r => r.id !== reminderToDelete.id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        closeModal();
        showToast(`Reminder for ${reminderToDelete.contactName} deleted`, 'warning');
    }
}

function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
}

// UI Functions
function renderReminders() {
    // Sort reminders by date/time
    reminders.sort((a, b) => {
        const aDate = new Date(`${a.callDate}T${a.callTime}`);
        const bDate = new Date(`${b.callDate}T${b.callTime}`);
        return aDate - bDate;
    });
    
    reminderCount.textContent = reminders.length;
    reminderList.innerHTML = '';

    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders</h3>
                <p>Add a reminder to get started</p>
            </div>
        `;
        return;
    }

    const now = new Date();
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000; // Less than 1 hour
        const isExpired = timeDiff <= 0 || reminder.isExpired;

        const reminderElement = document.createElement('div');
        reminderElement.className = `reminder-item ${isUrgent ? 'urgent' : ''} ${isExpired ? 'expired' : ''}`;
        reminderElement.innerHTML = `
            <div class="reminder-header">
                <div>
                    <div class="reminder-contact">
                        <i class="fas fa-user"></i> ${reminder.contactName}
                        ${isUrgent ? '<span class="badge-urgent">URGENT</span>' : ''}
                    </div>
                    ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
                </div>
                <div class="reminder-time">
                    <i class="far fa-calendar"></i> ${formatDate(reminder.callDate)} at ${reminder.callTime}
                </div>
            </div>
            ${reminder.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
            <div class="reminder-actions">
                <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary complete-btn" data-id="${reminder.id}">
                    <i class="fas fa-check"></i> ${isExpired ? 'Done' : 'Mark Done'}
                </button>
            </div>
        `;

        reminderList.appendChild(reminderElement);
    });

    // Event listeners for buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            deleteReminder(id);
        });
    });

    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const reminder = reminders.find(r => r.id === id);
            if (reminder) {
                reminders = reminders.filter(r => r.id !== id);
                saveReminders();
                renderReminders();
                updateUpcomingCall();
                showToast(`Marked ${reminder.contactName} as done`, 'success');
            }
        });
    });
}

function updateUpcomingCall() {
    const now = new Date();
    const nextReminder = reminders
        .filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired;
        })
        .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];

    if (!nextReminder) {
        upcomingCall.classList.add('hidden');
        return;
    }

    upcomingCall.classList.remove('hidden');
    upcomingContact.textContent = nextReminder.contactName;
    upcomingTime.textContent = `${formatDate(nextReminder.callDate)} at ${nextReminder.callTime}`;
}

// Countdown Timer
function startCountdownTimer() {
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        const nextReminder = reminders
            .filter(r => {
                const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
                return reminderDateTime > now && !r.isExpired;
            })
            .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];

        if (!nextReminder) {
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            return;
        }

        upcomingCall.classList.remove('hidden');
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
            
            // Send notification 5 minutes before (if not already notified)
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`, nextReminder.id);
                nextReminder.notified = true;
                saveReminders();
                renderReminders();
            }
        } else {
            countdownElement.textContent = '00:00:00';
            if (!nextReminder.notified) {
                sendNotification('Time to Call!', `Call ${nextReminder.contactName} now!`, nextReminder.id);
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
                renderReminders();
                updateUpcomingCall();
            }
        }
    }, 1000);
}

// Export for testing
window.CallRemind = {
    reminders,
    addReminder,
    deleteReminder,
    showToast,
    isPWAInstalled,
    checkPWAStatus
};