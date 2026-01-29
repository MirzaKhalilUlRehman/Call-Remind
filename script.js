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
const notificationAlert = document.getElementById('notificationAlert');
const alertEnableBtn = document.getElementById('alertEnableBtn');

// Form elements
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

// Check if notifications are enabled
function areNotificationsEnabled() {
    return Notification.permission === 'granted';
}

// Check if PWA is installed
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('CallRemind App Starting...');
    
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default date/time
    const today = new Date().toISOString().split('T')[0];
    callDateInput.min = today;
    callDateInput.value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
                         nextHour.getMinutes().toString().padStart(2, '0');
    
    // Load reminders
    loadReminders();
    
    // Check notification status
    updateNotificationStatus();
    
    // Initialize PWA
    await initPWA();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start countdown timer
    startCountdownTimer();
    
    // Check if app is usable (notifications must be on)
    checkAppUsability();
});

// Load reminders from localStorage
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        
        // Clean up old reminders (older than 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        reminders = reminders.filter(reminder => {
            const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
            return reminderTime > sevenDaysAgo;
        });
        
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        
    } catch (error) {
        console.error('Error loading reminders:', error);
        reminders = [];
    }
}

// Save reminders to localStorage
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
}

// Initialize PWA features
async function initPWA() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered');
            
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
                    }
                }
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    // Check PWA installation status
    if (isPWAInstalled()) {
        console.log('PWA is already installed');
        installButton.classList.add('hidden');
        installedButton.classList.remove('hidden');
        installInfo.classList.add('hidden');
        pwaStatus.classList.remove('hidden');
    } else {
        console.log('PWA is not installed');
        installInfo.classList.remove('hidden');
        pwaStatus.classList.add('hidden');
    }
}

// Update notification status display
function updateNotificationStatus() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Not Supported';
        notificationStatus.classList.remove('enabled');
        notificationStatus.classList.add('disabled');
        enableNotificationsBtn.style.display = 'none';
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'ON';
        notificationStatus.classList.add('enabled');
        notificationStatus.classList.remove('disabled');
        enableNotificationsBtn.style.display = 'none';
        
        // Hide notification alert if shown
        notificationAlert.classList.add('hidden');
        
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'BLOCKED';
        notificationStatus.classList.remove('enabled');
        notificationStatus.classList.add('disabled');
        enableNotificationsBtn.style.display = 'none';
        
        // Show notification alert
        showNotificationAlert();
        
    } else {
        notificationStatus.textContent = 'OFF';
        notificationStatus.classList.remove('enabled');
        notificationStatus.classList.add('disabled');
        enableNotificationsBtn.style.display = 'flex';
    }
}

// Check if app is usable (notifications must be enabled)
function checkAppUsability() {
    if (!areNotificationsEnabled()) {
        // Disable form if notifications are not enabled
        reminderForm.classList.add('form-disabled');
        
        // Show alert after 1 second
        setTimeout(() => {
            showNotificationAlert();
        }, 1000);
    } else {
        reminderForm.classList.remove('form-disabled');
    }
}

// Show notification alert
function showNotificationAlert() {
    if (!areNotificationsEnabled()) {
        notificationAlert.classList.remove('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notification button
    enableNotificationsBtn.addEventListener('click', enableNotifications);
    alertEnableBtn.addEventListener('click', enableNotifications);
    
    // Install button
    installButton.addEventListener('click', handleInstall);
    
    // Modal buttons
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
    });
    
    // PWA install prompt - This shows the install button
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button with animation
        installButton.classList.remove('hidden');
        installButton.classList.add('pulse');
    });
    
    // App installed successfully
    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        
        // Update UI
        installButton.classList.add('hidden');
        installButton.classList.remove('pulse');
        installedButton.classList.remove('hidden');
        installInfo.classList.add('hidden');
        pwaStatus.classList.remove('hidden');
        
        // Reschedule all reminders with background support
        scheduleAllRemindersForBackground();
    });
    
    // Handle Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!confirmationModal.classList.contains('hidden')) {
                closeModal();
            }
            if (!notificationAlert.classList.contains('hidden')) {
                notificationAlert.classList.add('hidden');
            }
        }
    });
}

// Enable notifications
async function enableNotifications() {
    if (!('Notification' in window)) {
        alert('Notifications are not supported in your browser');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('Notifications enabled');
            
            // Update UI
            updateNotificationStatus();
            
            // Enable form
            reminderForm.classList.remove('form-disabled');
            
            // Hide alert
            notificationAlert.classList.add('hidden');
            
            // Send test notification
            sendNotification('CallRemind', 'Notifications are now enabled! ✅');
            
            // Show install button if PWA is installable
            if (deferredPrompt && !isPWAInstalled()) {
                installButton.classList.remove('hidden');
            }
            
        } else {
            console.log('Notifications denied');
            updateNotificationStatus();
        }
        
    } catch (error) {
        console.error('Error enabling notifications:', error);
    }
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Check if notifications are enabled
    if (!areNotificationsEnabled()) {
        showNotificationAlert();
        return;
    }
    
    const reminder = {
        contactName: contactNameInput.value.trim(),
        phoneNumber: phoneNumberInput.value.trim(),
        callDate: callDateInput.value,
        callTime: callTimeInput.value,
        notes: notesInput.value.trim()
    };
    
    // Validation
    if (!reminder.contactName) {
        alert('Please enter contact name');
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
    const today = new Date().toISOString().split('T')[0];
    callDateInput.value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
                         nextHour.getMinutes().toString().padStart(2, '0');
}

// Add a new reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
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
    
    // Schedule notification
    scheduleNotification(newReminder);
    
    // Schedule for background if PWA is installed
    if (isPWAInstalled() && serviceWorkerRegistration) {
        scheduleReminderForBackground(newReminder);
    }
    
    // Show success message
    const time = new Date(`${newReminder.callDate}T${newReminder.callTime}`);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString();
    
    alert(`✅ Reminder set for ${newReminder.contactName}\n📅 ${dateStr} at ${timeStr}\n\n${isPWAInstalled() ? 'Background notifications active!' : 'Enable background notifications by installing the app!'}`);
}

// Schedule notification (works in browser)
function scheduleNotification(reminder) {
    const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
    const now = Date.now();
    const timeDiff = reminderTime - now;
    
    if (timeDiff <= 0) return;
    
    // Schedule 5-minute warning
    const warningTime = timeDiff - (5 * 60 * 1000);
    if (warningTime > 0) {
        setTimeout(() => {
            if (!reminder.notified && areNotificationsEnabled()) {
                sendNotification('⏰ Call Reminder', `Call ${reminder.contactName} in 5 minutes!`);
            }
        }, warningTime);
    }
    
    // Schedule exact time notification
    setTimeout(() => {
        if (areNotificationsEnabled()) {
            sendNotification('📞 Time to Call!', `Call ${reminder.contactName} now!${reminder.phoneNumber ? `\nPhone: ${reminder.phoneNumber}` : ''}`);
        }
        reminder.notified = true;
        reminder.isExpired = true;
        saveReminders();
        renderReminders();
        updateUpcomingCall();
    }, timeDiff);
}

// Schedule reminder for background (PWA only)
function scheduleReminderForBackground(reminder) {
    if (!serviceWorkerRegistration || !isPWAInstalled()) return;
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        // Send to service worker for background scheduling
        const target = serviceWorkerRegistration.active || 
                      serviceWorkerRegistration.waiting || 
                      serviceWorkerRegistration.installing;
        
        if (target) {
            target.postMessage({
                type: 'SCHEDULE_REMINDER',
                reminder: reminder
            });
            console.log('Reminder scheduled for background:', reminder.contactName);
        }
    }
}

// Schedule all reminders for background (when PWA is installed)
function scheduleAllRemindersForBackground() {
    if (!isPWAInstalled() || !serviceWorkerRegistration) return;
    
    const now = new Date();
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        if (reminderDateTime > now && !reminder.isExpired) {
            scheduleReminderForBackground(reminder);
        }
    });
}

// Send notification
function sendNotification(title, body) {
    if (!areNotificationsEnabled()) return;
    
    try {
        if (serviceWorkerRegistration && isPWAInstalled()) {
            // Use service worker for PWA
            serviceWorkerRegistration.showNotification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                requireInteraction: true,
                tag: 'callremind-notification'
            });
        } else {
            // Use regular notifications
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
        console.error('Error sending notification:', error);
    }
}

// Handle PWA installation
async function handleInstall() {
    if (!deferredPrompt) {
        alert('Install option not available. Please use:\n\nChrome/Edge: Menu (⋮) → Install CallRemind\niOS Safari: Share (📤) → Add to Home Screen');
        return;
    }
    
    // Show loading state
    const originalText = installButton.innerHTML;
    installButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    installButton.disabled = true;
    
    try {
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted PWA installation');
            // appinstalled event will handle UI update
        } else {
            console.log('User declined PWA installation');
            // Reset button
            installButton.innerHTML = originalText;
            installButton.disabled = false;
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Installation error:', error);
        alert('Installation failed. Please try again.');
        
        // Reset button
        installButton.innerHTML = originalText;
        installButton.disabled = false;
    }
}

// Render reminders list
function renderReminders() {
    // Sort by date/time
    reminders.sort((a, b) => {
        return new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`);
    });
    
    reminderCount.textContent = reminders.length;
    
    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders</h3>
                <p>Add a reminder</p>
            </div>
        `;
        return;
    }
    
    const now = new Date();
    let html = '';
    
    reminders.forEach(reminder => {
        const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const timeDiff = reminderTime - now;
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000; // Less than 1 hour
        const isExpired = timeDiff <= 0 || reminder.isExpired;
        
        const timeStr = reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = reminderTime.toLocaleDateString();
        
        html += `
            <div class="reminder-item ${isUrgent ? 'urgent' : ''} ${isExpired ? 'expired' : ''}">
                <div class="reminder-header">
                    <div>
                        <div class="reminder-contact">
                            <i class="fas fa-user"></i> ${reminder.contactName}
                        </div>
                        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
                    </div>
                    <div class="reminder-time">
                        <i class="far fa-calendar"></i> ${reminder.callDate} at ${reminder.callTime}
                    </div>
                </div>
                ${reminder.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
                <div class="reminder-actions">
                    <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    reminderList.innerHTML = html;
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            deleteReminder(id);
        });
    });
}

// Delete reminder
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
        <div class="reminder-time"><i class="far fa-calendar"></i> ${reminder.callDate} at ${reminder.callTime}</div>
    `;
    confirmationModal.classList.remove('hidden');
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
    }
}

// Update upcoming call display
function updateUpcomingCall() {
    const now = new Date();
    const nextReminder = reminders
        .filter(r => {
            const reminderTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderTime > now && !r.isExpired;
        })
        .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];
    
    if (!nextReminder) {
        upcomingCall.classList.add('hidden');
        return;
    }
    
    upcomingCall.classList.remove('hidden');
    upcomingContact.textContent = nextReminder.contactName;
    upcomingTime.textContent = nextReminder.callTime;
}

// Start countdown timer
function startCountdownTimer() {
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        const nextReminder = reminders
            .filter(r => {
                const reminderTime = new Date(`${r.callDate}T${r.callTime}`);
                return reminderTime > now && !r.isExpired;
            })
            .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];
        
        if (!nextReminder) {
            countdownElement.textContent = '--:--:--';
            return;
        }
        
        const reminderTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderTime - now;
        
        if (timeDiff > 0) {
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            countdownElement.textContent = 
                `${hours.toString().padStart(2, '0')}:` +
                `${minutes.toString().padStart(2, '0')}:` +
                `${seconds.toString().padStart(2, '0')}`;
            
            // Send notification 5 minutes before
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified && areNotificationsEnabled()) {
                sendNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`);
                nextReminder.notified = true;
                saveReminders();
            }
        } else {
            countdownElement.textContent = '00:00:00';
            if (!nextReminder.notified && areNotificationsEnabled()) {
                sendNotification('Time to Call!', `Call ${nextReminder.contactName} now!`);
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
                renderReminders();
                updateUpcomingCall();
            }
        }
    }, 1000);
}