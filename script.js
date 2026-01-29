// DOM Elements
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const submitBtn = document.getElementById('submitBtn');
const enableNotificationsBtn = document.getElementById('enableNotifications');
const installButton = document.getElementById('installButton');
const notificationStatusBox = document.getElementById('notificationStatusBox');
const installBox = document.getElementById('installBox');
const installedBox = document.getElementById('installedBox');
const deleteModal = document.getElementById('deleteModal');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const reminderDetails = document.getElementById('reminderDetails');

// Variables
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;

// Check if PWA is installed
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default date/time
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('callDate').value = today;
    document.getElementById('callDate').min = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    document.getElementById('callTime').value = 
        nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
    
    // Load reminders
    loadReminders();
    
    // Check notification status
    checkNotificationStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Register service worker
    registerServiceWorker();
    
    // Check PWA status
    if (isPWAInstalled()) {
        installBox.classList.add('hidden');
        installedBox.classList.remove('hidden');
    }
});

// Load reminders
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        renderReminders();
    } catch (error) {
        reminders = [];
    }
}

// Save reminders
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
}

// Check notification status
function checkNotificationStatus() {
    if (!('Notification' in window)) {
        showMessage('Notifications not supported');
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationStatusBox.classList.add('hidden');
        submitBtn.disabled = false;
        
        // Show install button if PWA is not installed
        if (!isPWAInstalled()) {
            installBox.classList.remove('hidden');
        }
        
    } else if (Notification.permission === 'denied') {
        showMessage('Notifications blocked. Enable in browser settings.');
        submitBtn.disabled = true;
    } else {
        submitBtn.disabled = true;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submit
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Enable notifications
    enableNotificationsBtn.addEventListener('click', enableNotifications);
    
    // Install app
    installButton.addEventListener('click', installApp);
    
    // Modal
    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));
    confirmDelete.addEventListener('click', confirmDeleteReminder);
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (Notification.permission === 'granted' && !isPWAInstalled()) {
            installBox.classList.remove('hidden');
        }
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        installBox.classList.add('hidden');
        installedBox.classList.remove('hidden');
        showMessage('App installed successfully!');
    });
}

// Handle form submit
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (Notification.permission !== 'granted') {
        showMessage('Please enable notifications first');
        enableNotifications();
        return;
    }
    
    const reminder = {
        contactName: document.getElementById('contactName').value.trim(),
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        callDate: document.getElementById('callDate').value,
        callTime: document.getElementById('callTime').value,
        notes: document.getElementById('notes').value.trim()
    };
    
    if (!reminder.contactName) {
        showMessage('Please enter contact name');
        return;
    }
    
    const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderTime <= new Date()) {
        showMessage('Please select future date and time');
        return;
    }
    
    addReminder(reminder);
    reminderForm.reset();
    
    // Reset date/time
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('callDate').value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    document.getElementById('callTime').value = 
        nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

// Enable notifications - SIMPLE ONE CLICK
async function enableNotifications() {
    if (!('Notification' in window)) {
        showMessage('Notifications not supported');
        return;
    }
    
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            notificationStatusBox.classList.add('hidden');
            submitBtn.disabled = false;
            
            // Send test notification
            new Notification('✅ Notifications Enabled', {
                body: 'You can now add reminders!',
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
            
            // Show install button if available
            if (deferredPrompt && !isPWAInstalled()) {
                installBox.classList.remove('hidden');
            }
            
        } else {
            showMessage('Please enable notifications');
        }
    } catch (error) {
        showMessage('Error enabling notifications');
    }
}

// Install app - SIMPLE ONE CLICK
async function installApp() {
    if (!deferredPrompt) {
        showMessage('Use Chrome menu (⋮) → Install app');
        return;
    }
    
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    
    if (result.outcome === 'accepted') {
        deferredPrompt = null;
    }
}

// Add reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now().toString(),
        contactName: reminder.contactName,
        phoneNumber: reminder.phoneNumber,
        callDate: reminder.callDate,
        callTime: reminder.callTime,
        notes: reminder.notes,
        notified: false
    };
    
    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    
    // Schedule notification
    scheduleNotification(newReminder);
    
    // Send confirmation
    new Notification('✅ Reminder Added', {
        body: `Reminder set for ${newReminder.contactName} on ${newReminder.callDate} at ${newReminder.callTime}`,
        icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
    });
    
    showMessage('Reminder added successfully!');
}

// Schedule notification
function scheduleNotification(reminder) {
    const reminderTime = new Date(`${reminder.callDate}T${reminder.callTime}`).getTime();
    const now = Date.now();
    const timeDiff = reminderTime - now;
    
    if (timeDiff <= 0) return;
    
    // Schedule notification
    setTimeout(() => {
        if (Notification.permission === 'granted') {
            new Notification('📞 Time to Call!', {
                body: `Call ${reminder.contactName} now!${reminder.phoneNumber ? ` Phone: ${reminder.phoneNumber}` : ''}`,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
            
            // Mark as notified
            reminder.notified = true;
            saveReminders();
            renderReminders();
        }
    }, timeDiff);
}

// Render reminders
function renderReminders() {
    reminderCount.textContent = reminders.length;
    
    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders</h3>
                <p>Add a reminder</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    reminders.forEach(reminder => {
        html += `
            <div class="reminder-item">
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
                ${reminder.notes ? `<p style="margin-top: 10px; color: #666;">${reminder.notes}</p>` : ''}
                <div class="reminder-actions">
                    <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    reminderList.innerHTML = html;
    
    // Add delete event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.delete-btn').dataset.id;
            deleteReminder(id);
        });
    });
}

// Delete reminder
function deleteReminder(id) {
    reminderToDelete = reminders.find(r => r.id === id);
    if (reminderToDelete) {
        reminderDetails.innerHTML = `
            <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <strong><i class="fas fa-user"></i> ${reminderToDelete.contactName}</strong><br>
                <span style="color: #666; font-size: 0.9rem;">
                    ${reminderToDelete.callDate} at ${reminderToDelete.callTime}
                </span>
            </div>
        `;
        deleteModal.classList.remove('hidden');
    }
}

function confirmDeleteReminder() {
    if (reminderToDelete) {
        reminders = reminders.filter(r => r.id !== reminderToDelete.id);
        saveReminders();
        renderReminders();
        deleteModal.classList.add('hidden');
        showMessage('Reminder deleted');
    }
}

// Register service worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
        } catch (error) {
            console.log('Service worker error:', error);
        }
    }
}

// Show message
function showMessage(text) {
    alert(text); // Simple alert for now
}

// Make available globally
window.callremind = { reminders, addReminder };