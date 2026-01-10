// Configuration Module
// Global configuration and constants

export const CONFIG = {
    // Socket.IO configuration
    socketUrl: window.location.origin,

    // UI configuration
    toastDuration: 2500,
    notificationDuration: 8000,
    maxNotifications: 10,
    maxPageHistory: 10,

    // Game configuration
    minNicknameLength: 2,
    maxNicknameLength: 20,
    scoreChangeConfirmThreshold: 50,

    // Mobile breakpoint
    mobileBreakpoint: 768,

    // Timeouts
    connectionTimeout: 5000,
    processingDelay: 300,

    // Feature flags
    enableProfilePhotos: true,
    enableInterTeamChat: true,
    enableNotificationCenter: true,
    enableLiveLeaderboard: true,

    // API endpoints
    endpoints: {
        health: '/health',
        profilePhoto: '/profile-photo'
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
