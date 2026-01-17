// Navigation Module
// Handles page navigation and history management

const pageHistory = [];

export function showPage(id, addToHistory = true) {
    // Find current active page
    const currentPage = document.querySelector('.page.active');
    const currentPageId = currentPage ? currentPage.id : null;

    // If navigating to same page, don't add to history
    if (currentPageId === id) {
        return;
    }

    // Add to history (for back buttons)
    if (addToHistory && currentPageId) {
        pageHistory.push(currentPageId);
        // Keep max 10 pages (prevent memory overflow)
        if (pageHistory.length > 10) {
            pageHistory.shift();
        }
    }

    // Switch pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(id);
    if (targetPage) {
        targetPage.classList.add('active');

        // LAST PAGE TRACKING: Save current path for F5 redirect
        try {
            const currentPath = window.location.pathname;
            if (currentPath && currentPath !== '/') {
                sessionStorage.setItem('lastPage', currentPath);
            }
        } catch (e) {
            // Ignore sessionStorage errors
        }
    }
}

export function goBack() {
    if (pageHistory.length > 0) {
        const previousPage = pageHistory.pop();
        showPage(previousPage, false); // Don't add to history
    } else {
        // No history, go to lobby or nickname page
        const currentUser = window.currentUser;
        if (currentUser) {
            showPage('pgLobby', false);
        } else {
            showPage('pgNickname', false);
        }
    }
}

export function updateCurrentUserDisplay() {
    const userInfo = document.getElementById('currentUserInfo');
    const userNick = document.getElementById('currentUserNick');
    const currentUser = window.currentUser;

    if (currentUser && currentUser.nickname) {
        if (userNick) userNick.textContent = currentUser.nickname;
        if (userInfo) userInfo.style.display = 'block';
    } else {
        if (userInfo) userInfo.style.display = 'none';
    }
}

export function clearPageHistory() {
    pageHistory.length = 0;
}

// Make functions globally available
if (typeof window !== 'undefined') {
    window.showPage = showPage;
    window.goBack = goBack;
    window.updateCurrentUserDisplay = updateCurrentUserDisplay;
}
