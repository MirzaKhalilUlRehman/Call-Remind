// DOM Elements
const notificationScreen = document.getElementById('notificationScreen');
const mainApp = document.getElementById('mainApp');
const enableBtn = document.getElementById('enableBtn');
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const totalReminders = document.getElementById('totalReminders');
const upcomingCount = document.getElementById('upcomingCount');
const installButton = document.getElementById('installButton');
const contactNameInput = document.getElementById('contactName');
const phoneNumberInput = document.getElementById('phoneNumber');
const callDateInput = document.getElementById('callDate');
const callTimeInput = document.getElementById('callTime');
const notesInput = document.getElementById('notes');
const deleteModal = document.getElementById('deleteModal');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');
const reminderInfo = document.getElementById('reminderInfo');
const toast = document.getElementById('toast');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Check notification permission
    checkNotificationPermission();
    
    // Setup event listeners
    setupEventListeners();
    
    // Register service worker
    registerServiceWorker();
});

// Check Notification Permission
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationScreen.innerHTML = `
            <div class="notification-card">
                <div class="notification-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2>Browser Not Supported</h2>
                <p>Your browser does not support notifications. Please use Chrome, Edge, or Firefox.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Refresh
                </button>
            </div>
        `;
        return;
    }

    if (Notification.permission === 'granted') {
        // Notifications already enabled
        notificationScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadReminders();
        startCountdownTimer();
    } else if (Notification.permission === 'denied') {
        // Notifications blocked
        notificationScreen.innerHTML = `
            <div class="notification-card">
                <div class="notification-icon">
                    <i class="fas fa-ban"></i>
                </div>
                <h2>Notifications Blocked</h2>
                <p>Notifications are blocked. Please enable them in browser settings.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-sync-alt"></i> Refresh After Enabling
                </button>
            </div>
        `;
    } else {
        // Show enable notifications screen
        notificationScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Enable Notifications
    enableBtn.addEventListener('click', enableNotifications);
    
    // Form submit
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Install button
    installButton.addEventListener('click', installApp);
    
    // Modal buttons
    cancelBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
    confirmBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) deleteModal.classList.add('hidden');
    });
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'flex';
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        console.log('App installed');
        showToast('App installed successfully!', 'success');
        installButton.style.display = 'none';
    });
}

// Enable Notifications
async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // Hide notification screen, show main app
            notificationScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            
            // Send test notification
            new Notification('✅ Notifications Enabled!', {
                body: 'You will now receive call reminders.',
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
            
            // Load reminders and start app
            loadReminders();
            startCountdownTimer();
            
            showToast('Notifications enabled successfully!', 'success');
            
        } else if (permission === 'denied') {
            showToast('Notifications blocked. Please enable in browser settings.', 'error');
        }
    } catch (error) {
        showToast('Error enabling notifications', 'error');
        console.error('Notification error:', error);
    }
}

// Register Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.log('Service Worker error:', error);
        }
    }
}

// Load reminders
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        updateCounts();
        renderReminders();
        updateUpcomingCall();
    } catch (error) {
        reminders = [];
    }
}

// Update counts
function updateCounts() {
    const now = new Date();
    const upcoming = reminders.filter(r => {
        const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
        return reminderDateTime > now && !r.isExpired;
    }).length;
    
    totalReminders.textContent = reminders.length;
    upcomingCount.textContent = upcoming;
    reminderCount.textContent = reminders.length;
}

// Save reminders
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
    updateCounts();
}

// Handle form submit
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
        showToast('Please enter contact name', 'error');
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showToast('Please select future date and time', 'error');
        return;
    }

    addReminder(reminder);
    
    // Reset form
    reminderForm.reset();
    callDateInput.value = new Date().toISOString().split('T')[0];
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

// Add reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now(),
        contactName: reminder.contactName,
        phoneNumber: reminder.phoneNumber || '',
        callDate: reminder.callDate,
        callTime: reminder.callTime,
        notes: reminder.notes || '',
        notified: false,
        isExpired: false
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    
    // Schedule notification
    scheduleNotification(newReminder);
    
    showToast(`Reminder set for ${reminder.contactName}!`, 'success');
}

// Schedule notification
function scheduleNotification(reminder) {
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        setTimeout(() => {
            if (Notification.permission === 'granted') {
                new Notification('📞 Time to Call!', {
                    body: `Call ${reminder.contactName} now!`,
                    icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
                    requireInteraction: true
                });
                
                // Mark as expired
                reminder.isExpired = true;
                saveReminders();
                renderReminders();
                updateUpcomingCall();
            }
        }, timeDiff);
    }
}

// Install App - DIRECT DOWNLOAD
async function installApp() {
    if (!deferredPrompt) {
        showToast('Please use Chrome menu (⋮) → Install callremind', 'info');
        return;
    }
    
    try {
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user response
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
            showToast('Downloading app...', 'success');
            installButton.style.display = 'none';
        } else {
            console.log('User dismissed install');
            showToast('Installation cancelled', 'warning');
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Install error:', error);
        showToast('Installation failed. Please try manual install.', 'error');
    }
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
    reminderInfo.innerHTML = `
        <strong><i class="fas fa-user"></i> ${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div><i class="far fa-calendar"></i> ${reminder.callDate} at ${reminder.callTime}</div>
    `;
    deleteModal.classList.remove('hidden');
}

function confirmDelete() {
    if (reminderToDelete) {
        reminders = reminders.filter(r => r.id !== reminderToDelete.id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        deleteModal.classList.add('hidden');
        reminderToDelete = null;
        showToast('Reminder deleted', 'success');
    }
}

// Render reminders
function renderReminders() {
    reminders.sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`));
    reminderList.innerHTML = '';

    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders yet</h3>
                <p>Add your first reminder!</p>
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
                    <i class="far fa-calendar"></i> ${reminder.callDate} at ${reminder.callTime}
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
        `;

        reminderList.appendChild(reminderElement);
    });

    // Add event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteReminder(parseInt(e.target.closest('.delete-btn').dataset.id));
        });
    });

    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.complete-btn').dataset.id);
            reminders = reminders.filter(r => r.id !== id);
            saveReminders();
            renderReminders();
            updateUpcomingCall();
            showToast('Reminder marked as done', 'success');
        });
    });
}

// Update upcoming call
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
    upcomingTime.textContent = nextReminder.callTime;
}

// Countdown timer
function startCountdownTimer() {
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    
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

        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderDateTime - now;

        if (timeDiff > 0) {
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // 5-minute warning
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                nextReminder.notified = true;
                saveReminders();
            }
        } else {
            countdownElement.textContent = '--:--:--';
            if (!nextReminder.notified) {
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
                renderReminders();
                updateUpcomingCall();
            }
        }
    }, 1000);
}

// Show Toast
function showToast(message, type = 'info') {
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    
    let bgColor = '#4361ee';
    let icon = 'ℹ️';
    
    switch(type) {
        case 'success':
            bgColor = '#4cc9f0';
            icon = '✅';
            break;
        case 'error':
            bgColor = '#f72585';
            icon = '❌';
            break;
        case 'warning':
            bgColor = '#f8961e';
            icon = '⚠️';
            break;
    }
    
    toast.innerHTML = `${icon} ${message}`;
    toast.style.backgroundColor = bgColor;
    toast.classList.remove('hidden');
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}