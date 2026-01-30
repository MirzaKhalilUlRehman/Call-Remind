// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const enableBtn = document.getElementById('enableBtn');
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const nextCallCard = document.getElementById('nextCallCard');
const countdownElement = document.getElementById('countdown');
const nextContact = document.getElementById('nextContact');
const nextTime = document.getElementById('nextTime');
const installCard = document.getElementById('installCard');
const installBtn = document.getElementById('installBtn');
const currentTime = document.getElementById('currentTime');
const contactNameInput = document.getElementById('contactName');
const phoneNumberInput = document.getElementById('phoneNumber');
const callDateInput = document.getElementById('callDate');
const callTimeInput = document.getElementById('callTime');
const notesInput = document.getElementById('notes');
const deleteModal = document.getElementById('deleteModal');
const cancelBtn = document.getElementById('cancelBtn');
const confirmBtn = document.getElementById('confirmBtn');
const reminderDetails = document.getElementById('reminderDetails');
const toast = document.getElementById('toast');
const currentYear = document.getElementById('currentYear');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;
let scheduledNotifications = {};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set current year
    currentYear.textContent = new Date().getFullYear();
    
    // Initialize form
    initializeForm();
    
    // Check notification permission
    checkNotificationPermission();
    
    // Setup event listeners
    setupEventListeners();
    
    // Register service worker
    registerServiceWorker();
    
    // Start real-time clock
    updateClock();
    setInterval(updateClock, 60000); // Update every minute
});

// Initialize Form
function initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    // Set min date to today
    callDateInput.min = today;
    callDateInput.value = today;
    
    // Set default time to next 30 minutes
    const nextHalfHour = new Date(now.getTime() + 30 * 60000);
    const hours = nextHalfHour.getHours().toString().padStart(2, '0');
    const minutes = Math.ceil(nextHalfHour.getMinutes() / 5) * 5; // Round to nearest 5 minutes
    callTimeInput.value = `${hours}:${minutes.toString().padStart(2, '0')}`;
}

// Update Real-time Clock
function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    currentTime.textContent = `${hours}:${minutes}`;
}

// Check Notification Permission
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Browser does not support notifications', 'error');
        return;
    }

    if (Notification.permission === 'granted') {
        // App is ready
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        loadReminders();
        startCountdown();
    } else if (Notification.permission === 'denied') {
        // Notifications blocked
        step1.innerHTML = `
            <div class="step-card">
                <div class="step-icon" style="color: var(--danger);">
                    <i class="fas fa-ban"></i>
                </div>
                <h2>Notifications Blocked</h2>
                <p>Please enable notifications in browser settings</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Refresh
                </button>
            </div>
        `;
    } else {
        // Show enable screen
        step1.classList.remove('hidden');
        step2.classList.add('hidden');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Enable Notifications
    enableBtn.addEventListener('click', enableNotifications);
    
    // Form submit
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Install button
    installBtn.addEventListener('click', handleInstall);
    
    // Modal buttons
    cancelBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));
    confirmBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) deleteModal.classList.add('hidden');
    });
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installCard.classList.remove('hidden');
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        showToast('App installed successfully!', 'success');
        installCard.classList.add('hidden');
    });
}

// Enable Notifications
async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // Show main app
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            
            // Send welcome notification
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'TEST_NOTIFICATION',
                    title: '✅ Notifications Enabled',
                    body: 'callremind is ready to use!'
                });
            } else {
                new Notification('✅ Notifications Enabled', {
                    body: 'callremind is ready to use!',
                    icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
                });
            }
            
            // Load and start app
            loadReminders();
            startCountdown();
            
            showToast('Notifications enabled!', 'success');
            
        } else if (permission === 'denied') {
            showToast('Notifications blocked. Please enable in settings.', 'error');
        }
    } catch (error) {
        console.error('Notification error:', error);
        showToast('Error enabling notifications', 'error');
    }
}

// Register Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('service-worker.js');
            console.log('Service Worker registered:', registration);
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'REMINDER_TRIGGERED') {
                    handleReminderTrigger(event.data.reminderId);
                }
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// Load reminders
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        
        // Load scheduled notifications
        const scheduled = localStorage.getItem('callremind_scheduled');
        scheduledNotifications = scheduled ? JSON.parse(scheduled) : {};
        
        renderReminders();
        updateNextCall();
        
        // Reschedule all notifications
        rescheduleAllNotifications();
        
    } catch (error) {
        reminders = [];
        scheduledNotifications = {};
    }
}

// Save reminders
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
    localStorage.setItem('callremind_scheduled', JSON.stringify(scheduledNotifications));
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

    // Validation
    if (!reminder.contactName) {
        showToast('Please enter contact name', 'error');
        contactNameInput.focus();
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showToast('Please select a future time', 'error');
        return;
    }

    // Add reminder
    addReminder(reminder);
    
    // Reset form
    reminderForm.reset();
    initializeForm();
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
        createdAt: new Date().toISOString(),
        notified: false,
        isExpired: false
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateNextCall();
    
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
        // Store in scheduled notifications
        scheduledNotifications[reminder.id] = {
            reminderId: reminder.id,
            scheduledTime: reminderDateTime.getTime(),
            contactName: reminder.contactName
        };
        saveReminders();
        
        // Schedule desktop notification
        setTimeout(() => {
            triggerReminderNotification(reminder);
        }, timeDiff);
        
        // Schedule 5-minute warning
        if (timeDiff > 5 * 60 * 1000) {
            setTimeout(() => {
                sendWarningNotification(reminder);
            }, timeDiff - (5 * 60 * 1000));
        }
        
        console.log(`Notification scheduled for ${reminder.contactName} at ${reminder.callTime}`);
    }
}

// Trigger reminder notification
function triggerReminderNotification(reminder) {
    if (Notification.permission === 'granted') {
        const notification = new Notification('📞 Time to Call!', {
            body: `Call ${reminder.contactName} now!`,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            requireInteraction: true,
            tag: `reminder-${reminder.id}`,
            vibrate: [200, 100, 200]
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        // Update reminder status
        reminder.isExpired = true;
        reminder.notified = true;
        delete scheduledNotifications[reminder.id];
        saveReminders();
        renderReminders();
        updateNextCall();
    }
}

// Send warning notification
function sendWarningNotification(reminder) {
    if (Notification.permission === 'granted') {
        new Notification('⏰ Call in 5 minutes!', {
            body: `Call ${reminder.contactName} soon`,
            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png',
            tag: `warning-${reminder.id}`
        });
    }
}

// Reschedule all notifications
function rescheduleAllNotifications() {
    const now = new Date().getTime();
    
    // Clear existing timeouts
    for (const id in scheduledNotifications) {
        const scheduled = scheduledNotifications[id];
        const reminder = reminders.find(r => r.id == id);
        
        if (reminder && scheduled.scheduledTime > now) {
            const timeDiff = scheduled.scheduledTime - now;
            
            // Reschedule notification
            setTimeout(() => {
                triggerReminderNotification(reminder);
            }, timeDiff);
            
            // Reschedule warning
            if (timeDiff > 5 * 60 * 1000) {
                setTimeout(() => {
                    sendWarningNotification(reminder);
                }, timeDiff - (5 * 60 * 1000));
            }
        }
    }
}

// Handle reminder trigger from service worker
function handleReminderTrigger(reminderId) {
    const reminder = reminders.find(r => r.id == reminderId);
    if (reminder) {
        reminder.isExpired = true;
        reminder.notified = true;
        delete scheduledNotifications[reminderId];
        saveReminders();
        renderReminders();
        updateNextCall();
    }
}

// Install App
async function handleInstall() {
    if (!deferredPrompt) {
        showToast('Use Chrome menu (⋮) → "Install callremind"', 'info');
        return;
    }
    
    try {
        // Show install prompt
        deferredPrompt.prompt();
        
        // Wait for user response
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
            showToast('Installing app...', 'success');
            installCard.classList.add('hidden');
        } else {
            console.log('User dismissed install');
            showToast('Installation cancelled', 'warning');
        }
        
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Install error:', error);
        showToast('Installation failed', 'error');
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
        ${reminder.phoneNumber ? `<div><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div><i class="far fa-calendar"></i> ${reminder.callDate} at ${reminder.callTime}</div>
    `;
    deleteModal.classList.remove('hidden');
}

function confirmDelete() {
    if (reminderToDelete) {
        // Remove from arrays
        reminders = reminders.filter(r => r.id !== reminderToDelete.id);
        delete scheduledNotifications[reminderToDelete.id];
        
        // Save and update
        saveReminders();
        renderReminders();
        updateNextCall();
        
        // Close modal
        deleteModal.classList.add('hidden');
        reminderToDelete = null;
        
        showToast('Reminder deleted', 'success');
    }
}

// Render reminders
function renderReminders() {
    // Sort by date/time (soonest first)
    reminders.sort((a, b) => {
        const timeA = new Date(`${a.callDate}T${a.callTime}`).getTime();
        const timeB = new Date(`${b.callDate}T${b.callTime}`).getTime();
        return timeA - timeB;
    });
    
    // Update count
    reminderCount.textContent = reminders.length;
    
    // Clear list
    reminderList.innerHTML = '';
    
    if (reminders.length === 0) {
        // Show empty state
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h4>No reminders</h4>
                <p>Add your first reminder</p>
            </div>
        `;
        return;
    }
    
    const now = new Date();
    
    // Create reminder items
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
                    <div class="reminder-name">
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
                <button class="btn btn-primary complete-btn" data-id="${reminder.id}">
                    <i class="fas fa-check"></i> Done
                </button>
                <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        reminderList.appendChild(reminderElement);
    });
    
    // Add event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.delete-btn').dataset.id);
            deleteReminder(id);
        });
    });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.complete-btn').dataset.id);
            completeReminder(id);
        });
    });
}

// Complete reminder
function completeReminder(id) {
    const index = reminders.findIndex(r => r.id === id);
    if (index !== -1) {
        // Remove from scheduled
        delete scheduledNotifications[id];
        
        // Remove from reminders
        reminders.splice(index, 1);
        
        // Save and update
        saveReminders();
        renderReminders();
        updateNextCall();
        
        showToast('Reminder completed', 'success');
    }
}

// Update next call
function updateNextCall() {
    const now = new Date();
    const upcomingReminders = reminders.filter(r => {
        const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
        return reminderDateTime > now && !r.isExpired;
    });
    
    if (upcomingReminders.length === 0) {
        nextCallCard.classList.add('hidden');
        return;
    }
    
    // Get the next reminder (soonest)
    const nextReminder = upcomingReminders.sort(
        (a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`)
    )[0];
    
    nextCallCard.classList.remove('hidden');
    nextContact.textContent = nextReminder.contactName;
    nextTime.textContent = nextReminder.callTime;
}

// Start countdown
function startCountdown() {
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        const upcomingReminders = reminders.filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired;
        });
        
        if (upcomingReminders.length === 0) {
            countdownElement.textContent = '--:--:--';
            nextCallCard.classList.add('hidden');
            return;
        }
        
        // Get the next reminder
        const nextReminder = upcomingReminders.sort(
            (a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`)
        )[0];
        
        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        
        if (timeDiff > 0) {
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            countdownElement.textContent = 
                `${hours.toString().padStart(2, '0')}:` +
                `${minutes.toString().padStart(2, '0')}:` +
                `${seconds.toString().padStart(2, '0')}`;
        } else {
            countdownElement.textContent = '--:--:--';
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
    toast.style.background = `linear-gradient(135deg, ${bgColor} 0%, ${darkenColor(bgColor, 20)} 100%)`;
    toast.classList.remove('hidden');
    
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Helper: Darken color
function darkenColor(color, percent) {
    let num = parseInt(color.replace("#", ""), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) - amt;
    let G = (num >> 8 & 0x00FF) - amt;
    let B = (num & 0x0000FF) - amt;
    
    return "#" + (
        0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
}