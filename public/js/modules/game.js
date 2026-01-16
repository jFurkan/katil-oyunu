// Game Module - Main game logic, lobby, team management
// Handles routing, team creation/joining, game flow

export const GAME = {
    backToMain: function() {
        // UX İYİLEŞTİRME: Ana sayfaya dön - logout yap
        if (confirm('Ana sayfaya dönmek için çıkış yapılacak. Emin misiniz?')) {
            // Cleanup: Tüm timeout'ları temizle
            window.clearAllTimeouts();

            window.currentUser = null;
            window.currentTeamId = null;
            window.isAdmin = false;

            // Server'a logout isteği gönder (session'ı temizle)
            window.safeSocketEmit('logout-user', null, function() {
                // Ana sayfaya yönlendir (nickname giriş ekranı)
                window.router.navigate('/');
                window.updateCurrentUserDisplay();
                window.toast('Çıkış yapıldı.');
            });
        }
    },

    showAdminLoginForm: function() {
        // Admin şifre modalını göster
        document.getElementById('passModal').classList.add('show');
        document.getElementById('inpPass').value = '';
        document.getElementById('inpPass').focus();
    },

    showCreateForm: function() {
        // UX İYİLEŞTİRME: Lobby menüsünü gizle, sadece formu göster
        document.getElementById('lobbyMenu').style.display = 'none';
        document.getElementById('lobbyCredits').style.display = 'none';
        document.getElementById('createForm').style.display = 'block';
        document.getElementById('joinForm').style.display = 'none';
        if (window.CUSTOMIZE) {
            window.CUSTOMIZE.init(); // Avatar ve renk seçiciyi başlat
        }
        document.getElementById('inpNewTeam').focus();
    },

    hideCreateForm: function() {
        document.getElementById('createForm').style.display = 'none';
        // Lobby menüsünü geri göster
        document.getElementById('lobbyMenu').style.display = 'block';
        document.getElementById('lobbyCredits').style.display = 'block';
    },

    showJoinForm: function() {
        // UX İYİLEŞTİRME: Lobby menüsünü gizle, sadece takım listesini göster
        document.getElementById('lobbyMenu').style.display = 'none';
        document.getElementById('lobbyCredits').style.display = 'none';
        document.getElementById('joinForm').style.display = 'block';
        document.getElementById('createForm').style.display = 'none';
        // Takım listesini göster, şifre kısmını gizle
        document.getElementById('joinTeamList').style.display = 'block';
        document.getElementById('joinPasswordSection').style.display = 'none';
        // Takım listesini yükle
        window.safeSocketEmit('get-teams', null, function(response) {
            if (response && response.success) {
                window.teams = response.teams || [];
                window.renderJoinList();
            }
        });
    },

    hideJoinForm: function() {
        document.getElementById('joinForm').style.display = 'none';
        // Lobby menüsünü geri göster
        document.getElementById('lobbyMenu').style.display = 'block';
        document.getElementById('lobbyCredits').style.display = 'block';
    },

    backToTeamList: function() {
        // Şifre kısmından geri dön, takım listesini göster
        document.getElementById('joinTeamList').style.display = 'block';
        document.getElementById('joinPasswordSection').style.display = 'none';
    },

    selectJoin: function(el) {
        // Takım seçildiğinde
        const teamId = el.getAttribute('data-id');
        const teamName = el.getAttribute('data-name');
        window.selectedJoinId = teamId;
        document.getElementById('selectedTeamNameDisplay').textContent = teamName;
        // Şifre kısmını göster
        document.getElementById('joinTeamList').style.display = 'none';
        document.getElementById('joinPasswordSection').style.display = 'block';
        document.getElementById('inpJoinPass').value = '';
        document.getElementById('inpJoinPass').focus();
    },

    createTeam: function() {
        const teamName = document.getElementById('inpNewTeam').value.trim();
        const teamPassword = document.getElementById('inpNewPass').value.trim();

        if (!teamName) {
            window.toast('Lütfen takım adı girin!', true);
            return;
        }
        if (!teamPassword || teamPassword.length < 4) {
            window.toast('Şifre en az 4 karakter olmalı!', true);
            return;
        }

        // Avatar ve renk bilgilerini al
        let avatarUrl = null;
        let teamColor = '#3b82f6'; // Default color

        if (window.CUSTOMIZE) {
            teamColor = window.CUSTOMIZE.selectedColor || '#3b82f6';
        }

        // Avatar seçimi
        const selectedAvatar = document.querySelector('.avatar-option.selected');
        if (selectedAvatar) {
            avatarUrl = selectedAvatar.getAttribute('data-avatar');
        }

        window.safeSocketEmit('create-team', {
            teamName: teamName,
            teamPassword: teamPassword,
            avatarUrl: avatarUrl,
            teamColor: teamColor
        }, function(response) {
            if (response.success) {
                window.currentTeamId = response.teamId;
                window.toast('Takım oluşturuldu!');
                // Takım sayfasına yönlendir
                window.router.navigate('/team/' + response.teamId);
            } else {
                window.toast(response.error || 'Takım oluşturulamadı!', true);
            }
        });
    },

    joinTeam: function() {
        const teamPassword = document.getElementById('inpJoinPass').value.trim();

        if (!teamPassword) {
            window.toast('Lütfen şifre girin!', true);
            return;
        }

        if (!window.selectedJoinId) {
            window.toast('Lütfen bir takım seçin!', true);
            return;
        }

        window.safeSocketEmit('join-team', {
            teamId: window.selectedJoinId,
            teamPassword: teamPassword
        }, function(response) {
            if (response.success) {
                window.currentTeamId = window.selectedJoinId;
                window.toast('Takıma katıldınız!');
                // Takım sayfasına yönlendir
                window.router.navigate('/team/' + window.selectedJoinId);
            } else {
                window.toast(response.error || 'Takıma katılamadınız!', true);
            }
        });
    },

    addClue: function() {
        const clueText = document.getElementById('inpClue').value.trim();

        if (!clueText) {
            window.toast('Lütfen ipucu girin!', true);
            return;
        }

        window.safeSocketEmit('add-clue', {
            teamId: window.currentTeamId,
            clueText: clueText
        }, function(response) {
            if (response.success) {
                document.getElementById('inpClue').value = '';
                window.toast('İpucu eklendi!');
            } else {
                window.toast(response.error || 'İpucu eklenemedi!', true);
            }
        });
    },

    exitTeam: function() {
        if (!confirm('Takımdan çıkmak istediğinize emin misiniz?')) {
            return;
        }

        window.safeSocketEmit('exit-team', window.currentTeamId, function(response) {
            if (response.success) {
                window.currentTeamId = null;
                window.toast('Takımdan çıkıldı.');
                // Lobby'ye dön
                window.router.navigate('/lobby');
            } else {
                window.toast(response.error || 'Çıkış yapılamadı!', true);
            }
        });
    },

    showScoreboard: function() {
        window.router.navigate('/scoreboard');
    },

    showNotifications: function() {
        window.router.navigate('/notifications');
    },

    goLobby: function() {
        window.router.navigate('/lobby');
    },

    hidePassModal: function() {
        document.getElementById('passModal').classList.remove('show');
    },

    checkPass: function() {
        const password = document.getElementById('inpPass').value.trim();

        if (!password) {
            window.toast('Lütfen şifre girin!', true);
            return;
        }

        window.safeSocketEmit('admin-login', password, function(response) {
            if (response.success) {
                window.isAdmin = true;
                GAME.hidePassModal();
                window.toast('Admin girişi başarılı!');
                window.router.navigate('/admin');
            } else {
                window.toast(response.error || 'Hatalı şifre!', true);
            }
        });
    },

    exitAdmin: function() {
        if (!confirm('Admin panelinden çıkmak istediğinize emin misiniz?')) {
            return;
        }

        window.safeSocketEmit('admin-logout', null, function(response) {
            window.isAdmin = false;
            window.toast('Admin çıkışı yapıldı.');
            window.router.navigate('/lobby');
        });
    },

    showCreditDetail: function(creditId) {
        const credit = window.credits.find(c => c.id === creditId);
        if (!credit) return;

        document.getElementById('creditDetailName').textContent = credit.name;

        const contentEl = document.getElementById('creditDetailContent');
        if (credit.content && credit.content.trim() !== '') {
            contentEl.textContent = credit.content;
        } else {
            contentEl.innerHTML = '<div style="color:#666; text-align:center; padding:40px; font-style:italic;">Bu kişi hakkında henüz bilgi eklenmemiş.</div>';
        }

        window.showPage('pgCreditDetail');
    },

    closeFinalReport: function() {
        document.getElementById('finalReportModal').style.display = 'none';
    },

    resetGame: function() {
        if (confirm('TÜM veriler silinecek. Emin misiniz?')) {
            window.safeSocketEmit('reset-game', null, function(res) {
                if (res.success) {
                    window.toast('Oyun sıfırlandı');
                } else {
                    window.toast(res.error || 'Sıfırlama başarısız!', true);
                }
            });
        }
    }
};

// Export to window for onclick handlers
window.GAME = GAME;

console.log('✅ GAME module loaded');
