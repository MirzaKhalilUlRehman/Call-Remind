// ===== DOM Elements =====
const elements = {
    notificationScreen: document.getElementById('notificationScreen'),
    mainApp: document.getElementById('mainApp'),
    enableBtn: document.getElementById('enableBtn'),
    reminderForm: document.getElementById('reminderForm'),
    reminderList: document.getElementById('reminderList'),
    reminderCount: document.getElementById('reminderCount'),
    nextCallCard: document.getElementById('nextCallCard'),
    countdown: document.getElementById('countdown'),
    nextContact: document.getElementById('nextContact'),
    nextTime: document.getElementById('nextTime'),
    installCard: document.getElementById('installCard'),
    installBtn: document.getElementById('installBtn'),
    liveTime: document.getElementById('liveTime'),
    deleteModal: document.getElementById('deleteModal'),
    cancelBtn: document.getElementById('cancelBtn'),
    confirmBtn: document.getElementById('confirmBtn'),
    reminderDetails: document.getElementById('reminderDetails'),
    toast: document.getElementById('toast'),
    contactName: document.getElementById('contactName'),
    phoneNumber: document.getElementById('phoneNumber'),
    callDate: document.getElementById('callDate'),
    callTime: document.getElementById('callTime'),
    notes: document.getElementById('notes'),
    currentYear: document.getElementById('currentYear')
};

// ===== App State =====
let reminders = [];
let reminderToDelete = null;
let deferredPrompt = null;
let timeouts = {};

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    // Set current year
    if (elements.currentYear) {
        elements.currentYear.textContent = new Date().getFullYear();
    }
    
    // Initialize form
    initializeForm();
    
    // Check notification permission
    checkNotificationPermission();
    
    // Load saved reminders
    loadReminders();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start live clock
    startLiveClock();
    
    // Register service worker
    registerServiceWorker();
});

// ===== Initialize Form =====
function initializeForm() {
    const today = new Date().toISOString().split('T')[0];
    if (elements.callDate) {
        elements.callDate.min = today;
        elements.callDate.value = today;
    }
    
    if (elements.callTime) {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        elements.callTime.value = nextHour.toTimeString().slice(0, 5);
    }
}

// ===== Check Notification Permission =====
function checkNotificationPermission() {
    if (!('Notification' in window)) {
        showNotificationUnsupported();
        return;
    }
    
    if (Notification.permission === 'granted') {
        elements.notificationScreen.classList.add('hidden');
        elements.mainApp.classList.remove('hidden');
        startCountdown();
    } else if (Notification.permission === 'denied') {
        showNotificationBlocked();
    }
}

// ===== Show Notification Unsupported =====
function showNotificationUnsupported() {
    if (elements.notificationScreen) {
        elements.notificationScreen.innerHTML = `
            <div class="screen-card">
                <i class="fas fa-exclamation-triangle screen-icon" style="color: var(--warning);"></i>
                <h2>Browser Not Supported</h2>
                <p>Please use Chrome, Edge, or Firefox</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Refresh
                </button>
            </div>
        `;
    }
}

// ===== Show Notification Blocked =====
function showNotificationBlocked() {
    if (elements.notificationScreen) {
        elements.notificationScreen.innerHTML = `
            <div class="screen-card">
                <i class="fas fa-ban screen-icon" style="color: var(--danger);"></i>
                <h2>Notifications Blocked</h2>
                <p>Please enable notifications in browser settings</p>
                <button onclick="window.location.reload()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Refresh
                </button>
            </div>
        `;
    }
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
    // Enable notifications
    if (elements.enableBtn) {
        elements.enableBtn.addEventListener('click', enableNotifications);
    }
    
    // Form submit
    if (elements.reminderForm) {
        elements.reminderForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Install button
    if (elements.installBtn) {
        elements.installBtn.addEventListener('click', handleInstall);
    }
    
    // Modal buttons
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', hideModal);
    }
    
    if (elements.confirmBtn) {
        elements.confirmBtn.addEventListener('click', confirmDelete);
    }
    
    // Close modal on outside click
    if (elements.deleteModal) {
        elements.deleteModal.addEventListener('click', (e) => {
            if (e.target === elements.deleteModal) hideModal();
        });
    }
    
    // PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (elements.installCard) {
            elements.installCard.classList.remove('hidden');
        }
    });
    
    // App installed
    window.addEventListener('appinstalled', () => {
        showToast('App installed successfully!', 'success');
        if (elements.installCard) {
            elements.installCard.classList.add('hidden');
        }
        deferredPrompt = null;
    });
}

// ===== Enable Notifications =====
async function enableNotifications() {
    try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            elements.notificationScreen.classList.add('hidden');
            elements.mainApp.classList.remove('hidden');
            
            sendNotification('Welcome to callremind!', 'You can now set call reminders');
            showToast('Notifications enabled!', 'success');
            
            loadReminders();
            startCountdown();
        }
    } catch (error) {
        showToast('Error enabling notifications', 'error');
    }
}

// ===== Send Notification =====
function sendNotification(title, body) {
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4de.png'
            });
        } catch (error) {
            console.log('Notification error:', error);
        }
    }
}

// ===== Register Service Worker =====
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('service-worker.js');
            console.log('Service worker registered');
        } catch (error) {
            console.log('Service worker registration failed:', error);
        }
    }
}

// ===== Load Reminders =====
function loadReminders() {
    try {
        const saved = localStorage.getItem('callremind_reminders');
        reminders = saved ? JSON.parse(saved) : [];
        
        // Clean expired reminders
        const now = new Date();
        reminders = reminders.filter(r => {
            const reminderTime = new Date(`${r.date}T${r.time}`);
            return reminderTime > now && !r.completed;
        });
        
        saveReminders();
        renderReminders();
        updateNextCall();
        scheduleAllNotifications();
    } catch (error) {
        reminders = [];
        showToast('Error loading reminders', 'error');
    }
}

// ===== Save Reminders =====
function saveReminders() {
    localStorage.setItem('callremind_reminders', JSON.stringify(reminders));
    if (elements.reminderCount) {
        elements.reminderCount.textContent = reminders.length;
    }
}

// ===== Handle Form Submit =====
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validation
    if (!elements.contactName.value.trim()) {
        showToast('Please enter contact name', 'error');
        elements.contactName.focus();
        return;
    }
    
    const reminderTime = new Date(`${elements.callDate.value}T${elements.callTime.value}`);
    if (reminderTime <= new Date()) {
        showToast('Please select a future time', 'error');
        return;
    }
    
    // Create reminder
    const reminder = {
        id: Date.now(),
        name: elements.contactName.value.trim(),
        phone: elements.phoneNumber.value.trim(),
        date: elements.callDate.value,
        time: elements.callTime.value,
        notes: elements.notes.value.trim(),
        createdAt: new Date().toISOString(),
        completed: false
    };
    
    // Add to list
    reminders.push(reminder);
    saveReminders();
    renderReminders();
    updateNextCall();
    scheduleNotification(reminder);
    
    // Show success
    showToast(`Reminder set for ${reminder.name}`, 'success');
    sendNotification('Reminder Set', `We'll remind you to call ${reminder.name}`);
    
    // Reset form
    elements.contactName.value = '';
    elements.phoneNumber.value = '';
    elements.notes.value = '';
    initializeForm();
}

// ===== Schedule Notification =====
function scheduleNotification(reminder) {
    const reminderTime = new Date(`${reminder.date}T${reminder.time}`);
    const now = new Date();
    const timeUntilReminder = reminderTime - now;
    
    if (timeUntilReminder > 0) {
        // Main notification
        timeouts[reminder.id] = setTimeout(() => {
            sendNotification('📞 Time to Call!', `Call ${reminder.name} now!`);
            
            reminder.completed = true;
            saveReminders();
            renderReminders();
            updateNextCall();
            
            delete timeouts[reminder.id];
        }, timeUntilReminder);
        
        // 5-minute warning
        if (timeUntilReminder > 5 * 60 * 1000) {
            setTimeout(() => {
                sendNotification('⏰ 5 Minutes Left', `Call ${reminder.name} soon!`);
            }, timeUntilReminder - 5 * 60 * 1000);
        }
    }
}

// ===== Schedule All Notifications =====
function scheduleAllNotifications() {
    Object.values(timeouts).forEach(clearTimeout);
    timeouts = {};
    reminders.forEach(scheduleNotification);
}

// ===== Render Reminders =====
function renderReminders() {
    if (!elements.reminderList) return;
    
    if (reminders.length === 0) {
        elements.reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <p>No reminders yet</p>
                <small>Add your first reminder</small>
            </div>
        `;
        return;
    }
    
    // Sort by time
    reminders.sort((a, b) => {
        return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
    });
    
    let html = '';
    const now = new Date();
    
    reminders.forEach(r => {
        const reminderTime = new Date(`${r.date}T${r.time}`);
        const timeDiff = reminderTime - now;
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000;
        
        html += `
            <div class="reminder-item ${isUrgent ? 'urgent' : ''}" data-id="${r.id}">
                <div class="reminder-header">
                    <div>
                        <div class="reminder-name">
                            <i class="fas fa-user"></i> ${escapeHtml(r.name)}
                        </div>
                        ${r.phone ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${escapeHtml(r.phone)}</div>` : ''}
                    </div>
                    <div class="reminder-time">
                        <i class="far fa-calendar"></i> ${r.date} ${r.time}
                    </div>
                </div>
                ${r.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${escapeHtml(r.notes)}</div>` : ''}
                <div class="reminder-actions">
                    <button class="btn btn-secondary complete-btn">
                        <i class="fas fa-check"></i> Done
                    </button>
                    <button class="btn btn-danger delete-btn">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    elements.reminderList.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.reminder-item').dataset.id);
            deleteReminder(id);
        });
    });
    
    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.closest('.reminder-item').dataset.id);
            completeReminder(id);
        });
    });
}

// ===== Escape HTML =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Delete Reminder =====
function deleteReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminderToDelete = reminder;
        
        if (elements.reminderDetails) {
            elements.reminderDetails.innerHTML = `
                <strong><i class="fas fa-user"></i> ${escapeHtml(reminder.name)}</strong>
                ${reminder.phone ? `<div><i class="fas fa-phone"></i> ${escapeHtml(reminder.phone)}</div>` : ''}
                <div><i class="far fa-calendar"></i> ${reminder.date} at ${reminder.time}</div>
            `;
        }
        
        showModal();
    }
}

// ===== Complete Reminder =====
function completeReminder(id) {
    reminders = reminders.filter(r => r.id !== id);
    
    if (timeouts[id]) {
        clearTimeout(timeouts[id]);
        delete timeouts[id];
    }
    
    saveReminders();
    renderReminders();
    updateNextCall();
    showToast('Reminder completed', 'success');
}

// ===== Confirm Delete =====
function confirmDelete() {
    if (reminderToDelete) {
        reminders = reminders.filter(r => r.id !== reminderToDelete.id);
        
        if (timeouts[reminderToDelete.id]) {
            clearTimeout(timeouts[reminderToDelete.id]);
            delete timeouts[reminderToDelete.id];
        }
        
        saveReminders();
        renderReminders();
        updateNextCall();
        showToast('Reminder deleted', 'success');
        
        reminderToDelete = null;
        hideModal();
    }
}

// ===== Update Next Call =====
function updateNextCall() {
    if (!elements.nextCallCard || !elements.nextContact || !elements.nextTime) return;
    
    const now = new Date();
    const upcoming = reminders.filter(r => {
        return new Date(`${r.date}T${r.time}`) > now;
    });
    
    if (upcoming.length === 0) {
        elements.nextCallCard.classList.add('hidden');
        return;
    }
    
    upcoming.sort((a, b) => {
        return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
    });
    
    const next = upcoming[0];
    elements.nextCallCard.classList.remove('hidden');
    elements.nextContact.textContent = next.name;
    elements.nextTime.textContent = next.time;
}

// ===== Start Countdown =====
function startCountdown() {
    if (!elements.countdown) return;
    
    setInterval(() => {
        const now = new Date();
        const upcoming = reminders.filter(r => {
            return new Date(`${r.date}T${r.time}`) > now;
        });
        
        if (upcoming.length === 0) {
            elements.countdown.textContent = '--:--:--';
            return;
        }
        
        upcoming.sort((a, b) => {
            return new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`);
        });
        
        const next = upcoming[0];
        const nextTime = new Date(`${next.date}T${next.time}`);
        const diff = nextTime - now;
        
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            elements.countdown.textContent = 
                `${hours.toString().padStart(2, '0')}:` +
                `${minutes.toString().padStart(2, '0')}:` +
                `${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// ===== Start Live Clock =====
function startLiveClock() {
    if (!elements.liveTime) return;
    
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        elements.liveTime.textContent = `${hours}:${minutes}`;
    }, 1000);
}

// ===== Handle Install =====
async function handleInstall() {
    if (!deferredPrompt) {
        showToast('Click browser menu → Install "callremind"', 'info');
        return;
    }
    
    try {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        
        if (result.outcome === 'accepted') {
            showToast('Installing app...', 'success');
            if (elements.installCard) {
                elements.installCard.classList.add('hidden');
            }
        } else {
            showToast('Installation cancelled', 'warning');
        }
        
        deferredPrompt = null;
    } catch (error) {
        showToast('Installation failed', 'error');
    }
}

// ===== Modal Controls =====
function showModal() {
    if (elements.deleteModal) {
        elements.deleteModal.classList.add('show');
    }
}

function hideModal() {
    if (elements.deleteModal) {
        elements.deleteModal.classList.remove('show');
    }
    reminderToDelete = null;
}

// ===== Show Toast =====
function showToast(message, type = 'info') {
    if (!elements.toast) return;
    
    const colors = {
        success: '#4cc9f0',
        error: '#f72585',
        warning: '#f8961e',
        info: '#4361ee'
    };
    
    elements.toast.textContent = message;
    elements.toast.style.background = colors[type] || colors.info;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}