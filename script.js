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
const testNotificationBtn = document.getElementById('testNotification');
const contactNameInput = document.getElementById('contactName');
const phoneNumberInput = document.getElementById('phoneNumber');
const callDateInput = document.getElementById('callDate');
const callTimeInput = document.getElementById('callTime');
const notesInput = document.getElementById('notes');
const confirmationModal = document.getElementById('confirmationModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const reminderDetails = document.getElementById('reminderDetails');
const toastElement = document.getElementById('toast');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;

// Check if PWA is already installed
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('CallRemind App Initializing...');
    
    // Set current year
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
    
    // Check PWA status
    checkPWAStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start countdown timer
    startCountdownTimer();
    
    // Register service worker
    registerServiceWorker();
    
    // Show welcome message
    showToast('Welcome to CallRemind! ✅', 'success');
});

// Load reminders from localStorage
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        
        // Clean expired reminders (older than 1 day)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        reminders = reminders.filter(r => {
            const reminderTime = new Date(`${r.callDate}T${r.callTime}`).getTime();
            return reminderTime > oneDayAgo;
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

// Register Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered successfully');
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', event => {
                console.log('Message from Service Worker:', event.data);
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// Check PWA status
function checkPWAStatus() {
    if (isPWAInstalled()) {
        console.log('App is already installed as PWA');
        installButton.style.display = 'none';
        installInfo.innerHTML = `
            <p>
                <i class="fas fa-check-circle"></i> 
                <strong>App Installed ✓</strong>
                <br>
                <small>Background notifications are active</small>
            </p>
        `;
    } else {
        console.log('App is not installed');
        // Check if we can prompt installation
        checkInstallability();
    }
}

// Check if app is installable
function checkInstallability() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired - App is installable!');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button with animation
        installButton.style.display = 'flex';
        installButton.classList.add('pulse');
        
        showToast('📱 Install CallRemind for background notifications!', 'info', 5000);
    });
}

// Setup all event listeners
function setupEventListeners() {
    // Form submission
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notifications button
    enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    
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
    
    // Handle app installed event
    window.addEventListener('appinstalled', () => {
        console.log('App installed successfully!');
        showToast('✅ CallRemind installed! Background notifications enabled.', 'success');
        installButton.style.display = 'none';
        installButton.classList.remove('pulse');
    });
}

// Handle form submission
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
        showToast('Please enter contact name', 'error');
        contactNameInput.focus();
        return;
    }
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    
    if (reminderDateTime <= now) {
        showToast('Please select future date and time', 'error');
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
        id: Date.now() + Math.random(),
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
    
    // Show success message
    const time = new Date(`${newReminder.callDate}T${newReminder.callTime}`);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString();
    
    showToast(`✅ Reminder set for ${newReminder.contactName} on ${dateStr} at ${timeStr}`, 'success');
}

// Schedule notification
function scheduleNotification(reminder) {
    const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
    const now = Date.now();
    const timeDiff = reminderTime - now;
    
    if (timeDiff <= 0) return;
    
    // Schedule 5-minute warning
    const warningTime = timeDiff - (5 * 60 * 1000);
    if (warningTime > 0) {
        setTimeout(() => {
            if (!reminder.notified) {
                sendNotification('⏰ Call Reminder', `Call ${reminder.contactName} in 5 minutes!`);
            }
        }, warningTime);
    }
    
    // Schedule exact time notification
    setTimeout(() => {
        sendNotification('📞 Time to Call!', `Call ${reminder.contactName} now!${reminder.phoneNumber ? `\nPhone: ${reminder.phoneNumber}` : ''}`);
        reminder.notified = true;
        reminder.isExpired = true;
        saveReminders();
        renderReminders();
        updateUpcomingCall();
    }, timeDiff);
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser', 'error');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationStatus.textContent = 'Enabled ✓';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
            showToast('✅ Notifications enabled!', 'success');
            
            // Send test notification
            sendNotification('CallRemind', 'Notifications are now enabled!');
            
        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked ✗';
            notificationStatus.className = 'notification-status text-danger';
            enableNotificationsBtn.style.display = 'none';
            showToast('Notifications blocked. Please enable in browser settings.', 'warning');
        }
        
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        showToast('Error enabling notifications', 'error');
    }
}

// Check notification permission status
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Not Supported';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'Enabled ✓';
        notificationStatus.className = 'notification-status text-success';
        enableNotificationsBtn.style.display = 'none';
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Blocked ✗';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Enable';
        notificationStatus.className = 'notification-status text-warning';
        enableNotificationsBtn.style.display = 'flex';
    }
}

// Send notification
function sendNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    try {
        const notification = new Notification(title, {
            body: body,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            requireInteraction: true
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Handle PWA installation
async function handleInstall() {
    if (!deferredPrompt) {
        showToast('Install option not available. Use browser menu.', 'warning');
        return;
    }
    
    // Show loading state
    const originalText = installButton.innerHTML;
    installButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installing...';
    installButton.disabled = true;
    
    try {
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user choice
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted PWA installation');
        } else {
            console.log('User declined PWA installation');
            showToast('Installation cancelled', 'warning');
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Installation error:', error);
        showToast('Installation failed. Please try again.', 'error');
    } finally {
        // Reset button
        installButton.innerHTML = originalText;
        installButton.disabled = false;
    }
}

// Test notification
function testNotification() {
    if (Notification.permission === 'granted') {
        sendNotification('✅ Test Notification', 'This is a test notification from CallRemind!');
        showToast('Test notification sent!', 'success');
    } else {
        showToast('Please enable notifications first', 'warning');
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
                <p>Add a reminder to get started</p>
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
                            ${isUrgent ? '<span class="badge-urgent">URGENT</span>' : ''}
                        </div>
                        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
                    </div>
                    <div class="reminder-time">
                        <i class="far fa-calendar"></i> ${dateStr} at ${timeStr}
                    </div>
                </div>
                ${reminder.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
                <div class="reminder-actions">
                    <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    <button class="btn btn-primary complete-btn" data-id="${reminder.id}">
                        <i class="fas fa-check"></i> Done
                    </button>
                </div>
            </div>
        `;
    });
    
    reminderList.innerHTML = html;
    
    // Add event listeners to buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            deleteReminder(id);
        });
    });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            markAsDone(id);
        });
    });
}

// Delete reminder
function deleteReminder(id) {
    const reminder = reminders.find(r => r.id == id);
    if (reminder) {
        reminderToDelete = reminder;
        showDeleteConfirmation(reminder);
    }
}

function showDeleteConfirmation(reminder) {
    const time = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString();
    
    reminderDetails.innerHTML = `
        <strong><i class="fas fa-user"></i> ${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div class="reminder-time"><i class="far fa-calendar"></i> ${dateStr} at ${timeStr}</div>
        ${reminder.notes ? `<div style="margin-top: 10px;"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
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
        showToast(`Deleted reminder for ${reminderToDelete.contactName}`, 'warning');
    }
}

function markAsDone(id) {
    reminders = reminders.filter(r => r.id != id);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    showToast('Reminder marked as done', 'success');
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
    
    const time = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
    upcomingTime.textContent = time.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendNotification('⏰ Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`);
                nextReminder.notified = true;
                saveReminders();
            }
        }
    }, 1000);
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToasts = document.querySelectorAll('.toast:not(.hidden)');
    existingToasts.forEach(toast => {
        toast.classList.add('hidden');
    });
    
    // Create new toast
    toastElement.textContent = message;
    toastElement.className = `toast ${type}`;
    toastElement.classList.remove('hidden');
    
    // Auto hide
    setTimeout(() => {
        toastElement.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            toastElement.classList.add('hidden');
            toastElement.style.animation = '';
        }, 300);
    }, duration);
}

// Initialize notification permission check
checkNotificationPermission();

// Make functions available globally for testing
window.CallRemind = {
    sendNotification,
    showToast,
    testNotification,
    reminders
};