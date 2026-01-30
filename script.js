// DOM Elements
const notificationRequirement = document.getElementById('notificationRequirement');
const appContent = document.getElementById('appContent');
const enableBtn = document.getElementById('enableBtn');
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const installButton = document.getElementById('installButton');
const notificationStatus = document.getElementById('notificationStatus');
const contactNameInput = document.getElementById('contactName');
const phoneNumberInput = document.getElementById('phoneNumber');
const callDateInput = document.getElementById('callDate');
const callTimeInput = document.getElementById('callTime');
const notesInput = document.getElementById('notes');
const confirmationModal = document.getElementById('confirmationModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const reminderDetails = document.getElementById('reminderDetails');
const toast = document.getElementById('toast');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
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

// Check notification permission
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationRequirement.innerHTML = `
            <div class="notification-card">
                <i class="fas fa-exclamation-triangle"></i>
                <h2>Browser Not Supported</h2>
                <p>Your browser does not support notifications. Please use Chrome, Edge, or Firefox.</p>
            </div>
        `;
        return;
    }

    if (Notification.permission === 'granted') {
        // Notifications enabled - show app content
        notificationRequirement.style.display = 'none';
        appContent.classList.remove('hidden');
        loadReminders();
        startCountdownTimer();
    } else if (Notification.permission === 'denied') {
        // Notifications blocked
        notificationRequirement.innerHTML = `
            <div class="notification-card">
                <i class="fas fa-ban"></i>
                <h2>Notifications Blocked</h2>
                <p>Notifications are blocked. Please enable them in browser settings to use this app.</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Refresh After Enabling
                </button>
            </div>
        `;
    } else {
        // Show enable notifications
        notificationRequirement.style.display = 'flex';
        appContent.classList.add('hidden');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Enable notifications button
    enableBtn.addEventListener('click', enableNotifications);
    
    // Form submit
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Install button
    installButton.addEventListener('click', installApp);
    
    // Modal buttons
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
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

// Enable notifications - DIRECT ACTION
async function enableNotifications() {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        // Hide notification screen and show app
        notificationRequirement.style.display = 'none';
        appContent.classList.remove('hidden');
        
        // Send test notification
        new Notification('✅ Notifications Enabled!', {
            body: 'You can now add call reminders.',
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
        });
        
        // Load reminders and start app
        loadReminders();
        startCountdownTimer();
        
        showToast('Notifications enabled successfully!', 'success');
        
    } else if (permission === 'denied') {
        showToast('Notifications are blocked. Please enable them in browser settings.', 'error');
    }
}

// Register service worker
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
        renderReminders();
        updateUpcomingCall();
    } catch (error) {
        reminders = [];
    }
}

// Save reminders
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
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
        showToast('Enter contact name', 'error');
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showToast('Select future date/time', 'error');
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

// Install app - DIRECT DOWNLOAD
async function installApp() {
    console.log('Install button clicked');
    
    if (!deferredPrompt) {
        showToast('Please use Chrome menu (⋮) → Install callremind', 'info');
        return;
    }
    
    try {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install');
            showToast('Downloading app...', 'success');
            installButton.style.display = 'none';
        } else {
            console.log('User dismissed the install');
            showToast('Installation cancelled', 'warning');
        }
        
        // Clear the deferredPrompt variable
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
        showToast('Reminder deleted', 'success');
    }
}

// Render reminders
function renderReminders() {
    reminders.sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`));
    reminderCount.textContent = reminders.length;
    reminderList.innerHTML = '';

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
            
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified && Notification.permission === 'granted') {
                new Notification('Call Reminder', {
                    body: `Call ${nextReminder.contactName} in 5 minutes!`
                });
                nextReminder.notified = true;
                saveReminders();
            }
        } else {
            countdownElement.textContent = '--:--:--';
            if (!nextReminder.notified && Notification.permission === 'granted') {
                new Notification('Time to Call!', {
                    body: `Call ${nextReminder.contactName} now!`
                });
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
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