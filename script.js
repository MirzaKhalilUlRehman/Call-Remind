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
const pwaInstructions = document.getElementById('pwaInstructions');
const closePWAInstructions = document.getElementById('closePWAInstructions');

// Constants
const RETRY_ENABLE_KEY = 'callremind_notification_retry';
const STORAGE_KEY = 'callremind_reminders';
const PWA_INSTRUCTIONS_KEY = 'callremind_pwa_instructions';

// Variables
let reminders = [];
let reminderToDelete = null;
let lastUpdateTime = 0;
let swRegistration = null;
let isPWAInstalled = false;
let deferredPrompt = null;

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
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
    initServiceWorker();
    checkPWAInstallation();
    
    // Show PWA instructions if not shown before
    showPWAInstructionsIfNeeded();
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
    
    // PWA events
    if (installPWA) {
        installPWA.addEventListener('click', handlePWAInstall);
    }
    
    if (closePWAInstructions) {
        closePWAInstructions.addEventListener('click', () => {
            pwaInstructions.classList.add('hidden');
            localStorage.setItem(PWA_INSTRUCTIONS_KEY, 'shown');
        });
    }
    
    pwaInstructions.addEventListener('click', (e) => {
        if (e.target === pwaInstructions) {
            pwaInstructions.classList.add('hidden');
            localStorage.setItem(PWA_INSTRUCTIONS_KEY, 'shown');
        }
    });
    
    // Clear timer on page unload
    window.addEventListener('beforeunload', () => {
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }
    });
    
    // Check notification status on user action
    document.addEventListener('click', checkNotificationOnUserAction);
    
    // PWA installation event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installPWA) {
            installPWA.style.display = 'inline-flex';
        }
        
        // Show PWA instructions
        if (!localStorage.getItem(PWA_INSTRUCTIONS_KEY)) {
            setTimeout(() => {
                pwaInstructions.classList.remove('hidden');
            }, 2000);
        }
    });
    
    // Detect when PWA is installed
    window.addEventListener('appinstalled', () => {
        isPWAInstalled = true;
        console.log('PWA installed successfully');
        if (installPWA) {
            installPWA.style.display = 'none';
        }
        showNotification('Success', 'App installed! You will now receive background notifications.');
    });
}

// Initialize Service Worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            swRegistration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered:', swRegistration);
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', event => {
                console.log('Message from service worker:', event.data);
                handleServiceWorkerMessage(event.data);
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// Handle PWA installation
async function handlePWAInstall() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('User accepted PWA installation');
        isPWAInstalled = true;
    } else {
        console.log('User declined PWA installation');
    }
    
    deferredPrompt = null;
    if (installPWA) {
        installPWA.style.display = 'none';
    }
}

// Show PWA instructions if needed
function showPWAInstructionsIfNeeded() {
    if (!localStorage.getItem(PWA_INSTRUCTIONS_KEY) && 
        window.matchMedia('(display-mode: browser)').matches &&
        'serviceWorker' in navigator) {
        setTimeout(() => {
            pwaInstructions.classList.remove('hidden');
        }, 3000);
    }
}

// Check if PWA is installed
function checkPWAInstallation() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isPWAInstalled = true;
        console.log('Running as PWA');
        if (installPWA) {
            installPWA.style.display = 'none';
        }
    }
}

// Handle messages from service worker
function handleServiceWorkerMessage(data) {
    if (data.action === 'mark-done' && data.reminderId) {
        markAsCompleted(data.reminderId);
    } else if (data.action === 'snooze' && data.reminderId) {
        snoozeReminder(data.reminderId, data.minutes || 5);
    }
}

// Snooze reminder
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
        
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        
        showNotification('Reminder Snoozed', `Reminder for ${reminder.contactName} snoozed for ${minutes} minutes`);
    }
}

// Check notification status on user action
function checkNotificationOnUserAction() {
    if ('Notification' in window) {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            notificationStatus.textContent = 'Enabled';
            notificationStatus.className = 'text-success';
            enableNotificationsBtn.style.display = 'none';
            disableNotificationsBtn.style.display = 'inline-flex';
        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'text-danger';
            enableNotificationsBtn.style.display = 'inline-flex';
            disableNotificationsBtn.style.display = 'none';
        } else {
            notificationStatus.textContent = 'Click to enable';
            notificationStatus.className = 'text-warning';
            enableNotificationsBtn.style.display = 'inline-flex';
            disableNotificationsBtn.style.display = 'none';
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
                showNotificationCard(
                    'Notifications Blocked',
                    'Notifications are currently blocked. You can enable them by:<br>1. Clicking the lock icon in your address bar<br>2. Changing "Notifications" to "Allow"<br>3. Then clicking the "Enable Notifications" button below',
                    'warning'
                );
                
                enableNotificationsBtn.style.display = 'inline-flex';
                disableNotificationsBtn.style.display = 'none';
                localStorage.setItem(RETRY_ENABLE_KEY, now.toString());
            }
        }
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
function handleEnableNotifications() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            showNotificationCard('Notifications Enabled', 'You will now receive call reminders!', 'success');
            showNotification('Success', 'Notifications have been enabled!');
            
            enableNotificationsBtn.style.display = 'none';
            disableNotificationsBtn.style.display = 'inline-flex';
            notificationStatus.textContent = 'Enabled';
            notificationStatus.className = 'text-success';
            
            localStorage.removeItem(RETRY_ENABLE_KEY);
            
        } else if (permission === 'denied') {
            showNotificationCard('Notifications Blocked', 
                'You have blocked notifications. To enable them:<br>1. Click on the lock icon in address bar<br>2. Change "Notifications" to "Allow"<br>3. Refresh the page and click "Enable Notifications" again',
                'error'
            );
            
            enableNotificationsBtn.style.display = 'inline-flex';
            disableNotificationsBtn.style.display = 'none';
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'text-danger';
        }
    });
}

function handleDisableNotifications() {
    if (Notification.permission === 'granted') {
        showNotificationCard(
            'Disable Notifications', 
            'To disable notifications:<br>1. Click on the lock icon in address bar<br>2. Change "Notifications" to "Block"<br>3. Refresh the page',
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
        notificationStatus.className = 'text-danger';
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'none';
        return;
    }

    const permission = Notification.permission;
    
    if (permission === 'granted') {
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'text-success';
        enableNotificationsBtn.style.display = 'none';
        disableNotificationsBtn.style.display = 'inline-flex';
    } else if (permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'text-danger';
        enableNotificationsBtn.style.display = 'inline-flex';
        disableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Click to enable';
        notificationStatus.className = 'text-warning';
        enableNotificationsBtn.style.display = 'inline-flex';
        disableNotificationsBtn.style.display = 'none';
    }
}

// Notification confirmation card
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

// Send browser notification
function sendBrowserNotification(title, body, reminderId = null) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    try {
        // Try to use service worker if available and installed as PWA
        if (swRegistration && isPWAInstalled) {
            swRegistration.showNotification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                tag: `reminder-${reminderId || Date.now()}`,
                renotify: true,
                requireInteraction: true,
                data: {
                    url: window.location.href,
                    reminderId: reminderId
                }
            });
        } else {
            // Fallback to regular notifications
            const notification = new Notification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => {
                notification.close();
            }, 10000);
        }
    } catch (error) {
        console.log('Notification error:', error);
    }
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
        isExpired: false
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    showNotification('Reminder Added', `Call reminder for ${reminder.contactName} has been scheduled!`);
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

    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const now = new Date();
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

    // Attach event listeners to dynamic buttons
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
                sendBrowserNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`, nextReminder.id);
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

// Clean up old reminders on page load
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