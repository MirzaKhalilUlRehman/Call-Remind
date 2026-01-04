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

window.addEventListener('DOMContentLoaded', () => {

    const today = new Date().toISOString().split('T')[0];
    callDateInput.min = today;
    
    callDateInput.value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.toTimeString().slice(0, 5);
    
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    loadReminders();
    
    checkNotificationPermission();
    
    startCountdownTimer();
});

const STORAGE_KEY = 'callremind_reminders';

function saveReminders(reminders) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

// Load reminders from localStorage
function loadReminders() {
    const storedReminders = localStorage.getItem(STORAGE_KEY);
    if (storedReminders) {
        return JSON.parse(storedReminders);
    }
    return [];
}
let reminders = [];

// Add a new reminder
function addReminder(reminder) {
    const newReminder = {
        id: Date.now(), // Unique ID
        ...reminder,
        createdAt: new Date().toISOString(),
        notified: false // Track if notification has been sent
    };
    
    reminders.push(newReminder);
    saveReminders(reminders);
    renderReminders();
    updateUpcomingCall();
    showNotification('Reminder Added', `Call reminder for ${reminder.contactName} has been scheduled!`);
}

function deleteReminder(id) {
    const reminderToDelete = reminders.find(r => r.id === id);
    if (reminderToDelete && confirm(`Delete reminder for ${reminderToDelete.contactName}?`)) {
        reminders = reminders.filter(reminder => reminder.id !== id);
        saveReminders(reminders);
        renderReminders();
        updateUpcomingCall();
        showNotification('Reminder Deleted', `Reminder for ${reminderToDelete.contactName} has been deleted.`);
    }
}
function markAsCompleted(id) {
    reminders = reminders.filter(reminder => reminder.id !== id);
    saveReminders(reminders);
    renderReminders();
    updateUpcomingCall();
}

reminderForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get form values
    const reminder = {
        contactName: contactNameInput.value.trim(),
        phoneNumber: phoneNumberInput.value.trim(),
        callDate: callDateInput.value,
        callTime: callTimeInput.value,
        notes: notesInput.value.trim()
    };
    
    if (!reminder.contactName) {
        alert('Please enter a contact name');
        contactNameInput.focus();
        return;
    }
    
    const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
    const now = new Date();
    
    if (reminderDateTime <= now) {
        alert('Please select a future date and time');
        return;
    }
    
    addReminder(reminder);
    
    reminderForm.reset();
    
    const today = new Date().toISOString().split('T')[0];
    callDateInput.value = today;
    
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    callTimeInput.value = nextHour.toTimeString().slice(0, 5);
    
    contactNameInput.focus();
});

function renderReminders() {
    // Sort reminders by date/time (soonest first)
    reminders.sort((a, b) => {
        const dateA = new Date(`${a.callDate}T${a.callTime}`);
        const dateB = new Date(`${b.callDate}T${b.callTime}`);
        return dateA - dateB;
    });
    
    // Update count
    reminderCount.textContent = reminders.length;
    
    // Clear current list
    reminderList.innerHTML = '';
    
    // Show empty state if no reminders
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
        
        // Check if reminder is urgent (less than 1 hour away)
        const isUrgent = timeDiff > 0 && timeDiff < 60 * 60 * 1000;
        
        // Format date and time
        const formattedDate = new Date(reminder.callDate).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const formattedTime = new Date(`${reminder.callDate}T${reminder.callTime}`).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const reminderElement = document.createElement('div');
        reminderElement.className = `reminder-item ${isUrgent ? 'urgent' : ''}`;
        reminderElement.innerHTML = `
            <div class="reminder-header">
                <div>
                    <div class="reminder-contact">
                        <i class="fas fa-user"></i>
                        ${reminder.contactName}
                    </div>
                    ${reminder.phoneNumber ? `
                        <div class="reminder-phone">
                            <i class="fas fa-phone"></i> ${reminder.phoneNumber}
                        </div>
                    ` : ''}
                </div>
                <div class="reminder-time">
                    <i class="far fa-calendar"></i>
                    ${formattedDate} at ${formattedTime}
                </div>
            </div>
            
            ${reminder.notes ? `
                <div class="reminder-notes">
                    <i class="fas fa-sticky-note"></i> ${reminder.notes}
                </div>
            ` : ''}
            
            <div class="reminder-actions">
                <button class="btn btn-danger" onclick="deleteReminder(${reminder.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary" onclick="markAsCompleted(${reminder.id})">
                    <i class="fas fa-check"></i> Mark Done
                </button>
            </div>
        `;
        
        reminderList.appendChild(reminderElement);
    });
}

function updateUpcomingCall() {
    if (reminders.length === 0) {
        upcomingCall.classList.add('hidden');
        return;
    }
    
    // Get the next reminder (soonest)
    const nextReminder = reminders
        .filter(r => new Date(`${r.callDate}T${r.callTime}`) > new Date())
        .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];
    
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
    setInterval(() => {
        if (reminders.length === 0) {
            countdownElement.textContent = '--:--:--';
            return;
        }
        
        // Get the next reminder
        const nextReminder = reminders
            .filter(r => new Date(`${r.callDate}T${r.callTime}`) > new Date())
            .sort((a, b) => new Date(`${a.callDate}T${a.callTime}`) - new Date(`${b.callDate}T${b.callTime}`))[0];
        
        if (!nextReminder) {
            countdownElement.textContent = '--:--:--';
            return;
        }
        
        const reminderDateTime = new Date(`${nextReminder.callDate}T${nextReminder.callTime}`);
        const now = new Date();
        const timeDiff = reminderDateTime - now;
        
        if (timeDiff <= 0) {
            countdownElement.textContent = 'TIME TO CALL!';
            countdownElement.classList.add('text-danger');
            
            // Trigger notification for overdue reminder
            if (!nextReminder.notified) {
                sendBrowserNotification('Time to Call!', `It's time to call ${nextReminder.contactName}!`);
                nextReminder.notified = true;
                saveReminders(reminders);
            }
        } else {
            countdownElement.classList.remove('text-danger');
            
            // Calculate hours, minutes, seconds
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            
            countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Check if it's time to send notification (5 minutes before)
            if (timeDiff <= 5 * 60 * 1000 && !nextReminder.notified) {
                sendBrowserNotification('Call Reminder', `Call ${nextReminder.contactName} in 5 minutes!`);
                nextReminder.notified = true;
                saveReminders(reminders);
            }
        }
    }, 1000); // Update every second
}

function checkNotificationPermission() {
    if (!('Notification' in window)) {
        notificationStatus.textContent = 'Not supported';
        enableNotificationsBtn.style.display = 'none';
        return;
    }
    
    if (Notification.permission === 'granted') {
        notificationStatus.textContent = 'Enabled';
        notificationStatus.classList.add('text-success');
        enableNotificationsBtn.style.display = 'none';
    } else if (Notification.permission === 'denied') {
        notificationStatus.textContent = 'Blocked';
        notificationStatus.classList.add('text-danger');
        enableNotificationsBtn.style.display = 'none';
    } else {
        notificationStatus.textContent = 'Click to enable';
        notificationStatus.classList.add('text-warning');
        enableNotificationsBtn.style.display = 'inline-flex';
    }
}

enableNotificationsBtn.addEventListener('click', () => {
    Notification.requestPermission().then(permission => {
        checkNotificationPermission();
        
        if (permission === 'granted') {
            showNotification('Notifications Enabled', 'You will now receive call reminders!');
        }
    });
});

function sendBrowserNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    
    const notification = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📞</text></svg>',
        requireInteraction: true
    });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

function showNotification(title, message) {
    // Create a temporary notification element
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        notificationEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notificationEl);
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

window.addEventListener('load', () => {
    reminders = loadReminders();
    renderReminders();
    updateUpcomingCall();
    
    // Check for past reminders and clean them up
    const now = new Date();
    const validReminders = reminders.filter(reminder => {
        const reminderDateTime = new Date(`${reminder.callDate}T${reminder.callTime}`);
        return reminderDateTime > now || (now - reminderDateTime) < 24 * 60 * 60 * 1000; // Keep reminders from last 24 hours
    });
    
    if (validReminders.length !== reminders.length) {
        reminders = validReminders;
        saveReminders(reminders);
        renderReminders();
    }
});


window.deleteReminder = deleteReminder;
window.markAsCompleted = markAsCompleted;