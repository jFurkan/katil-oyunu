// Poke/Nudge System Module
// Allows teams to "poke" other teams

// Get global functions
const toast = window.toast;
const escapeHtml = window.escapeHtml;

export const POKE = {
    lastPokeTime: {},

    showPokeModal() {
        const currentUser = window.currentUser;
        const currentTeamId = window.currentTeamId;
        const socket = window.socket;
        const toast = window.toast;
        const htmlEscape = window.htmlEscape;

        if (!currentUser || !currentTeamId) {
            toast('Dürtme özelliğini kullanmak için bir takıma giriş yapmalısınız!', true);
            return;
        }

        // Load team list
        window.safeSocketEmit('get-teams', null, (response) => {
            if (!response || !response.success) {
                toast('Takımlar yüklenemedi!', true);
                return;
            }

            const teams = response.teams || [];
            let html = '';
            const now = Date.now();

            teams.forEach(team => {
                // Don't show own team
                if (team.id === currentTeamId) return;

                // Rate limiting check
                const lastPoke = this.lastPokeTime[team.id] || 0;
                const timeSinceLastPoke = now - lastPoke;
                const canPoke = timeSinceLastPoke > 60000; // 60 seconds = 1 minute
                const remainingSeconds = canPoke ? 0 : Math.ceil((60000 - timeSinceLastPoke) / 1000);

                const disabledClass = canPoke ? '' : 'disabled';
                const disabledAttr = canPoke ? '' : 'disabled';
                const buttonText = canPoke ? 'Dürt 👋' : `Bekleyin (${remainingSeconds}s)`;

                html += `
                <div class="poke-team-item ${disabledClass}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 12px; height: 12px; background: ${team.color}; border-radius: 50%; box-shadow: 0 0 10px ${team.color};"></div>
                        <div>
                            <div style="color: #fff; font-size: 16px; font-weight: 600;">${htmlEscape(team.name)}</div>
                            <div style="color: #666; font-size: 12px;">${team.score} puan</div>
                        </div>
                    </div>
                    <button
                        class="btn btn-primary"
                        style="padding: 8px 16px; margin: 0; font-size: 13px; ${canPoke ? '' : 'opacity: 0.5; cursor: not-allowed;'}"
                        onclick="POKE.pokeTeam('${team.id}', '${htmlEscape(team.name)}')"
                        ${disabledAttr}
                    >
                        ${buttonText}
                    </button>
                </div>`;
            });

            if (html === '') {
                html = '<div style="text-align: center; padding: 40px; color: #666;"><div style="font-size: 32px; margin-bottom: 10px;">🤷</div><div>Dürtebileceğiniz başka takım yok</div></div>';
            }

            document.getElementById('pokeTeamList').innerHTML = html;
            document.getElementById('pokeSelectOverlay').classList.add('active');
        });
    },

    hidePokeModal() {
        const overlay = document.getElementById('pokeSelectOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    },

    pokeTeam(targetTeamId, targetTeamName) {
        const socket = window.socket;
        const toast = window.toast;
        const now = Date.now();
        const lastPoke = this.lastPokeTime[targetTeamId] || 0;
        const timeSinceLastPoke = now - lastPoke;

        // Client-side rate limiting
        if (timeSinceLastPoke < 60000) {
            const remainingSeconds = Math.ceil((60000 - timeSinceLastPoke) / 1000);
            toast(`Bu takımı ${remainingSeconds} saniye sonra tekrar dürtebilirsiniz!`, true);
            return;
        }

        // Send poke request to server
        window.safeSocketEmit('poke-team', targetTeamId, (response) => {
            if (response && response.success) {
                // Save last poke time
                this.lastPokeTime[targetTeamId] = now;

                toast(`👋 ${targetTeamName} takımını dürttünüz!`, false);
                this.hidePokeModal();
            } else {
                toast(response.error || 'Dürtme gönderilemedi!', true);
            }
        });
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.POKE = POKE;
}
