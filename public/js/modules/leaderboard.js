// Live Leaderboard Module
// Manages the live leaderboard widget

export const LEADERBOARD = {
    previousScores: {},
    previousLeader: null,
    visible: false,
    collapsed: true, // Mobile starts collapsed

    init() {
        // Load visibility state from localStorage
        const saved = localStorage.getItem('leaderboard_visible');
        this.visible = saved === null ? true : saved === 'true'; // Default: visible
        this.updateVisibility();

        // Init mobile toggle
        this.initMobileToggle();

        // Start collapsed on mobile
        if (window.innerWidth <= 768) {
            const board = document.getElementById('liveLeaderboard');
            if (board) {
                board.classList.add('collapsed');
                this.collapsed = true;
            }
        }
    },

    initMobileToggle() {
        const header = document.querySelector('.live-leaderboard-header');
        if (!header) return;

        header.addEventListener('click', (e) => {
            // Only work on mobile
            if (window.innerWidth <= 768) {
                // If X button clicked, run toggle() (hide)
                if (e.target.closest('.live-leaderboard-toggle')) {
                    return; // Let X button run its own function
                }

                // If header clicked, collapse/expand
                this.toggleCollapse();
            }
        });
    },

    toggleCollapse() {
        const board = document.getElementById('liveLeaderboard');
        if (!board) return;

        this.collapsed = !this.collapsed;

        if (this.collapsed) {
            board.classList.add('collapsed');
        } else {
            board.classList.remove('collapsed');
        }
    },

    toggle() {
        this.visible = !this.visible;
        localStorage.setItem('leaderboard_visible', this.visible);
        this.updateVisibility();
    },

    updateVisibility() {
        const board = document.getElementById('liveLeaderboard');
        if (!board) return;

        if (this.visible) {
            board.classList.remove('hidden');
        } else {
            board.classList.add('hidden');
        }
    },

    update(teams) {
        if (!teams || teams.length === 0) return;

        // Sort by score (use slice to avoid mutating original array)
        const sortedTeams = teams.slice().sort((a, b) => b.score - a.score);

        const list = document.getElementById('liveLeaderboardList');
        if (!list) return;

        // SECURITY: Use safe escaping or throw error if not available
        const escapeHtml = window.escapeHtml || function(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        list.innerHTML = sortedTeams.map((team, index) => {
            const rank = index + 1;
            const prevScore = this.previousScores[team.id] || team.score;
            const scoreChange = team.score - prevScore;

            let changeIcon = '';
            let changeClass = '';
            if (scoreChange > 0) {
                changeIcon = '<i data-feather="trending-up" class="icon-xs"></i>';
                changeClass = 'up';
            } else if (scoreChange < 0) {
                changeIcon = '<i data-feather="trending-down" class="icon-xs"></i>';
                changeClass = 'down';
            } else {
                changeIcon = '<i data-feather="minus" class="icon-xs"></i>';
                changeClass = 'same';
            }

            // Save current scores (for next comparison)
            this.previousScores[team.id] = team.score;

            // Rank icon/emoji
            let rankDisplay = rank;
            if (rank === 1) rankDisplay = '<i data-feather="award" class="icon-md" style="color: var(--gold);"></i>';
            else if (rank === 2) rankDisplay = '<i data-feather="star" class="icon-md" style="color: #C0C0C0;"></i>';
            else if (rank === 3) rankDisplay = '<i data-feather="star" class="icon-md" style="color: #cd7f32;"></i>';

            return `
                <div class="live-leaderboard-item rank-${rank}">
                    <div class="live-leaderboard-rank">${rankDisplay}</div>
                    <div class="live-leaderboard-info">
                        <div class="live-leaderboard-name">${escapeHtml(team.name)}</div>
                        <div class="live-leaderboard-score">
                            ${team.score}
                            <span class="live-leaderboard-change ${changeClass}">${changeIcon}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Re-initialize Feather icons after DOM update
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // Show if user is on team page and game started
        const currentUser = window.currentUser;
        const isAdmin = window.isAdmin;
        const gameState = window.gameState;

        if (window.currentUser && !window.isAdmin && window.gameState && window.gameState.started) {
            const board = document.getElementById('liveLeaderboard');
            if (board) {
                board.classList.remove('hidden');
                if (!this.visible) {
                    this.toggle(); // Make visible if first time shown
                }
            }
        }
    },

    checkRankChange(teams) {
        // Check for leadership change
        if (teams && teams.length > 0) {
            const sortedTeams = teams.sort((a, b) => b.score - a.score);
            const currentLeader = sortedTeams[0];

            if (this.previousLeader && this.previousLeader.id !== currentLeader.id) {
                // Leader changed!
                if (window.NOTIFICATIONS) {
                    window.NOTIFICATIONS.add(
                        '👑 Liderlik Değişti!',
                        `${currentLeader.name} şimdi 1. sırada! (${currentLeader.score} puan)`,
                        'leaderboard'
                    );
                }

                // Special notification if user's team became leader
                const currentUser = window.currentUser;
                const toast = window.toast;
                if (window.currentUser && window.currentUser.team_id === currentLeader.id && toast) {
                    toast('🎉 Tebrikler! Takımınız 1. sıraya yükseldi!');
                }
            }

            this.previousLeader = currentLeader;
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.LEADERBOARD = LEADERBOARD;
}
