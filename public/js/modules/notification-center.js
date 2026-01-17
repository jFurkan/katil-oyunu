// Notification Center Module
// Manages persistent notification center in the UI

export const NOTIFICATIONS = {
    notifications: [],
    unreadCount: 0,
    maxNotifications: 10,

    init() {
        // Load notifications from localStorage
        const saved = localStorage.getItem('notifications');
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);
                this.updateUI();
            } catch(e) {
                console.error('Bildirim yükleme hatası:', e);
            }
        }
    },

    add(title, message, type = 'info') {
        const notification = {
            id: Date.now(),
            title: title,
            message: message,
            type: type,
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            read: false
        };

        this.notifications.unshift(notification);

        // Keep max 10 notifications
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        this.save();
        this.updateUI();

        // Show notification center button if user is on team page
        const window.currentUser = window.window.currentUser;
        const isAdmin = window.isAdmin;
        if (window.currentUser && !window.isAdmin) {
            const btn = document.getElementById('notificationCenterBtn');
            if (btn) btn.style.display = 'flex';
        }
    },

    markAsRead(id) {
        const notif = this.notifications.find(n => n.id === id);
        if (notif && !notif.read) {
            notif.read = true;
            this.save();
            this.updateUI();
        }
    },

    clearAll() {
        if (confirm('Tüm bildirimleri temizlemek istediğinize emin misiniz?')) {
            this.notifications = [];
            this.save();
            this.updateUI();
        }
    },

    toggle() {
        const dropdown = document.getElementById('notificationCenterDropdown');
        if (!dropdown) return;

        dropdown.classList.toggle('active');

        // Mark all as read when opened
        if (dropdown.classList.contains('active')) {
            this.notifications.forEach(n => n.read = true);
            this.save();
            this.updateUI();
        }
    },

    save() {
        try {
            localStorage.setItem('notifications', JSON.stringify(this.notifications));
        } catch(e) {
            console.error('Bildirim kaydetme hatası:', e);
        }
    },

    updateUI() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;

        // Update badge
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // Update list
        const list = document.getElementById('notificationCenterList');
        if (!list) return;

        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-center-empty">
                    <div class="notification-center-empty-icon">
                        <i data-feather="bell-off" class="icon-xl" style="opacity: 0.3;"></i>
                    </div>
                    <div>Henüz bildirim yok</div>
                </div>
            `;
        } else {
            const escapeHtml = window.escapeHtml || (text => text);
            list.innerHTML = this.notifications.map(n => `
                <div class="notification-center-item ${!n.read ? 'unread' : ''}" onclick="NOTIFICATIONS.markAsRead(${n.id})">
                    <div class="notification-center-item-title">${escapeHtml(n.title)}</div>
                    <div class="notification-center-item-message">${escapeHtml(n.message)}</div>
                    <div class="notification-center-item-time">${n.time}</div>
                </div>
            `).join('');
        }

        // Re-initialize Feather icons after DOM update
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.NOTIFICATIONS = NOTIFICATIONS;
}
