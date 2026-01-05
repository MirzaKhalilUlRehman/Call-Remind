const reminderForm = document.getElementById('reminderForm');
const reminderList = document.getElementById('reminderList');
const reminderCount = document.getElementById('reminderCount');
const upcomingCall = document.getElementById('upcomingCall');
const countdownElement = document.getElementById('countdown');
const upcomingContact = document.getElementById('upcomingContact');
const upcomingTime = document.getElementById('upcomingTime');
const enableNotificationsBtn = document.getElementById('enableNotifications');
const notificationStatus = document.getElementById('notificationStatus');
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

let reminders = [];
let reminderToDelete = null;
let lastUpdateTime = 0; // Track last time reminders were checked

window.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    callDateInput.min = today;
    callDateInput.value = today;

    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const timeString = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
    callTimeInput.value = timeString;

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    reminders = loadReminders();
    renderReminders();
    updateUpcomingCall();
    checkNotificationPermission();
    startCountdownTimer();

    cancelDeleteBtn.addEventListener('click', closeModal);
    confirmDeleteBtn.addEventListener('click', confirmDelete);

    confirmationModal.addEventListener('click', (e) => {
        if (e.target === confirmationModal) {
            closeModal();
        }
    });
});

const STORAGE_KEY = 'callremind_reminders';

function saveReminders() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

function loadReminders() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

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
        isExpired: false // Track if reminder is expired
    };

    reminders.push(newReminder);
    saveReminders();
    renderReminders();
    updateUpcomingCall();
    showNotification('Reminder Added', `Call reminder for ${reminder.contactName} has been scheduled!`);
}

function deleteReminder(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminderToDelete = reminder;
        showDeleteConfirmation(reminder);
    }
}

function showDeleteConfirmation(reminder) {
    const formattedDate = new Date(reminder.callDate).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const formattedTime = new Date(`${reminder.callDate}T${reminder.callTime}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    reminderDetails.innerHTML = `
        <strong><i class="fas fa-user"></i> ${reminder.contactName}</strong>
        ${reminder.phoneNumber ? `<div class="reminder-phone"><i class="fas fa-phone"></i> ${reminder.phoneNumber}</div>` : ''}
        <div class="reminder-time"><i class="far fa-calendar"></i> ${formattedDate} at ${formattedTime}</div>
    `;

    confirmationModal.classList.remove('hidden');
}

function closeModal() {
    confirmationModal.classList.add('hidden');
    reminderToDelete = null;
}

function confirmDelete() {
    if (reminderToDelete) {
        reminders = reminders.filter(reminder => reminder.id !== reminderToDelete.id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        showNotification('Reminder Deleted', `Reminder for ${reminderToDelete.contactName} has been deleted.`);
        closeModal();
    }
}

function markAsCompleted(id) {
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
        reminders = reminders.filter(r => r.id !== id);
        saveReminders();
        renderReminders();
        updateUpcomingCall();
        showNotification('Call Completed', `Reminder for ${reminder.contactName} marked as done.`);
    }
}

reminderForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const reminder = {
        contactName: contactNameInput.value.trim(),
        phoneNumber: phoneNumberInput.value.trim(),
        callDate: callDateInput.value,
        callTime: callTimeInput.value,
        notes: notesInput.value.trim()
    };

    if (!reminder.contactName) {
        showNotification('Error', 'Please enter a contact name');
        contactNameInput.focus();
        return;
    }

    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    if (reminderDateTime <= new Date()) {
        showNotification('Error', 'Please select a future date and time');
        return;
    }

    addReminder(reminder);
    resetForm();
    contactNameInput.focus();
});

function resetForm() {
    reminderForm.reset();
    const today = new Date().toISOString().split('T')[0];
    callDateInput.value = today;

    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.getHours().toString().padStart(2, '0') + ':' +
        nextHour.getMinutes().toString().padStart(2, '0');
}

function renderReminders() {
    reminders.sort((a, b) => {
        const dateA = new Date(`${a.callDate}T${a.callTime}`);
        const dateB = new Date(`${b.callDate}T${b.callTime}`);
        return dateA - dateB;
    });

    reminderCount.textContent = reminders.length;
    reminderList.innerHTML = '';

    if (reminders.length === 0) {
        reminderList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-phone-slash"></i>
                <h3>No reminders yet</h3>
                <p>Add your first call reminder above!</p>
            </div>
        `;
        return;
    }

    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const now = new Date();
        const timeDiff = reminderDateTime - now;
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000;
        const isExpired = timeDiff <= 0 || reminder.isExpired;

        const formattedDate = new Date(reminder.callDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const formattedTime = new Date(`${reminder.callDate}T${reminder.callTime}`).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

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
                    <i class="far fa-calendar"></i> ${formattedDate} at ${formattedTime}
                </div>
            </div>
            ${reminder.notes ? `<div class="reminder-notes"><i class="fas fa-sticky-note"></i> ${reminder.notes}</div>` : ''}
            <div class="reminder-actions">
                <button class="btn btn-danger delete-btn" data-id="${reminder.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary complete-btn" data-id="${reminder.id}">
                    <i class="fas fa-check"></i> Mark Done
                </button>
            </div>
        `;

        reminderList.appendChild(reminderElement);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            deleteReminder(id);
        });
    });

    document.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            markAsCompleted(id);
        });
    });
}

function updateUpcomingCall() {
    if (reminders.length === 0) {
        upcomingCall.classList.add('hidden');
        return;
    }

    const now = new Date();
    
    // Sirf upcoming (future) calls dikhao
    const nextReminder = reminders
        .filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired; // ONLY FUTURE & NOT EXPIRED CALLS
        })
        .sort((a, b) => {
            const dateA = new Date(`${a.callDate}T${a.callTime}`);
            const dateB = new Date(`${b.callDate}T${b.callTime}`);
            return dateA - dateB;
        })[0];

    if (!nextReminder) {
        upcomingCall.classList.add('hidden');
        return;
    }

    upcomingCall.classList.remove('hidden');

    const formattedTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    upcomingContact.textContent = nextReminder.contactName;
    upcomingTime.textContent = formattedTime;
}

function startCountdownTimer() {
    // Pehle wala timer clear karo agar hai toh
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
    
    window.countdownInterval = setInterval(() => {
        const now = new Date();
        
        // Har 5 seconds mein reminders update karo (border change ke liye)
        if (now.getTime() - lastUpdateTime > 5000) {
            updateRemindersStatus(now);
            lastUpdateTime = now.getTime();
        }
        
        // SABHI UPCOMING (FUTURE) CALLS FIND KARO
        const upcomingReminders = reminders.filter(r => {
            const reminderDateTime = new Date(`${r.callDate}T${r.callTime}`);
            return reminderDateTime > now && !r.isExpired; // ONLY FUTURE & NOT EXPIRED
        });
        
        // AGAR KOI UPCOMING CALL NAHI HAI
        if (upcomingReminders.length === 0) {
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            return;
        }
        
        // SABSE PEHLI UPCOMING CALL (NEXT CALL)
        const nextReminder = upcomingReminders.sort((a, b) => {
            const dateA = new Date(`${a.callDate}T${a.callTime}`);
            const dateB = new Date(`${b.callDate}T${b.callTime}`);
            return dateA - dateB;
        })[0];
        
        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const timeDiff = reminderDateTime - now;
        
        // NORMAL COUNTDOWN DISPLAY
        if (timeDiff > 0) {
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // UPDATE UPCOMING CALL DISPLAY
            upcomingCall.classList.remove('hidden');
            const formattedTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            upcomingContact.textContent = nextReminder.contactName;
            upcomingTime.textContent = formattedTime;
            
            // 5 MINUTES PEHLE NOTIFICATION
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendBrowserNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`);
                nextReminder.notified = true;
                saveReminders();
            }
        } else {
            // AGAR TIME DIFF <= 0 HAI (expired call)
            countdownElement.textContent = '--:--:--';
            upcomingCall.classList.add('hidden');
            
            // Expired call ke liye notification (sirf ek baar)
            if (!nextReminder.notified) {
                sendBrowserNotification('Time to Call!', `It's time to call ${nextReminder.contactName}!`);
                nextReminder.notified = true;
                nextReminder.isExpired = true;
                saveReminders();
            }
        }
    }, 1000);
}

// NEW FUNCTION: Real-time mein reminders ka status update karo (border change ke liye)
function updateRemindersStatus(currentTime) {
    let needsUpdate = false;
    
    reminders.forEach(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        const timeDiff = reminderDateTime - currentTime;
        
        // Agar call expire ho gaya hai lekin isExpired flag nahi hai
        if (timeDiff <= 0 && !reminder.isExpired) {
            reminder.isExpired = true;
            reminder.notified = true; // Notification bhej diya hai
            needsUpdate = true;
        }
    });
    
    // Agar koi change hua hai toh UI update karo
    if (needsUpdate) {
        saveReminders();
        renderReminders(); // Yehi line border color change karegi
        updateUpcomingCall();
    }
}

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Not supported';
        notificationStatus.className = 'text-danger';
        enableNotificationsBtn.style.display = 'none';
        return;
    }

    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'Enabled';
        notificationStatus.className = 'text-success';
        enableNotificationsBtn.style.display = 'none';
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.className = 'text-danger';
        enableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Click to enable';
        notificationStatus.className = 'text-warning';
        enableNotificationsBtn.style.display = 'inline-flex';
    }
}

enableNotificationsBtn.addEventListener('click', () => {
    Notification.requestPermission().then(permission => {
        checkNotificationPermission();

        if (permission === 'granted') {
            showNotification('Notifications Enabled', 'You will now receive call reminders!');
        } else if (permission === 'denied') {
            showNotification('Notifications Blocked', 'You have blocked notifications. Please enable them in browser settings.');
        }
    });
});

function sendBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    try {
        const notification = new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📞</text></svg>',
            requireInteraction: true
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => {
            notification.close();
        }, 10000);
    } catch (error) {
        console.log('Notification error:', error);
    }
}

function showNotification(title, message) {
    const notificationEl = document.createElement('div');
    notificationEl.className = 'notification-toast';
    notificationEl.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: var(--box-shadow);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        ">
            <strong>${title}</strong>
            <p style="margin: 5px 0 0; font-size: 0.9rem;">${message}</p>
        </div>
    `;

    document.body.appendChild(notificationEl);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        notificationEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notificationEl.parentNode) {
                document.body.removeChild(notificationEl);
            }
        }, 300);
    }, 3000);
}

window.addEventListener('load', () => {
    const now = new Date();
    const validReminders = reminders.filter(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        return reminderDateTime > now || (now - reminderDateTime) < 24 * 60 * 60 * 1000;
    });

    if (validReminders.length !== reminders.length) {
        reminders = validReminders;
        saveReminders();
        renderReminders();
    }
});

// Page unload hone se pehle timer clear karo
window.addEventListener('beforeunload', () => {
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
    }
});