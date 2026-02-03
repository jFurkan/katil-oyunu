// Chat Module
// Team chat functionality

// Get global functions

// SECURITY: Validate profile photo URLs to prevent XSS
function isValidProfilePhotoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // Only allow local profile photo paths
    return /^\/uploads\/profiles\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

export const CHAT = {

    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    selectedTargetTeamId: null,
    selectedTargetTeamName: null,
    availableTeams: [],

    // TakÄ±m dropdown'Ä±nÄ± aÃ§/kapat
    toggleTeamDropdown: function () {
        var dropdown = document.getElementById('teamDropdown');
        var button = document.getElementById('btnTeamSelector');

        if (dropdown.style.display === 'none') {
            CHAT.loadAvailableTeams();

            // Position dropdown relative to button (fixed position)
            var rect = button.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.minWidth = rect.width + 'px';

            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    },

    // Mevcut takÄ±mlarÄ± yÃ¼kle
    loadAvailableTeams: function () {
        var dropdown = document.getElementById('teamDropdown');
        if (!dropdown) return;

        var html = '';

        // "Tüm Takımlar" seçeneği
        html += `
                        <div onclick="CHAT.selectTeam(null, 'Tüm Takımlar')" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a4d4d; color: ${!CHAT.selectedTargetTeamId ? '#4dd4d4' : '#999'}; font-weight: ${!CHAT.selectedTargetTeamId ? '700' : '400'}; transition: background 0.2s;" onmouseover="this.style.background='#1a4d4d'" onmouseout="this.style.background='transparent'">
                            📢 Tüm Takımlar
                        </div>`;

        // Admin seçeneği
        var isAdminSelected = CHAT.selectedTargetTeamId === 'admin';
        html += `
                        <div onclick="CHAT.selectTeam('admin', 'Admin')" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a4d4d; color: ${isAdminSelected ? '#fbbf24' : '#f59e0b'}; font-weight: ${isAdminSelected ? '700' : '600'}; transition: background 0.2s;" onmouseover="this.style.background='#1a4d4d'" onmouseout="this.style.background='transparent'">
                            👑 Admin (Özel Mesaj)
                        </div>`;

        // Diğer takımlar
        CHAT.availableTeams.forEach(function (team) {
            var isSelected = CHAT.selectedTargetTeamId === team.id;
            html += `
                            <div onclick="CHAT.selectTeam('${team.id}', '${htmlEscape(team.name)}')" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a4d4d; color: ${isSelected ? '#4dd4d4' : '#ccc'}; font-weight: ${isSelected ? '700' : '400'}; transition: background 0.2s;" onmouseover="this.style.background='#1a4d4d'" onmouseout="this.style.background='transparent'">
                                🔒 ${htmlEscape(team.name)}
                            </div>`;
        });

        dropdown.innerHTML = html;
    },

    // Takım seç
    selectTeam: function (teamId, teamName) {
        CHAT.selectedTargetTeamId = teamId;
        CHAT.selectedTargetTeamName = teamName;

        var textEl = document.getElementById('selectedTeamText');
        if (textEl) {
            if (teamId === 'admin') {
                textEl.textContent = '👑 ' + teamName;
            } else if (teamId) {
                textEl.textContent = '🔒 ' + teamName;
            } else {
                textEl.textContent = '📢 Tüm Takımlar';
            }
        }

        // Dropdown'ı kapat
        var dropdown = document.getElementById('teamDropdown');
        if (dropdown) dropdown.style.display = 'none';

        // Mesajları filtrele ve yeniden yükle
        CHAT.loadMessages(1);
    },

    // Mevcut takımları güncelle
    updateAvailableTeams: function (teams) {
        // Kendi takımını hariç tut
        if (window.currentUser && window.currentUser.teamId) {
            CHAT.availableTeams = teams.filter(function (team) {
                return team.id !== window.currentUser.teamId;
            });
        } else {
            CHAT.availableTeams = teams;
        }
    },

    // Mesaj gönder
    sendMessage: function () {
        if (!window.socketConnected) {
            window.toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        var input = document.getElementById('inpTeamChat');
        // NULL SAFETY: Check if input element exists
        if (!input) {
            console.error('Chat input element not found');
            return;
        }
        var message = input.value.trim();

        if (!message) {
            window.toast('Mesaj boÅŸ olamaz!', true);
            return;
        }

        var data = {
            message: message,
            targetTeamId: CHAT.selectedTargetTeamId
        };

        window.safeSocketEmit('send-team-message', data, function (res) {
            if (res && res.success) {
                input.value = '';
                // Mesaj otomatik olarak 'new-team-message' event'i ile gelecek
            } else {
                window.toast(res.error, true);
            }
        });
    },

    // Mesajları yükle
    loadMessages: function (page) {
        if (CHAT.isLoading) return;
        CHAT.isLoading = true;

        window.safeSocketEmit('load-team-messages', {
            page: page,
            filterTeamId: CHAT.selectedTargetTeamId  // Filtre ekle
        }, function (res) {
            CHAT.isLoading = false;
            if (res && res.success) {
                CHAT.currentPage = res.pagination.currentPage;
                CHAT.totalPages = res.pagination.totalPages;
                CHAT.renderMessages(res.messages);
                CHAT.updatePagination(res.pagination);
            } else {
                window.toast(res.error, true);
            }
        });
    },

    // Önceki sayfa
    loadPreviousPage: function () {
        if (CHAT.currentPage > 1) {
            CHAT.loadMessages(CHAT.currentPage - 1);
        }
    },

    // Sonraki sayfa
    loadNextPage: function () {
        if (CHAT.currentPage < CHAT.totalPages) {
            CHAT.loadMessages(CHAT.currentPage + 1);
        }
    },

    // MesajlarÄ± render et
    renderMessages: function (messages) {
        var container = document.getElementById('teamChatMessages');
        var countEl = document.getElementById('teamChatCount');

        if (!container) return;

        // Sayacı güncelle
        if (countEl) {
            countEl.textContent = messages.length;
        }

        if (messages.length === 0) {
            container.innerHTML = `
                            <div style="text-align: center; padding: 60px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">💬</div>
                                <div style="font-size: 14px;">Henüz mesaj yok</div>
                                <div style="font-size: 12px; color: #444; margin-top: 5px;">İlk mesajı sen gönder!</div>
                            </div>`;
            return;
        }

        // Mesajları WhatsApp sıralamasına göre düzenle (eski → yeni)
        var sortedMessages = messages.slice().reverse();

        var html = '';
        sortedMessages.forEach(function (msg) {
            var time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            var isOwnMessage = window.currentUser && msg.user_id === window.currentUser.userId;

            // Hedef takÄ±m etiketi
            var targetLabel = '';
            if (msg.target_team_id === 'admin') {
                targetLabel = `<span style="color: #fbbf24; font-size: 10px; background: rgba(251,191,36,0.2); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.4);">👑 → Admin (Özel)</span>`;
            } else if (msg.target_team_name) {
                targetLabel = `<span style="color: #d4af37; font-size: 10px; background: rgba(212,175,55,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">🔒 → ${htmlEscape(msg.target_team_name)}</span>`;
            } else {
                targetLabel = `<span style="color: #4dd4d4; font-size: 10px; background: rgba(77,212,212,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(77,212,212,0.3);">📢 Tüm Takımlar</span>`;
            }

            // TakÄ±m rengi badge
            var teamColor = msg.team_color || '#3b82f6';
            var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(msg.team_name)}</span>`;

            // Profil fotoğrafı avatar - SECURITY: validate URL before using
            var validPhotoUrl = isValidProfilePhotoUrl(msg.profile_photo_url) ? msg.profile_photo_url : null;
            var avatar = validPhotoUrl ?
                `<img src="${validPhotoUrl}" alt="${htmlEscape(msg.nickname)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid ${isOwnMessage ? '#4dd4d4' : '#ffa500'};">` :
                `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${isOwnMessage ? '#0a4040' : '#333'}; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid ${isOwnMessage ? '#4dd4d4' : '#ffa500'};">💤</div>`;

            // WhatsApp tarzı görünüm
            if (isOwnMessage) {
                // Kendi mesajÄ±m - SAÄDA
                html += `
                            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px; align-items: flex-end; gap: 8px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-end;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                        ${targetLabel}
                                        ${teamBadge}
                                        <span style="color: #4dd4d4; font-weight: 700; font-size: 13px;">${htmlEscape(msg.nickname)}</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #0d5858, #0a4040); border: 1px solid #1a7070; border-radius: 12px 12px 2px 12px; padding: 10px 14px; color: #fff; font-size: 14px; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3); position: relative;">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                                ${avatar}
                            </div>`;
            } else {
                // DiÄŸer kiÅŸinin mesajÄ± - SOLDA
                html += `
                            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px; align-items: flex-end; gap: 8px;">
                                ${avatar}
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-start;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span style="color: #ffa500; font-weight: 700; font-size: 13px;">${htmlEscape(msg.nickname)}</span>
                                        ${teamBadge}
                                        ${targetLabel}
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                    </div>
                                    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px 12px 12px 2px; padding: 10px 14px; color: #fff; font-size: 14px; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                            </div>`;
            }
        });

        container.innerHTML = html;

        // En alta scroll
        container.scrollTop = container.scrollHeight;
    },

    // Pagination kontrollerini güncelle
    updatePagination: function (pagination) {
        var paginationDiv = document.getElementById('teamChatPagination');
        var prevBtn = document.getElementById('btnChatPrevPage');
        var nextBtn = document.getElementById('btnChatNextPage');
        var currentPageEl = document.getElementById('chatCurrentPage');
        var totalPagesEl = document.getElementById('chatTotalPages');
        var totalMessagesEl = document.getElementById('chatTotalMessages');

        if (!paginationDiv) return;

        // Toplam mesaj sayısını güncelle
        if (totalMessagesEl) {
            totalMessagesEl.textContent = pagination.totalMessages;
            document.getElementById('teamChatCount').textContent = pagination.totalMessages;
        }

        // Pagination varsa göster
        if (pagination.totalPages > 1) {
            paginationDiv.style.display = 'block';

            if (currentPageEl) currentPageEl.textContent = pagination.currentPage;
            if (totalPagesEl) totalPagesEl.textContent = pagination.totalPages;

            // Önceki buton
            if (prevBtn) {
                if (pagination.currentPage > 1) {
                    prevBtn.disabled = false;
                    prevBtn.style.opacity = '1';
                } else {
                    prevBtn.disabled = true;
                    prevBtn.style.opacity = '0.5';
                }
            }

            // Sonraki buton
            if (nextBtn) {
                if (pagination.hasMore) {
                    nextBtn.disabled = false;
                    nextBtn.style.opacity = '1';
                } else {
                    nextBtn.disabled = true;
                    nextBtn.style.opacity = '0.5';
                }
            }
        } else {
            paginationDiv.style.display = 'none';
        }
    },

    // Yeni mesaj geldiÄŸinde
    onNewMessage: function (message) {
        // EÄŸer son sayfadaysak, mesajÄ± ekle
        if (CHAT.currentPage === CHAT.totalPages || CHAT.totalPages === 0) {
            var container = document.getElementById('teamChatMessages');
            if (!container) return;

            // BoÅŸ mesaj varsa temizle
            if (container.querySelector('[style*="Henüz mesaj yok"]')) {
                container.innerHTML = '';
            }

            var time = new Date(message.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            var isOwnMessage = window.currentUser && message.user_id === window.currentUser.userId;

            // Hedef takÄ±m etiketi
            var targetLabel = '';
            if (message.target_team_name) {
                targetLabel = `<span style="color: #d4af37; font-size: 10px; background: rgba(212,175,55,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">ğŸ”’ â†’ ${htmlEscape(message.target_team_name)}</span>`;
            } else {
                targetLabel = `<span style="color: #4dd4d4; font-size: 10px; background: rgba(77,212,212,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(77,212,212,0.3);">📢 Tüm Takımlar</span>`;
            }

            // TakÄ±m badge
            var teamColor = message.team_color || '#3b82f6';
            var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(message.team_name)}</span>`;

            // Profil fotoÄŸrafÄ± avatar - SECURITY: validate URL before using
            var validPhotoUrl = isValidProfilePhotoUrl(message.profile_photo_url) ? message.profile_photo_url : null;
            var avatar = validPhotoUrl ?
                `<img src="${validPhotoUrl}" alt="${htmlEscape(message.nickname)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid ${isOwnMessage ? '#4dd4d4' : '#ffa500'};">` :
                `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${isOwnMessage ? '#0a4040' : '#333'}; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid ${isOwnMessage ? '#4dd4d4' : '#ffa500'};">💤</div>`;

            var html = '';
            if (isOwnMessage) {
                html = `
                            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px; align-items: flex-end; gap: 8px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-end;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                        ${targetLabel}
                                        ${teamBadge}
                                        <span style="color: #4dd4d4; font-weight: 700; font-size: 13px;">${htmlEscape(message.nickname)}</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #0d5858, #0a4040); border: 1px solid #1a7070; border-radius: 12px 12px 2px 12px; padding: 10px 14px; color: #fff; font-size: 14px; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(message.message)}
                                    </div>
                                </div>
                                ${avatar}
                            </div>`;
            } else {
                html = `
                            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px; align-items: flex-end; gap: 8px;">
                                ${avatar}
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-start;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span style="color: #ffa500; font-weight: 700; font-size: 13px;">${htmlEscape(message.nickname)}</span>
                                        ${teamBadge}
                                        ${targetLabel}
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                    </div>
                                    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px 12px 12px 2px; padding: 10px 14px; color: #fff; font-size: 14px; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(message.message)}
                                    </div>
                                </div>
                            </div>`;
            }

            container.insertAdjacentHTML('beforeend', html);
            container.scrollTop = container.scrollHeight;

            // Sayacı güncelle
            var countEl = document.getElementById('teamChatCount');
            if (countEl) {
                var currentCount = parseInt(countEl.textContent) || 0;
                countEl.textContent = currentCount + 1;
            }
        }
    },

    // FINAL RAPORU GÖSTER
    showFinalReport: function (report) {
        var modal = document.getElementById('finalReportModal');
        var content = document.getElementById('finalReportContent');

        var html = '';

        // Ä°statistikler
        html += '<div style="background:#111; padding:20px; border-radius:8px; margin-bottom:20px; text-align:center;">';
        html += '<h3 style="color:var(--gold); margin-bottom:15px;">📊 Oyun İstatistikleri</h3>';
        html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px;">';
        html += '<div><div style="font-size:32px; color:var(--gold);">' + report.stats.durationMinutes + '</div><div style="color:#888; font-size:13px;">Dakika</div></div>';
        html += '<div><div style="font-size:32px; color:#4CAF50;">' + report.stats.totalTeams + '</div><div style="color:#888; font-size:13px;">TakÄ±m</div></div>';
        html += '<div><div style="font-size:32px; color:#2196F3;">' + report.stats.totalClues + '</div><div style="color:#888; font-size:13px;">Ä°pucu</div></div>';
        html += '<div><div style="font-size:32px; color:#FF9800;">' + report.stats.totalMessages + '</div><div style="color:#888; font-size:13px;">Mesaj</div></div>';
        html += '</div></div>';

        // TakÄ±m SÄ±ralamasÄ±
        html += '<div style="background:#111; padding:20px; border-radius:8px; margin-bottom:20px;">';
        html += '<h3 style="color:var(--gold); margin-bottom:15px;">ğŸ… TakÄ±m SÄ±ralamasÄ±</h3>';
        report.teams.forEach(function (team, index) {
            var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''));
            html += '<div style="background:#0a0a0a; padding:15px; margin-bottom:10px; border-radius:6px; display:flex; align-items:center; gap:15px; border-left:4px solid ' + team.color + ';">';
            html += '<div style="font-size:32px;">' + medal + '</div>';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:18px; color:#fff; font-weight:600;">' + team.name + '</div>';
            html += '<div style="color:#888; font-size:13px;">' + team.clueCount + ' ipucu â€¢ ' + team.messageCount + ' mesaj</div>';
            html += '</div>';
            html += '<div style="font-size:24px; color:var(--gold); font-weight:700;">' + team.score + ' puan</div>';
            html += '</div>';
        });
        html += '</div>';

        // Rozetler
        if (report.badges && report.badges.length > 0) {
            html += '<div style="background:#111; padding:20px; border-radius:8px; margin-bottom:20px;">';
            html += '<h3 style="color:var(--gold); margin-bottom:15px;">ğŸ–ï¸ Rozetler</h3>';
            report.badges.forEach(function (badge) {
                html += '<div style="background:#0a0a0a; padding:12px; margin-bottom:8px; border-radius:6px; display:flex; align-items:center; gap:12px;">';
                html += '<div style="font-size:28px;">' + badge.badge.split(' ')[0] + '</div>';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:16px; color:#fff; font-weight:600;">' + badge.badge + '</div>';
                html += '<div style="color:#888; font-size:13px;">' + badge.teamName + ' - ' + badge.reason + '</div>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        }

        // Timeline
        if (report.timeline && report.timeline.length > 0) {
            html += '<div style="background:#111; padding:20px; border-radius:8px;">';
            html += '<h3 style="color:var(--gold); margin-bottom:15px;">â±ï¸ Oyun Kronolojisi</h3>';
            html += '<div style="max-height:300px; overflow-y:auto;">';
            report.timeline.forEach(function (event) {
                var eventTime = new Date(event.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                var eventIcon = event.type === 'clue_added' ? 'ğŸ”' : (event.type === 'score_changed' ? 'â­' : 'ğŸ“Œ');
                html += '<div style="background:#0a0a0a; padding:10px; margin-bottom:6px; border-radius:4px; font-size:13px; display:flex; gap:10px; align-items:center;">';
                html += '<div style="color:#666; font-size:11px; min-width:45px;">' + eventTime + '</div>';
                html += '<div style="font-size:16px;">' + eventIcon + '</div>';
                html += '<div style="color:#ccc;"><strong style="color:#fff;">' + (event.teamName || 'Admin') + '</strong>: ' + event.description + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        content.innerHTML = html;
        modal.style.display = 'flex';
    },

    // FINAL RAPORU KAPAT
    closeFinalReport: function () {
        document.getElementById('finalReportModal').style.display = 'none';
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.CHAT = CHAT;
}
