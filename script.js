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
const installInfo = document.getElementById('installInfo');
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

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;
let serviceWorkerRegistration = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
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
    initServiceWorker();

    // Set up event listeners
    setupEventListeners();

    // Check if app is already installed
    checkIfInstalled();

    // Handle online/offline status
    setupOnlineStatus();
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

        // Remove very old reminders (older than 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        reminders = reminders.filter(reminder => {
            const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
            return reminderDateTime > sevenDaysAgo;
        });

        saveReminders();

    } catch (error) {
        console.error('Error loading reminders:', error);
        reminders = [];
    }
}

// Initialize Service Worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered successfully');

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'REMINDER_TRIGGERED') {
                    const reminderId = event.data.reminderId;
                    const reminder = reminders.find(r => r.id === reminderId);
                    if (reminder) {
                        reminder.notified = true;
                        reminder.isExpired = true;
                        saveReminders();
                        renderReminders();
                        updateUpcomingCall();
                    }
                }
            });

            // Check for updates
            serviceWorkerRegistration.addEventListener('updatefound', () => {
                console.log('Service Worker update found');
            });

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    } else {
        console.log('Service Workers are not supported');
    }
}

// Check if app is already installed
function checkIfInstalled() {
    // Check if running in standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('App is already installed as PWA');
        installButton.style.display = 'none';
        installInfo.innerHTML = '<p style="margin: 0; font-size: 0.8rem; color: #00a000;"><i class="fas fa-check-circle"></i> App installed - Background notifications active</p>';
    }

    // Check for iOS standalone mode
    if (window.navigator.standalone === true) {
        console.log('App is installed on iOS');
        installButton.style.display = 'none';
    }
}

// Set up online/offline status
function setupOnlineStatus() {
    window.addEventListener('online', () => {
        console.log('App is online');
        showToast('Back online', 'success');
    });

    window.addEventListener('offline', () => {
        console.log('App is offline');
        showToast('You are offline. Some features may be limited.', 'warning');
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;

    document.body.appendChild(toast);

    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    installButton.addEventListener('click', installApp);

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Install prompt available');
        e.preventDefault();
        deferredPrompt = e;

        // Show install button
        installButton.style.display = 'inline-flex';

        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        installButton.style.animation = 'pulse 2s infinite';
    });

    // App installed successfully
    window.addEventListener('appinstalled', () => {
        console.log('App installed successfully');
        installButton.style.display = 'none';
        installInfo.innerHTML = '<p style="margin: 0; font-size: 0.8rem; color: #00a000;"><i class="fas fa-check-circle"></i> App installed! You will get notifications even when browser is closed.</p>';
        showToast('App installed successfully!', 'success');
    });

    // Handle Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !confirmationModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Install App
async function installApp() {
    if (!deferredPrompt) {
        // Show alternative installation instructions
        const result = confirm('Install option not available. Would you like to see installation instructions?');
        if (result) {
            alert('To install this app:\n\n1. Click the menu (⋮) in Chrome/Edge\n2. Select "Install app" or "Add to Home Screen"\n3. Follow the prompts\n\nOn Safari iOS:\n1. Tap the Share button\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"');
        }
        return;
    }

    // Show loading state
    const originalText = installButton.innerHTML;
    const originalDisabled = installButton.disabled;
    installButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    installButton.disabled = true;

    try {
        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;

        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
            // Button will be hidden by appinstalled event
        } else {
            console.log('User dismissed install');
            // Keep button visible for next time
            deferredPrompt = null;
            installButton.style.animation = 'none';
        }

    } catch (error) {
        console.error('Install error:', error);
        showToast('Installation failed. Please try again or use browser menu.', 'warning');
        deferredPrompt = null;
        installButton.style.animation = 'none';
    } finally {
        // Only restore if not installed
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            installButton.innerHTML = originalText;
            installButton.disabled = originalDisabled;
        }
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
        alert('Please enter a contact name');
        contactNameInput.focus();
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();

    if (reminderDateTime <= now) {
        alert('Please select a future date and time');
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
function handleEnableNotifications() {
    if (!('Notification' in window)) {
        alert('Notifications are not supported in your browser');
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            notificationStatus.textContent = 'Enabled';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
            showToast('Notifications enabled!', 'success');

            // Show install button if available
            if (deferredPrompt) {
                installButton.style.display = 'inline-flex';
            }

        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'notification-status text-danger';
            enableNotificationsBtn.style.display = 'none';
            showToast('Notifications blocked. Please enable in browser settings.', 'warning');
        }
    });
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
                    requireInteraction: true,
                    tag: `reminder-${reminderId || Date.now()}`,
                    data: { reminderId: reminderId }
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

    // Show success message
    const reminderDateTime = new Date(`${newReminder.callDate}T${newReminder.callTime}`);
    const formattedDate = reminderDateTime.toLocaleDateString();
    const formattedTime = reminderDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    showToast(`Reminder set for ${newReminder.contactName} on ${formattedDate} at ${formattedTime}`, 'success');

    // If app is installed, schedule background notification
    if (window.matchMedia('(display-mode: standalone)').matches && serviceWorkerRegistration) {
        scheduleBackgroundNotification(newReminder);
    }
}

// Schedule notification in background
function scheduleBackgroundNotification(reminder) {
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;

    if (timeDiff > 0 && serviceWorkerRegistration) {
        // Send reminder to service worker
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
                    </div>
                    ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
                </div>
                <div class="reminder-time">
                    <i class="far fa-calendar"></i> ${formatDate(reminder.callDate)} at ${reminder.callTime}
                    ${isUrgent ? '<span class="badge" style="margin-left: 10px; background: var(--danger); font-size: 0.8rem;">URGENT</span>' : ''}
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

            // Send notification 5 minutes before
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