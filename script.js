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

// Initialize
window.addEventListener('DOMContentLoaded', () => {
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
    reminders = JSON.parse(localStorage.getItem('callremind_reminders') || '[]');
    renderReminders();
    updateUpcomingCall();
    checkNotificationPermission();
    startCountdownTimer();
    
    // Event listeners
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Modal
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
    });
    
    // Form
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Notifications
    enableNotificationsBtn.addEventListener('click', handleEnableNotifications);
    
    // Install button
    installButton.addEventListener('click', installApp);
    
    // PWA install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'inline-flex';
    });
    
    window.addEventListener('appinstalled', () => {
        installButton.style.display = 'none';
    });
}

// Install App
function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            deferredPrompt = null;
        });
    }
}

// Form Submit
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
    reminderForm.reset();
    callDateInput.value = new Date().toISOString().split('T')[0];
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

// Notifications
function handleEnableNotifications() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            notificationStatus.textContent = 'On';
            notificationStatus.className = 'notification-status text-success';
            enableNotificationsBtn.style.display = 'none';
        } else if (permission === 'denied') {
            notificationStatus.textContent = 'Blocked';
            notificationStatus.className = 'notification-status text-danger';
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
        notificationStatus.textContent = 'On';
        notificationStatus.className = 'notification-status text-success';
        enableNotificationsBtn.style.display = 'none';
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'notification-status text-danger';
        enableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Off';
        notificationStatus.className = 'notification-status text-warning';
    }
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body });
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
        isExpired: false
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    alert(`Reminder set for ${reminder.contactName}`);
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

function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
}

// UI Functions
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

    // Event listeners for buttons
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

// Countdown Timer
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
            
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`);
                nextReminder.notified = true;
                saveReminders();
            }
        } else {
            countdownElement.textContent = '--:--:--';
            if (!nextReminder.notified) {
                sendNotification('Time to Call!', `Call ${nextReminder.contactName} now!`);
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
            }
        }
    }, 1000);
}