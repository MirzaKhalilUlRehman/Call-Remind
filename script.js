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
const confirmationModal = document.getElementById('confirmationModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
const reminderDetails = document.getElementById('reminderDetails');

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
    
    // Load reminders
    loadReminders();
    
    // Check notification permission
    checkNotificationPermission();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start countdown timer
    startCountdownTimer();
    
    // Register service worker
    registerServiceWorker();
});

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

// Setup event listeners
function setupEventListeners() {
    // Form submit
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Enable notifications
    enableNotificationsBtn.addEventListener('click', enableNotifications);
    
    // Install button
    installButton.addEventListener('click', installApp);
    
    // Modal
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
    });
    
    // PWA install prompt - THIS IS IMPORTANT!
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button
        installButton.style.display = 'inline-flex';
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        console.log('App installed');
        installButton.style.display = 'none';
        installInfo.innerHTML = '<p style="margin: 0; font-size: 0.8rem; color: #00a000;"><i class="fas fa-check-circle"></i> App installed</p>';
    });
}

// Check notification permission
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
    }
}

// Enable notifications
function enableNotifications() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            notificationStatus.textContent = 'Enabled';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
            
            // Send test notification
            new Notification('✅ Notifications Enabled', {
                body: 'You can now add reminders!',
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
            
        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'notification-status text-danger';
            enableNotificationsBtn.style.display = 'none';
        }
    });
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
        alert('Enter contact name');
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        alert('Select future date/time');
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
    
    alert(`Reminder set for ${reminder.contactName}!`);
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
                    icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
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

// Install app - FIXED FUNCTION
async function installApp() {
    console.log('Install button clicked');
    
    if (!deferredPrompt) {
        console.log('No install prompt available');
        alert('Install option not available. Please use Chrome menu (⋮) → Install app');
        return;
    }
    
    console.log('Showing install prompt...');
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond
    const choiceResult = await deferredPrompt.userChoice;
    
    console.log('User choice:', choiceResult.outcome);
    
    if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install');
        installButton.style.display = 'none';
        installInfo.innerHTML = '<p style="margin: 0; font-size: 0.8rem; color: #00a000;"><i class="fas fa-check-circle"></i> App installing...</p>';
    } else {
        console.log('User dismissed the install');
        installButton.style.display = 'inline-flex';
    }
    
    // Clear the deferredPrompt variable
    deferredPrompt = null;
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