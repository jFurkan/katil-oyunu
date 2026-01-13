// Utility Functions Module
// Global helper functions used throughout the application

// Time formatting
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// Date formatting
export function formatDate(date) {
    if (!date) return '---';
    return new Date(date).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// HTML escaping for XSS protection
export function htmlEscape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// HTML escape with map (alternative method)
export function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Toast notification display
export function toast(msg, err) {
    const t = document.getElementById('toast');
    if (!t) {
        console.error('Toast element bulunamadı!');
        return;
    }
    t.textContent = msg;
    t.className = err ? 'show err' : 'show';
    setTimeout(() => { t.className = ''; }, 2500);
}

// Timeout tracking for cleanup
const activeTimeouts = [];

export function trackTimeout(timeoutId) {
    activeTimeouts.push(timeoutId);
}

export function clearAllTimeouts() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts.length = 0;
}

// Make key functions globally available for inline handlers
if (typeof window !== 'undefined') {
    window.toast = toast;
    window.formatTime = formatTime;
    window.formatDate = formatDate;
    window.escapeHtml = escapeHtml;
    window.htmlEscape = htmlEscape;
    window.trackTimeout = trackTimeout;
    window.clearAllTimeouts = clearAllTimeouts;
}
