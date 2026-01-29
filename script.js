// DOM Elements
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const submitBtn = document.getElementById('submitBtn');

// Status elements
const notificationStatus = document.getElementById('notificationStatus');
const pwaStatus = document.getElementById('pwaStatus');
const notificationRequired = document.getElementById('notificationRequired');
const notificationEnabled = document.getElementById('notificationEnabled');
const installSection = document.getElementById('installSection');
const installedMessage = document.getElementById('installedMessage');
const enableNotificationsBtn = document.getElementById('enableNotifications');
const installButton = document.getElementById('installButton');
const testNotificationBtn = document.getElementById('testNotification');

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

// Toast
const toast = document.getElementById('toast');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;
let serviceWorkerRegistration = null;
let isPWAInstalled = false;

// Check if notifications are enabled
function isNotificationsEnabled() {
    return Notification.permission === 'granted';
}

// Check if PWA is installed
function checkIfPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 CallRemind App Initializing...');
    
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Initialize form
    initForm();
    
    // Load reminders
    loadReminders();
    
    // Check app status
    checkAppStatus();
    
    // Update UI
    updateUI();
    
    // Initialize service worker
    await initServiceWorker();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start countdown timer
    startCountdownTimer();
});

// Initialize form
function initForm() {
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
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        
        // Clean expired reminders (older than 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        reminders = reminders.filter(reminder => {
            const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
            return reminderTime > sevenDaysAgo;
        });
        
        saveReminders();
        
    } catch (error) {
        console.error('Error loading reminders:', error);
        reminders = [];
    }
}

// Save reminders to localStorage
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
}

// Check app status
function checkAppStatus() {
    // Check notifications
    if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser', 'error');
        return;
    }
    
    // Check PWA status
    isPWAInstalled = checkIfPWAInstalled();
    
    // Update UI based on status
    updateStatusUI();
}

// Update status UI
function updateStatusUI() {
    // Update notification status
    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'Notifications ON';
        notificationStatus.className = 'status-badge status-on';
        notificationRequired.classList.add('hidden');
        notificationEnabled.classList.remove('hidden');
        submitBtn.disabled = false;
        testNotificationBtn.classList.remove('hidden');
        
        // Show install section if PWA is not installed
        if (!isPWAInstalled && deferredPrompt) {
            installSection.classList.remove('hidden');
        }
        
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Notifications BLOCKED';
        notificationStatus.className = 'status-badge status-off';
        notificationRequired.classList.remove('hidden');
        notificationEnabled.classList.add('hidden');
        submitBtn.disabled = true;
        testNotificationBtn.classList.add('hidden');
        installSection.classList.add('hidden');
        
        // Show message about enabling notifications
        showToast('Notifications are blocked. Please enable them in browser settings.', 'error');
        
    } else {
        notificationStatus.textContent = 'Notifications OFF';
        notificationStatus.className = 'status-badge status-off';
        notificationRequired.classList.remove('hidden');
        notificationEnabled.classList.add('hidden');
        submitBtn.disabled = true;
        testNotificationBtn.classList.add('hidden');
        installSection.classList.add('hidden');
    }
    
    // Update PWA status
    if (isPWAInstalled) {
        pwaStatus.classList.remove('hidden');
        installSection.classList.add('hidden');
        installedMessage.classList.remove('hidden');
    } else {
        pwaStatus.classList.add('hidden');
        installedMessage.classList.add('hidden');
    }
}

// Update UI
function updateUI() {
    renderReminders();
    updateUpcomingCall();
}

// Initialize service worker
async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            serviceWorkerRegistration = await navigator.serviceWorker.register('service-worker.js');
            console.log('✅ Service Worker registered');
            
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
                        showToast(`Time to call ${reminder.contactName}!`, 'info');
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notification button
    enableNotificationsBtn.addEventListener('click', enableNotifications);
    
    // Install button
    installButton.addEventListener('click', handleInstall);
    
    // Test notification button
    testNotificationBtn.addEventListener('click', testNotification);
    
    // Modal buttons
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
    });
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📱 PWA install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button if notifications are enabled
        if (Notification.permission === 'granted' && !isPWAInstalled) {
            installSection.classList.remove('hidden');
            installButton.classList.add('pulse');
        }
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        console.log('🎉 PWA installed successfully');
        isPWAInstalled = true;
        updateStatusUI();
        showToast('App installed successfully! Background notifications active.', 'success');
        
        // Schedule existing reminders for background
        scheduleAllRemindersForBackground();
    });
    
    // Handle Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!confirmationModal.classList.contains('hidden')) {
                closeModal();
            }
        }
    });
}

// Enable notifications
async function enableNotifications() {
    if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser', 'error');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('🔔 Notifications enabled');
            
            // Update UI
            updateStatusUI();
            
            // Send test notification
            sendNotification('CallRemind', '✅ Notifications enabled successfully!');
            
            showToast('Notifications enabled! You can now add reminders.', 'success');
            
            // Show install button if PWA is available
            if (deferredPrompt && !isPWAInstalled) {
                installSection.classList.remove('hidden');
                installButton.classList.add('pulse');
            }
            
        } else {
            console.log('🔕 Notifications denied');
            updateStatusUI();
            showToast('Notifications are required to use this app', 'error');
        }
        
    } catch (error) {
        console.error('Error enabling notifications:', error);
        showToast('Error enabling notifications', 'error');
    }
}

// Handle form submission
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Check notifications
    if (!isNotificationsEnabled()) {
        showToast('Please enable notifications first', 'error');
        enableNotifications();
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
        showToast('Please enter contact name', 'error');
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
    initForm();
    
    // Focus back to contact name
    contactNameInput.focus();
}

// Add a new reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now().toString(),
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
    updateUI();
    
    // Schedule notification
    scheduleNotification(newReminder);
    
    // Schedule for background if PWA is installed
    if (isPWAInstalled && serviceWorkerRegistration) {
        scheduleReminderForBackground(newReminder);
    }
    
    // Show success message
    const time = new Date(`${newReminder.callDate}T${newReminder.callTime}`);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString();
    
    showToast(`✅ Reminder set for ${newReminder.contactName}\n📅 ${dateStr} at ${timeStr}`, 'success');
    
    // Send immediate notification for testing
    sendNotification('Reminder Added', `You'll be reminded to call ${newReminder.contactName} on ${dateStr} at ${timeStr}`);
}

// Schedule notification (for browser)
function scheduleNotification(reminder) {
    const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
    const now = Date.now();
    const timeDiff = reminderTime - now;
    
    if (timeDiff <= 0) return;
    
    // Schedule 5-minute warning
    const warningTime = timeDiff - (5 * 60 * 1000);
    if (warningTime > 0) {
        setTimeout(() => {
            if (!reminder.notified && isNotificationsEnabled()) {
                sendNotification('⏰ Call Reminder', `Call ${reminder.contactName} in 5 minutes!`);
                reminder.notified = true;
                saveReminders();
            }
        }, warningTime);
    }
    
    // Schedule exact time notification
    setTimeout(() => {
        if (isNotificationsEnabled()) {
            sendNotification('📞 Time to Call!', `Call ${reminder.contactName} now!${reminder.phoneNumber ? `\nPhone: ${reminder.phoneNumber}` : ''}`);
        }
        reminder.notified = true;
        reminder.isExpired = true;
        saveReminders();
        updateUI();
    }, timeDiff);
}

// Schedule reminder for background (PWA only)
function scheduleReminderForBackground(reminder) {
    if (!serviceWorkerRegistration || !isPWAInstalled) return;
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        const target = serviceWorkerRegistration.active;
        if (target) {
            target.postMessage({
                type: 'SCHEDULE_REMINDER',
                reminder: reminder
            });
            console.log('Reminder scheduled for background:', reminder.contactName);
        }
    }
}

// Schedule all reminders for background
function scheduleAllRemindersForBackground() {
    if (!isPWAInstalled || !serviceWorkerRegistration) return;
    
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
    if (!isNotificationsEnabled()) return;
    
    try {
        const options = {
            body: body,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            badge: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            requireInteraction: true
        };
        
        if (serviceWorkerRegistration && isPWAInstalled) {
            serviceWorkerRegistration.showNotification(title, options);
        } else {
            const notification = new Notification(title, options);
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
        showToast('Install option not available. Use Chrome menu (⋮) → Install app', 'info');
        return;
    }
    
    // Show loading
    const originalText = installButton.innerHTML;
    installButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    installButton.disabled = true;
    
    try {
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted installation');
        } else {
            console.log('User declined installation');
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Installation error:', error);
        showToast('Installation failed. Please try again.', 'error');
    } finally {
        // Reset button
        installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
        installButton.disabled = false;
    }
}

// Test notification
function testNotification() {
    if (isNotificationsEnabled()) {
        sendNotification('✅ Test Notification', 'This is a test notification from CallRemind!');
        showToast('Test notification sent', 'success');
    } else {
        showToast('Enable notifications first', 'error');
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
        const isExpired = reminder.isExpired;
        
        html += `
            <div class="reminder-item ${isUrgent ? 'urgent' : ''}">
                <div class="reminder-header">
                    <div>
                        <div class="reminder-contact">
                            <i class="fas fa-user"></i> ${reminder.contactName}
                            ${isUrgent ? '<span class="urgent-badge">URGENT</span>' : ''}
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
        updateUI();
        closeModal();
        showToast(`Reminder deleted for ${reminderToDelete.contactName}`, 'info');
    }
}

// Update upcoming call
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
        }
    }, 1000);
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToasts = document.querySelectorAll('.toast:not(.hidden)');
    existingToasts.forEach(t => {
        t.classList.add('hidden');
    });
    
    // Set content
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    // Auto hide
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.style.animation = '';
        }, 300);
    }, 3000);
}

// Make functions available globally
window.callremind = {
    reminders,
    addReminder,
    deleteReminder,
    sendNotification,
    showToast,
    enableNotifications,
    testNotification
};