// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const enableBtn = document.getElementById('enableBtn');
const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const installButton = document.getElementById('installButton');
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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set today's date and next hour as default
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
        showToast('Your browser does not support notifications', 'error');
        return;
    }
    
    if (Notification.permission === 'granted') {
        // Notifications already enabled
        step1.style.display = 'none';
        step2.classList.remove('hidden');
        loadReminders();
        startCountdownTimer();
    } else {
        // Show enable notifications step
        step1.style.display = 'block';
        step2.classList.add('hidden');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Enable Notifications Button
    enableBtn.addEventListener('click', enableNotifications);
    
    // Reminder Form
    reminderForm.addEventListener('submit', handleFormSubmit);
    
    // Install Button
    installButton.addEventListener('click', handleInstall);
    
    // Modal buttons
    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Close modal when clicking outside
    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) closeModal();
    });
    
    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button
        installButton.style.display = 'flex';
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        console.log('App installed successfully');
        showToast('App installed successfully!', 'success');
        installButton.style.display = 'none';
    });
}

// Enable Notifications - DIRECT ACTION
async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            // Hide step 1, show step 2
            step1.style.display = 'none';
            step2.classList.remove('hidden');
            
            // Send test notification
            new Notification('🔔 Notifications Enabled!', {
                body: 'You will now receive call reminders.',
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
            
            // Load reminders and start app
            loadReminders();
            startCountdownTimer();
            
            showToast('Notifications enabled successfully!', 'success');
            
        } else if (permission === 'denied') {
            showToast('Notifications blocked. Please enable them in browser settings.', 'error');
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
            console.log('Service Worker registered successfully');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// Load Reminders from LocalStorage
function loadReminders() {
    try {
        const stored = localStorage.getItem('callremind_reminders');
        reminders = stored ? JSON.parse(stored) : [];
        renderReminders();
        updateUpcomingCall();
    } catch (error) {
        reminders = [];
        console.error('Error loading reminders:', error);
    }
}

// Save Reminders to LocalStorage
function saveReminders() {
    try {
        localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
    } catch (error) {
        console.error('Error saving reminders:', error);
    }
}

// Handle Form Submit
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
        return;
    }
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showToast('Please select a future date and time', 'error');
        return;
    }
    
    // Add reminder
    addReminder(reminder);
    
    // Reset form
    reminderForm.reset();
    callDateInput.value = new Date().toISOString().split('T')[0];
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' + 
                         nextHour.getMinutes().toString().padStart(2, '0');
}

// Add New Reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now(),
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
    
    showToast(`Reminder set for ${reminder.contactName}!`, 'success');
}

// Schedule Notification
function scheduleNotification(reminder) {
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    const timeDiff = reminderDateTime - now;
    
    if (timeDiff > 0) {
        setTimeout(() => {
            if (Notification.permission === 'granted') {
                // Send notification
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
                
                // Send 5-minute warning if browser is open
                setTimeout(() => {
                    if (Notification.permission === 'granted') {
                        new Notification('⏰ Call in 5 minutes!', {
                            body: `Call ${reminder.contactName} in 5 minutes`,
                            icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
                        });
                    }
                }, Math.max(0, timeDiff - (5 * 60 * 1000)));
            }
        }, timeDiff);
    }
}

// Install App - DIRECT DOWNLOAD
async function handleInstall() {
    if (!deferredPrompt) {
        // If no install prompt, guide user to manual install
        showToast('Please use Chrome menu (⋮) → "Install callremind"', 'info');
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
            showToast('Installation cancelled', 'error');
        }
        
        // Clear the deferredPrompt variable
        deferredPrompt = null;
        
    } catch (error) {
        console.error('Install error:', error);
        showToast('Installation failed. Please try manual install.', 'error');
    }
}

// Delete Reminder
function deleteReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminderToDelete = reminder;
        showDeleteConfirmation(reminder);
    }
}

function showDeleteConfirmation(reminder) {
    reminderDetails.innerHTML = `
        <strong>${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div class="reminder-phone">📱 ${reminder.phoneNumber}</div>` : ''}
        <div class="reminder-time">📅 ${reminder.callDate} at ${reminder.callTime}</div>
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

// Render Reminders List
function renderReminders() {
    // Sort reminders by date/time
    reminders.sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`));
    
    // Update count
    reminderCount.textContent = reminders.length;
    
    // Clear list
    reminderList.innerHTML = '';
    
    if (reminders.length === 0) {
        // Show empty state
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
                <div class="reminder-contact">${reminder.contactName}</div>
                <div class="reminder-time">
                    <i class="far fa-clock"></i> ${reminder.callTime}
                </div>
            </div>
            
            ${reminder.phoneNumber ? `
                <div class="reminder-phone">
                    <i class="fas fa-phone"></i> ${reminder.phoneNumber}
                </div>
            ` : ''}
            
            ${reminder.notes ? `
                <div class="reminder-notes">
                    <i class="fas fa-sticky-note"></i> ${reminder.notes}
                </div>
            ` : ''}
            
            <div class="reminder-actions">
                <button class="btn btn-secondary complete-btn" data-id="${reminder.id}">
                    <i class="fas fa-check"></i> Done
                </button>
                <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        reminderList.appendChild(reminderElement);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.delete-btn').dataset.id);
            deleteReminder(id);
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

// Update Upcoming Call
function updateUpcomingCall() {
    const now = new Date();
    const upcomingReminders = reminders.filter(r => {
        const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
        return reminderDateTime > now && !r.isExpired;
    });
    
    if (upcomingReminders.length === 0) {
        upcomingCall.classList.add('hidden');
        return;
    }
    
    // Get the next reminder
    const nextReminder = upcomingReminders.sort(
        (a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`)
    )[0];
    
    upcomingCall.classList.remove('hidden');
    upcomingContact.textContent = nextReminder.contactName;
    upcomingTime.textContent = nextReminder.callTime;
}

// Countdown Timer
function startCountdownTimer() {
    if (window.countdownInterval) clearInterval(window.countdownInterval);
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        const upcomingReminders = reminders.filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired;
        });
        
        if (upcomingReminders.length === 0) {
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            return;
        }
        
        // Get the next reminder
        const nextReminder = upcomingReminders.sort(
            (a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`)
        )[0];
        
        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        
        if (timeDiff > 0) {
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
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

// Show Toast Notification
function showToast(message, type = 'info') {
    // Set toast styles based on type
    let bgColor = '#4361ee'; // default blue
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
    
    // Update toast content
    toast.textContent = `${icon} ${message}`;
    toast.style.backgroundColor = bgColor;
    toast.classList.remove('hidden');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}