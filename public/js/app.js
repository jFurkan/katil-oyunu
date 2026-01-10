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
import { MURDERBOARD } from './modules/murderboard.js';
import { CUSTOMIZE } from './modules/customize.js';
import { ADMIN } from './modules/admin.js';
import { CHAT } from './modules/chat.js';
import { USER } from './modules/user.js';
import { IP_SECTION, IP_LOGS, IP_USERS, PHOTO_ADMIN } from './modules/ip-management.js';
import { ADMIN_BOARD } from './modules/admin-board.js';
import { GAME_RESET } from './modules/game-reset.js';

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
    NOTIFICATION,
    POKE,
    CHARACTER,
    MURDERBOARD,
    CUSTOMIZE,
    ADMIN,
    CHAT,
    USER,
    IP_SECTION,
    IP_LOGS,
    IP_USERS,
    PHOTO_ADMIN,
    ADMIN_BOARD,
    GAME_RESET
};
