// Notification Display Module
// Manages temporary notification popups (toast-style)

export const NOTIFICATION = {
    container: null,
    nextId: 1,

    init() {
        this.container = document.getElementById('notificationContainer');
    },

    show(title, message, time) {
        if (!this.container) this.init();

        const id = 'notif-' + this.nextId++;
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.id = id;

        // Security: XSS protection - use DOM API instead of innerHTML
        const header = document.createElement('div');
        header.className = 'notification-header';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'notification-title';

        const icon = document.createElement('span');
        icon.textContent = '🎯';
        titleDiv.appendChild(icon);

        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        titleDiv.appendChild(titleSpan);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close(id));

        header.appendChild(titleDiv);
        header.appendChild(closeBtn);
        notif.appendChild(header);

        const body = document.createElement('div');
        body.className = 'notification-body';
        body.textContent = message;
        notif.appendChild(body);

        if (time) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'notification-time';
            timeDiv.textContent = time;
            notif.appendChild(timeDiv);
        }

        this.container.appendChild(notif);

        // Auto-close after 8 seconds
        setTimeout(() => {
            this.close(id);
        }, 8000);

        return id;
    },

    close(id) {
        const notif = document.getElementById(id);
        if (notif) {
            notif.classList.add('closing');
            setTimeout(() => {
                notif.remove();
            }, 300);
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.NOTIFICATION = NOTIFICATION;
}
