// Main Application Entry Point
// Imports and initializes all modules

import { CONFIG } from './modules/config.js';
import { THEME } from './modules/theme.js';
import { toast, formatTime, formatDate, escapeHtml, htmlEscape, trackTimeout, clearAllTimeouts } from './modules/utils.js';
import { showPage, goBack, updateCurrentUserDisplay, clearPageHistory } from './modules/navigation.js';
import { NOTIFICATIONS } from './modules/notification-center.js';
import { LEADERBOARD } from './modules/leaderboard.js';
import { NOTIFICATION } from './modules/notification-display.js';
import { POKE } from './modules/poke.js';
import { CHARACTER } from './modules/character.js';

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing application modules...');

    // Initialize theme system
    THEME.init();
    console.log('✅ Theme system initialized');

    // Initialize notification center
    NOTIFICATIONS.init();
    console.log('✅ Notification center initialized');

    // Initialize leaderboard
    LEADERBOARD.init();
    console.log('✅ Leaderboard initialized');

    // Initialize notification display
    NOTIFICATION.init();
    console.log('✅ Notification display initialized');

    // Initialize Feather Icons
    if (typeof feather !== 'undefined') {
        feather.replace();
        console.log('✅ Feather icons initialized');
    }

    console.log('🎉 All modules initialized successfully!');
});

// Export for global access if needed
export {
    CONFIG,
    THEME,
    toast,
    formatTime,
    formatDate,
    escapeHtml,
    htmlEscape,
    showPage,
    goBack,
    updateCurrentUserDisplay,
    NOTIFICATIONS,
    LEADERBOARD,
    NOTIFICATION
};
