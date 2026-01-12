// Admin Panel Module
// Admin controls for game management

export const ADMIN = {

                currentSection: 'game',

                showSection: function(section) {
                    // Tüm bölümleri gizle
                    document.querySelectorAll('.admin-section').forEach(function(el) {
                        el.style.display = 'none';
                    });

                    // Seçili bölümü göster
                    document.getElementById('adminSection' + section.charAt(0).toUpperCase() + section.slice(1)).style.display = 'block';

                    // Menü butonlarını güncelle
                    var buttons = document.querySelectorAll('#pgAdmin > div:nth-child(2) button');
                    buttons.forEach(function(btn) {
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn');
                    });

                    // Seçili butonu vurgula
                    if (section === 'game') buttons[0].classList.add('btn-primary');
                    else if (section === 'characters') buttons[1].classList.add('btn-primary');
                    else if (section === 'users') buttons[2].classList.add('btn-primary');
                    else if (section === 'scoring') buttons[3].classList.add('btn-primary');
                    else if (section === 'notifications') buttons[4].classList.add('btn-primary');
                    else if (section === 'chat') buttons[5].classList.add('btn-primary');
                    else if (section === 'adminmessages') buttons[6].classList.add('btn-primary');
                    else if (section === 'murderboard') buttons[7].classList.add('btn-primary');
                    else if (section === 'stats') buttons[8].classList.add('btn-primary');
                    else if (section === 'credits') buttons[9].classList.add('btn-primary');
                    else if (section === 'iplogs') buttons[10].classList.add('btn-primary');
                    else if (section === 'profilephotos') buttons[11].classList.add('btn-primary');
                    else if (section === 'reset') buttons[12].classList.add('btn-primary');

                    this.currentSection = section;

                    // Oyun kontrolü bölümü açıldıysa karakterleri ve fazları yükle
                    if (section === 'game') {
                        ADMIN.loadGameCharacters();
                        ADMIN.loadPhases();
                    }

                    // Karakterler bölümü açıldıysa karakterleri yükle
                    if (section === 'characters') {
                        CHARACTER.loadCharacters();
                    }

                    // Admin Mesajları bölümü açıldıysa mesajları yükle
                    if (section === 'adminmessages') {
                        ADMIN.loadAdminMessages();
                    }

                    // Murder Board İzleme bölümü açıldıysa takımları ve board'u yükle
                    if (section === 'murderboard') {
                        if (socketConnected) {
                            ADMIN_BOARD.init();
                        } else {
                            console.log('Socket bağlantısı bekliyor...');
                        }
                    }

                    // Kullanıcılar bölümü açıldıysa listeyi render et
                    if (section === 'users') {
                        // Manuel olarak kullanıcıları server'dan çek
                        if (socketConnected) {
                            window.safeSocketEmit('get-users-by-team', null, function(response) {
                                if (response && response.success) {
                                    users = response.users || [];
                                } else {
                                    users = [];
                                }
                                renderUsersList();
                            });
                        } else {
                            renderUsersList();
                        }
                    }

                    // Chat İzleme bölümü açıldıysa dropdown'ı doldur
                    if (section === 'chat') {
                        ADMIN.updateChatTeamSelector();
                    }

                    // Emeği geçenler bölümü açıldıysa listeyi render et
                    if (section === 'credits') {
                        renderCreditsList();
                    }

                    // IP Logları bölümü açıldıysa varsayılan tab'ı göster
                    if (section === 'iplogs') {
                        IP_SECTION.showTab('logs');
                    }

                    // Profil Fotoğrafları bölümü açıldıysa kullanıcıları yükle
                    if (section === 'profilephotos') {
                        PHOTO_ADMIN.loadUsers();
                    }

                    // İstatistikler bölümü açıldıysa verileri yükle
                    if (section === 'stats') {
                        ADMIN.loadStatistics();
                    }
                },

                loadGameCharacters: function() {
                    console.log('loadGameCharacters çağrıldı');
                    if (!socketConnected) {
                        console.error('Socket bağlantısı yok, karakterler yüklenemiyor!');
                        return;
                    }

                    window.safeSocketEmit('get-characters', null, function(response) {
                        if (response && response.success) {
                            console.log('Karakterler yüklendi:', response.characters);
                            ADMIN.renderGameCharacters(response.characters || []);
                        } else {
                            console.error('Karakter yükleme hatası');
                            ADMIN.renderGameCharacters([]);
                        }
                    });
                },

                renderGameCharacters: function(characters) {
                    console.log('renderGameCharacters çağrıldı, karakter sayısı:', characters.length);
                    const container = document.getElementById('gameCharactersList');

                    if (!container) {
                        console.error('gameCharactersList container bulunamadı!');
                        return;
                    }

                    if (characters.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">ğŸ‘¤</div>
                                <div style="font-size: 14px;">Henüz karakter eklenmemiş</div>
                            </div>
                        `;
                        return;
                    }

                    let html = '';
                    characters.forEach(function(char) {
                        const isVisible = char.visible_to_teams;
                        html += `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; margin-bottom: 10px;">
                                ${char.photo_url ? `
                                    <img src="${char.photo_url}" alt="${char.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 2px solid #444;">
                                ` : `
                                    <div style="width: 50px; height: 50px; background: #222; border-radius: 6px; border: 2px solid #444; display: flex; align-items: center; justify-content: center; font-size: 24px;">ğŸ‘¤</div>
                                `}

                                <div style="flex: 1; min-width: 0;">
                                    <div style="color: #4dd4d4; font-weight: 600; font-size: 14px;">${escapeHtml(char.name)}</div>
                                    <div style="color: #666; font-size: 11px; margin-top: 2px;">
                                        ${char.age ? char.age + ' yaş' : ''} ${char.occupation ? ' â€¢ ' + escapeHtml(char.occupation) : ''}
                                    </div>
                                </div>

                                <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                    <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="ADMIN.toggleGameCharacterVisibility('${char.id}', this.checked, this)" style="opacity: 0; width: 0; height: 0;">
                                    <span class="toggle-bg" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: ${isVisible ? '#1a4d1a' : '#333'}; border-radius: 26px; transition: 0.3s;"></span>
                                    <span class="toggle-btn" style="position: absolute; height: 18px; width: 18px; left: ${isVisible ? '28px' : '4px'}; bottom: 4px; background: ${isVisible ? '#4dd44d' : '#888'}; border-radius: 50%; transition: 0.3s;"></span>
                                </label>
                            </div>
                        `;
                    });

                    container.innerHTML = html;
                },

                toggleGameCharacterVisibility: function(characterId, visible, checkboxElement) {
                    console.log('toggleGameCharacterVisibility çağrıldı:', characterId, visible);

                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        console.error('Socket bağlantısı yok!');
                        return;
                    }

                    // Toggle görselini güncelle
                    const label = checkboxElement.parentElement;
                    const toggleBg = label.querySelector('.toggle-bg');
                    const toggleBtn = label.querySelector('.toggle-btn');

                    if (toggleBg && toggleBtn) {
                        if (visible) {
                            toggleBg.style.background = '#1a4d1a';
                            toggleBtn.style.background = '#4dd44d';
                            toggleBtn.style.left = '28px';
                        } else {
                            toggleBg.style.background = '#333';
                            toggleBtn.style.background = '#888';
                            toggleBtn.style.left = '4px';
                        }
                    }

                    window.safeSocketEmit('toggle-character-visibility', {
                        characterId: characterId,
                        visible: visible
                    }, function(response) {
                        console.log('Toggle response:', response);
                        if (response.success) {
                            toast(visible ? 'ğŸ‘ï¸ Karakter açıldı - Takımlar görebilir' : 'ğŸ”’ Karakter kapatıldı');
                        } else {
                            // Hata varsa toggle'ı geri al
                            checkboxElement.checked = !visible;
                            if (toggleBg && toggleBtn) {
                                if (!visible) {
                                    toggleBg.style.background = '#1a4d1a';
                                    toggleBtn.style.background = '#4dd44d';
                                    toggleBtn.style.left = '28px';
                                } else {
                                    toggleBg.style.background = '#333';
                                    toggleBtn.style.background = '#888';
                                    toggleBtn.style.left = '4px';
                                }
                            }
                            toast(response.error || 'İşlem başarısız!', true);
                            ADMIN.loadGameCharacters(); // Hata varsa listeyi yenile
                        }
                    });
                },

                // FAZ YÖNETİMİ
                loadPhases: function() {
                    console.log('loadPhases çağrıldı');
                    if (!socketConnected) {
                        console.error('Socket bağlantısı yok, fazlar yüklenemiyor!');
                        return;
                    }

                    window.safeSocketEmit('get-phases', null, function(response) {
                        if (response && response.success) {
                            console.log('Fazlar yüklendi:', response.phases);
                            ADMIN.renderPhases(response.phases || []);
                        } else {
                            console.error('Faz yükleme hatası:', response ? response.error : 'Timeout');
                            ADMIN.renderPhases([]);
                        }
                    });
                },

                renderPhases: function(phases) {
                    console.log('renderPhases çağrıldı, faz sayısı:', phases.length);
                    const container = document.getElementById('phasesList');

                    if (!container) {
                        console.error('phasesList container bulunamadı!');
                        return;
                    }

                    if (phases.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">â±ï¸</div>
                                <div style="font-size: 14px;">Henüz faz başlatılmamış</div>
                            </div>
                        `;
                        return;
                    }

                    let html = '';
                    phases.forEach(function(phase) {
                        const startDate = new Date(phase.startedAt);
                        const endDate = phase.endedAt ? new Date(phase.endedAt) : null;
                        const isActive = phase.isActive;

                        html += `
                            <div style="padding: 15px; background: ${isActive ? '#0d2818' : '#0a0a0a'}; border: 1px solid ${isActive ? '#1a5d1a' : '#333'}; border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <div style="font-weight: 600; color: ${isActive ? '#4dd44d' : '#4dd4d4'}; font-size: 14px;">
                                        ${isActive ? 'ğŸŸ¢ ' : ''}${escapeHtml(phase.title)}
                                    </div>
                                    <div style="font-size: 11px; color: #666;">
                                        ${phase.durationMinutes} dakika
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px; color: #888; margin-bottom: 10px;">
                                    <div>
                                        <div style="color: #666;">Başlangıç:</div>
                                        <div style="color: #aaa;">${formatDate(startDate)}</div>
                                    </div>
                                    <div>
                                        <div style="color: #666;">Bitiş:</div>
                                        <div style="color: #aaa;">${endDate ? formatDate(endDate) : '---'}</div>
                                    </div>
                                </div>

                                ${!isActive ? `
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 10px; border-top: 1px solid #222;">
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">İpuçları</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalClues}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">Mesajlar</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalMessages}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">Puan Değişimi</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalScoreChanges}</div>
                                        </div>
                                    </div>

                                    ${phase.leadingTeamName ? `
                                        <div style="margin-top: 10px; padding: 8px; background: #0d0d0d; border-radius: 6px; text-align: center; font-size: 11px;">
                                            <span style="color: #666;">Lider Takım:</span>
                                            <span style="color: #d4af37; font-weight: 600;">${escapeHtml(phase.leadingTeamName)}</span>
                                            <span style="color: #888;">(${phase.leadingTeamScore} puan)</span>
                                        </div>
                                    ` : ''}
                                ` : `
                                    <div style="text-align: center; padding: 10px; color: #4dd44d; font-size: 12px; animation: pulse 2s infinite;">
                                        â±ï¸ Faz devam ediyor...
                                    </div>
                                `}
                            </div>
                        `;
                    });

                    container.innerHTML = html;
                },

                sendGeneralClue: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    var text = document.getElementById('generalClueText').value.trim();
                    if (!text) {
                        toast('İpucu metni giriniz', true);
                        return;
                    }
                    if (confirm('Bu ipucu tüm takımlara gönderilecek. Emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        window.safeSocketEmit('send-general-clue', text, function(res) {
                            isProcessing = false;
                            if (res && res.success) {
                                document.getElementById('generalClueText').value = '';
                                toast('İpucu gönderildi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                sendAnnouncement: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    var text = document.getElementById('announcementText').value.trim();
                    if (!text) {
                        toast('Duyuru metni giriniz', true);
                        return;
                    }
                    if (confirm('Bu duyuru tüm takımlara gönderilecek. Emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        window.safeSocketEmit('send-announcement', text, function(res) {
                            isProcessing = false;
                            if (res && res.success) {
                                document.getElementById('announcementText').value = '';
                                toast('Duyuru gönderildi');
                                // Bildirim listesini güncelle
                                setTimeout(function() {
                                    NOTIF.renderAdminList();
                                }, 500);
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                clearAllNotifications: function() {
                    if (confirm('TÜM bildirimleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                        NOTIF.clearAll();
                        toast('Tüm bildirimler silindi');
                    }
                },

                deleteNotification: function(notifId) {
                    if (confirm('Bu bildirimi silmek istediğinize emin misiniz?')) {
                        NOTIF.deleteById(notifId);
                        toast('Bildirim silindi');
                    }
                },

                // Admin mesajları global state
                adminMessagesData: [],
                selectedAdminTeamId: null,

                // Admin mesajlarını yükle
                loadAdminMessages: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    // Tüm takımları yükle ve dropdown'ı doldur
                    window.safeSocketEmit('admin-get-teams', null, function(res) {
                        if (res && res.success) {
                            var selector = document.getElementById('adminMessagesTeamSelector');
                            if (!selector) return;

                            selector.innerHTML = '<option value="">Takım seçin...</option>';
                            res.teams.forEach(function(team) {
                                selector.innerHTML += `<option value="${team.id}">${htmlEscape(team.name)}</option>`;
                            });
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Dropdown'dan takım seç
                selectTeamForAdminMessages: function(teamId) {
                    if (!teamId) {
                        // Boş seçim
                        ADMIN.selectedAdminTeamId = null;
                        document.getElementById('adminMessagesViewerContainer').style.display = 'none';
                        document.getElementById('adminMessagesEmptyState').style.display = 'block';
                        return;
                    }

                    ADMIN.selectedAdminTeamId = teamId;

                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    // Takım bilgisini al
                    window.safeSocketEmit('admin-get-teams', null, function(res) {
                        if (res && res.success) {
                            var team = res.teams.find(function(t) { return t.id === teamId; });
                            if (team) {
                                document.getElementById('adminSelectedTeamName').textContent = team.name;
                            }
                        }
                    });

                    // Admin mesajlarını yükle (bu takımla olan mesajlar)
                    window.safeSocketEmit('load-admin-messages', null, function(res) {
                        if (res && res.success) {
                            // Seçili takımın mesajlarını filtrele
                            var teamMessages = res.messages.filter(function(msg) {
                                return msg.team_id === teamId || msg.target_team_id === teamId;
                            });

                            // Mesajları render et
                            ADMIN.renderAdminTeamMessages(teamMessages);

                            // Görünümleri değiştir
                            document.getElementById('adminMessagesViewerContainer').style.display = 'block';
                            document.getElementById('adminMessagesEmptyState').style.display = 'none';
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Seçili takımın mesajlarını render et
                renderAdminTeamMessages: function(teamMessages) {
                    var container = document.getElementById('adminMessagesContainer');
                    var countEl = document.getElementById('adminSelectedTeamMessageCount');

                    if (!container) return;

                    // Sayacı güncelle
                    if (countEl) {
                        countEl.textContent = teamMessages.length + ' mesaj';
                    }

                    if (teamMessages.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 80px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">ğŸ“­</div>
                                <div style="font-size: 14px;">Bu takımdan mesaj yok</div>
                            </div>`;
                        return;
                    }

                    // Mesajları WhatsApp sıralamasına göre düzenle (eski â†’ yeni)
                    var sortedMessages = teamMessages.slice().reverse();

                    var html = '';
                    sortedMessages.forEach(function(msg) {
                        var time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        var date = new Date(msg.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
                        var isAdminMessage = msg.team_id === null; // Admin mesajları team_id NULL

                        // Takım rengi badge
                        var teamColor = msg.team_color || '#3b82f6';
                        var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(msg.team_name)}</span>`;

                        // WhatsApp tarzı görünüm
                        if (isAdminMessage) {
                            // Admin'in mesajı - SAÄDA
                            html += `
                            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-end;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                        <span style="color: #666; font-size: 11px;">ğŸ• ${date} ${time}</span>
                                        <span style="background: #fbbf24; color: #000; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">ğŸ‘‘ Admin</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #0d5858, #0a4040); border: 1px solid #1a7070; border-radius: 12px 12px 2px 12px; padding: 12px 16px; color: #fff; font-size: 14px; line-height: 1.6; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                            </div>`;
                        } else {
                            // Takımın mesajı - SOLDA
                            html += `
                            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-start;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span style="color: #fbbf24; font-weight: 600; font-size: 13px;">ğŸ‘¤ ${htmlEscape(msg.nickname)}</span>
                                        ${teamBadge}
                                        <span style="color: #666; font-size: 11px;">ğŸ• ${date} ${time}</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.05)); border: 1px solid rgba(251,191,36,0.4); border-radius: 12px 12px 12px 2px; padding: 12px 16px; color: #fff; font-size: 14px; line-height: 1.6; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                            </div>`;
                        }
                    });

                    container.innerHTML = html;
                    container.scrollTop = container.scrollHeight; // En alta kaydır
                },

                // Admin'den takıma mesaj gönder
                sendReplyMessage: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    if (!ADMIN.selectedAdminTeamId) {
                        toast('Lütfen dropdown\'dan bir takım seçin!', true);
                        return;
                    }

                    var messageInput = document.getElementById('adminReplyMessage');
                    var message = messageInput ? messageInput.value.trim() : '';

                    if (!message) {
                        toast('Mesaj boş olamaz!', true);
                        return;
                    }

                    window.safeSocketEmit('admin-send-message', {
                        targetTeamId: ADMIN.selectedAdminTeamId,
                        message: message
                    }, function(res) {
                        if (res && res.success) {
                            if (messageInput) messageInput.value = '';
                            toast('Mesaj gönderildi!');

                            // Mesajları yeniden yükle (gönderilen mesaj görünsün)
                            ADMIN.selectTeamForAdminMessages(ADMIN.selectedAdminTeamId);
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                clearAllClues: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    if (confirm('TÜM ipuçlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                        window.safeSocketEmit('clear-all-clues', null, function(res) {
                            if (res && res.success) {
                                toast('Tüm ipuçları silindi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                deleteClue: function(clueId) {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    if (confirm('Bu ipucunu silmek istediğinize emin misiniz?')) {
                        window.safeSocketEmit('delete-general-clue', clueId, function(res) {
                            if (res && res.success) {
                                toast('İpucu silindi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                renderAdminClues: function() {
                    var container = document.getElementById('adminClueList');
                    var countEl = document.getElementById('adminClueCount');

                    if (!container || !countEl) return;

                    countEl.textContent = generalClues.length + ' ipucu';

                    if (generalClues.length === 0) {
                        container.innerHTML = '<div style="text-align:center; padding:40px; color:#555; font-size:13px;">Henüz ipucu yok</div>';
                        return;
                    }

                    var html = '';
                    generalClues.forEach(function(clue) {
                        html += `
                        <div class="admin-notif-item">
                            <div class="admin-notif-content">
                                <span class="admin-notif-type clue">İpucu</span>
                                <div class="admin-notif-message">${htmlEscape(clue.text)}</div>
                                <div class="admin-notif-time">${clue.created_at ? new Date(clue.created_at).toLocaleString('tr-TR') : ''}</div>
                            </div>
                            <button class="admin-notif-delete" onclick="ADMIN.deleteClue(${clue.id})">ğŸ—‘ï¸ Sil</button>
                        </div>`;
                    });
                    container.innerHTML = html;
                },

                // Chat İzleme - Takım seçici dropdown'ı güncelle
                updateChatTeamSelector: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    var selector = document.getElementById('adminChatTeamSelector');
                    if (!selector) return;

                    var selectedValue = selector.value;

                    // Takımları server'dan çek
                    window.safeSocketEmit('admin-get-teams', null, function(res) {
                        if (res && res.success) {
                            var html = '<option value="">Takım seçin...</option>';
                            res.teams.forEach(function(team) {
                                html += `<option value="${team.id}" ${selectedValue === team.id ? 'selected' : ''}>${htmlEscape(team.name)}</option>`;
                            });
                            selector.innerHTML = html;
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Chat İzleme - Takım seç
                selectedChatTeamId: null,
                selectedChatTeamName: null,

                selectTeamForChat: function(teamId) {
                    if (!teamId) {
                        // Boş seçim
                        ADMIN.selectedChatTeamId = null;
                        ADMIN.selectedChatTeamName = null;
                        document.getElementById('adminChatViewerContainer').style.display = 'none';
                        document.getElementById('adminChatEmptyState').style.display = 'block';
                        return;
                    }

                    ADMIN.selectedChatTeamId = teamId;

                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    // Takım chat'ini yükle
                    window.safeSocketEmit('admin-load-team-chat', teamId, function(res) {
                        if (res && res.success) {
                            ADMIN.selectedChatTeamName = res.teamName;
                            document.getElementById('adminChatTeamName').textContent = res.teamName;
                            document.getElementById('adminChatMessageCount').textContent = res.totalCount + ' mesaj';

                            // Mesajları render et
                            ADMIN.renderTeamChat(res.messages);

                            // Görünümleri değiştir
                            document.getElementById('adminChatViewerContainer').style.display = 'block';
                            document.getElementById('adminChatEmptyState').style.display = 'none';
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Chat İzleme - Mesajları render et
                renderTeamChat: function(messages) {
                    var container = document.getElementById('adminChatMessages');
                    if (!container) return;

                    // Seçili takımla ilgili mesajları filtrele (takıma gönderilen veya takımın gönderdiği + admin mesajları)
                    var filteredMessages = messages.filter(function(msg) {
                        // Admin mesajlarını hariç tut (sadece takımlara özel değil, herkese olanları)
                        if (msg.target_team_id === 'admin') return false;

                        // Admin'in bu takıma gönderdiği mesajları dahil et
                        if (msg.team_id === null && msg.target_team_id === ADMIN.selectedChatTeamId) return true;

                        // Diğer mesajları olduğu gibi bırak
                        return true;
                    });

                    if (filteredMessages.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 60px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">ğŸ’¬</div>
                                <div style="font-size: 14px;">Henüz mesaj yok</div>
                            </div>`;
                        return;
                    }

                    // Mesajları WhatsApp sıralamasına göre düzenle (eski â†’ yeni)
                    var sortedMessages = filteredMessages.slice().reverse();

                    var html = '';
                    sortedMessages.forEach(function(msg) {
                        var time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        var isFromSelectedTeam = msg.team_id === ADMIN.selectedChatTeamId;
                        var isFromAdmin = msg.team_id === null; // Admin mesajı

                        // Takım rengi badge
                        var teamColor = msg.team_color || '#3b82f6';
                        var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(msg.team_name)}</span>`;

                        // Hedef takım etiketi
                        var targetLabel = '';
                        if (msg.target_team_name) {
                            targetLabel = `<span style="color: #d4af37; font-size: 10px; background: rgba(212,175,55,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">ğŸ”’ â†’ ${htmlEscape(msg.target_team_name)}</span>`;
                        } else {
                            targetLabel = `<span style="color: #4dd4d4; font-size: 10px; background: rgba(77,212,212,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(77,212,212,0.3);">ğŸ“¢ Tüm Takımlar</span>`;
                        }

                        // WhatsApp tarzı görünüm
                        if (isFromAdmin) {
                            // Admin mesajı - SAÄDA (özel altın rengi)
                            html += `
                            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-end;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                        ${targetLabel}
                                        ${teamBadge}
                                        <span style="color: #fbbf24; font-weight: 700; font-size: 13px;">ğŸ‘‘ ${htmlEscape(msg.nickname)}</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #4a3800, #2d2200); border: 2px solid #fbbf24; border-radius: 12px 12px 2px 12px; padding: 10px 14px; color: #fbbf24; font-size: 14px; font-weight: 600; word-wrap: break-word; box-shadow: 0 2px 8px rgba(251,191,36,0.3);">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                            </div>`;
                        } else if (isFromSelectedTeam) {
                            // Seçili takımın mesajı - SOLDA
                            html += `
                            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px;">
                                <div style="max-width: 75%; display: flex; flex-direction: column; align-items: flex-start;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span style="color: #4dd4d4; font-weight: 700; font-size: 13px;">${htmlEscape(msg.nickname)}</span>
                                        ${teamBadge}
                                        ${targetLabel}
                                        <span style="color: #444; font-size: 10px;">${time}</span>
                                    </div>
                                    <div style="background: linear-gradient(135deg, #0d5858, #0a4040); border: 1px solid #1a7070; border-radius: 12px 12px 12px 2px; padding: 10px 14px; color: #fff; font-size: 14px; word-wrap: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                        ${htmlEscape(msg.message)}
                                    </div>
                                </div>
                            </div>`;
                        } else {
                            // Diğer takımın mesajı - SOLDA
                            html += `
                            <div style="display: flex; justify-content: flex-start; margin-bottom: 12px;">
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

                startGame: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    var minutes = parseInt(document.getElementById('gameMinutes').value);
                    var title = document.getElementById('gameTitle').value.trim();

                    if (!minutes || minutes <= 0) {
                        toast('Geçerli bir süre giriniz!', true);
                        return;
                    }

                    if (isProcessing) return;
                    isProcessing = true;

                    window.safeSocketEmit('start-game', { minutes: minutes, title: title }, function(res) {
                        isProcessing = false;
                        if (res.success) {
                            toast('Oyun başlatıldı!');
                            document.getElementById('gameMinutes').value = '';
                            document.getElementById('gameTitle').value = '';
                            // Backend otomatik olarak session ve faz kaydını başlatır
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                addTime: function(seconds) {
                    if (isProcessing) return;
                    isProcessing = true;

                    window.safeSocketEmit('add-time', seconds, function(res) {
                        isProcessing = false;
                        if (res.success) {
                            var mins = Math.floor(seconds / 60);
                            toast(mins + ' dakika eklendi');
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                endGame: function() {
                    if (confirm('Oyunu bitirmek istediğinize emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        window.safeSocketEmit('end-game', null, function(res) {
                            isProcessing = false;
                            if (res.success) {
                                toast('Oyun bitirildi!');
                                // Backend otomatik olarak faz + session kapatıp 'game-ended' event ile rapor gönderir
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                updateCountdownDisplay: function() {
                    var display = document.getElementById('adminCountdown');
                    if (display) {
                        display.textContent = formatTime(gameState.countdown);
                        if (gameState.countdown < 60) {
                            display.classList.add('warning');
                        } else {
                            display.classList.remove('warning');
                        }
                    }

                    var titleDisplay = document.getElementById('adminPhaseTitle');
                    if (titleDisplay && gameState.phaseTitle) {
                        titleDisplay.textContent = gameState.phaseTitle;
                    }
                },

                addCredit: function() {
                    var input = document.getElementById('creditNameInput');
                    var name = input.value.trim();

                    if (!name) {
                        toast('İsim giriniz', true);
                        return;
                    }

                    window.safeSocketEmit('add-credit', name, function(res) {
                        if (res && res.success) {
                            input.value = '';
                            toast('İsim eklendi');
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                removeCredit: function(creditId, name) {
                    if (confirm('"' + name + '" isimli kişiyi listeden silmek istediğinize emin misiniz?')) {
                        window.safeSocketEmit('remove-credit', creditId, function(res) {
                            if (res && res.success) {
                                toast('İsim silindi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                updateCreditContent: function(creditId) {
                    var textarea = document.getElementById('creditContent_' + creditId);
                    if (!textarea) return;

                    var content = textarea.value.trim();

                    window.safeSocketEmit('update-credit-content', {
                        creditId: creditId,
                        content: content
                    }, function(res) {
                        if (res && res.success) {
                            toast('İçerik güncellendi');
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // İSTATİSTİKLER FONKSİYONLARI
                loadStatistics: function() {
                    if (!socketConnected) {
                        toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
                        return;
                    }

                    window.safeSocketEmit('get-statistics', null, function(res) {
                        if (res && res.success) {
                            ADMIN.renderStatsOverview(res.stats.overview);
                            ADMIN.renderStatsMessaging(res.stats.messaging);
                            ADMIN.renderStatsClues(res.stats.clues);
                            ADMIN.renderStatsUsers(res.stats.users);
                            ADMIN.renderStatsScoring(res.stats.scoring);

                            // Export için veriyi sakla
                            window.statsData = res.stats;

                            toast('İstatistikler yüklendi');
                        } else {
                            toast(res.error || 'İstatistikler yüklenemedi!', true);
                        }
                    });
                },

                renderStatsOverview: function(overview) {
                    document.getElementById('statTotalTeams').textContent = overview.totalTeams;
                    document.getElementById('statTotalUsers').textContent = overview.totalUsers;
                    document.getElementById('statTotalMessages').textContent = overview.totalMessages;
                    document.getElementById('statTotalClues').textContent = overview.totalClues;
                },

                renderStatsMessaging: function(messaging) {
                    var container = document.getElementById('statMessagingList');
                    if (!container) return;

                    if (messaging.byTeam.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Henüz mesaj yok</div>';
                        return;
                    }

                    var html = '';
                    messaging.byTeam.forEach(function(team) {
                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#0a0a0a; border-radius:8px; margin-bottom:8px;">
                            <span style="color:#fff; font-weight:600;">${htmlEscape(team.name)}</span>
                            <span style="color:var(--gold); font-size:20px; font-weight:700;">${team.message_count}</span>
                        </div>`;
                    });

                    html += `
                    <div style="margin-top:15px; padding-top:15px; border-top:1px solid #333; text-align:center;">
                        <span style="color:#888; font-size:12px;">Takım başına ortalama: </span>
                        <span style="color:var(--gold); font-weight:700; font-size:16px;">${messaging.avgPerTeam}</span>
                        <span style="color:#888; font-size:12px;"> mesaj</span>
                    </div>`;

                    container.innerHTML = html;
                },

                renderStatsClues: function(clues) {
                    var container = document.getElementById('statCluesList');
                    if (!container) return;

                    if (clues.byTeam.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Henüz ipucu yok</div>';
                        return;
                    }

                    var html = '';
                    clues.byTeam.forEach(function(team) {
                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#0a0a0a; border-radius:8px; margin-bottom:8px;">
                            <span style="color:#fff; font-weight:600;">${htmlEscape(team.name)}</span>
                            <span style="color:var(--gold); font-size:20px; font-weight:700;">${team.clue_count}</span>
                        </div>`;
                    });

                    html += `
                    <div style="margin-top:15px; padding-top:15px; border-top:1px solid #333; text-align:center;">
                        <span style="color:#888; font-size:12px;">Takım başına ortalama: </span>
                        <span style="color:var(--gold); font-weight:700; font-size:16px;">${clues.avgPerTeam}</span>
                        <span style="color:#888; font-size:12px;"> ipucu</span>
                    </div>`;

                    container.innerHTML = html;
                },

                renderStatsUsers: function(users) {
                    var container = document.getElementById('statUsersList');
                    if (!container) return;

                    if (users.mostActive.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Henüz aktif kullanıcı yok</div>';
                        return;
                    }

                    var html = '';
                    users.mostActive.forEach(function(user, index) {
                        var medal = '';
                        if (index === 0) medal = 'ğŸ¥‡';
                        else if (index === 1) medal = 'ğŸ¥ˆ';
                        else if (index === 2) medal = 'ğŸ¥‰';

                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background:#0a0a0a; border-radius:8px; margin-bottom:8px;">
                            <div style="flex:1;">
                                <span style="color:#fff; font-weight:600;">${medal} ${htmlEscape(user.nickname)}</span>
                                <span style="color:#666; font-size:11px; margin-left:10px;">${htmlEscape(user.team_name || 'Takımsız')}</span>
                            </div>
                            <span style="color:var(--gold); font-size:18px; font-weight:700;">${user.message_count}</span>
                        </div>`;
                    });

                    container.innerHTML = html;
                },

                renderStatsScoring: function(scoring) {
                    var container = document.getElementById('statScoringList');
                    if (!container) return;

                    if (scoring.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Henüz takım yok</div>';
                        return;
                    }

                    var html = '';
                    scoring.forEach(function(team, index) {
                        var medal = '';
                        if (index === 0) medal = 'ğŸ¥‡';
                        else if (index === 1) medal = 'ğŸ¥ˆ';
                        else if (index === 2) medal = 'ğŸ¥‰';

                        var rank = index + 1;

                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:#0a0a0a; border-radius:8px; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:15px;">
                                <span style="color:#666; font-size:20px; font-weight:700; width:30px;">${rank}</span>
                                <div style="width:40px; height:40px; border-radius:50%; background:${htmlEscape(team.color)}; display:flex; align-items:center; justify-content:center; font-size:20px;">
                                    ${htmlEscape(team.avatar)}
                                </div>
                                <span style="color:#fff; font-weight:600; font-size:15px;">${htmlEscape(team.name)}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                ${medal ? '<span style="font-size:24px;">' + medal + '</span>' : ''}
                                <span style="color:var(--gold); font-size:24px; font-weight:700;">${team.score}</span>
                            </div>
                        </div>`;
                    });

                    container.innerHTML = html;
                },

                exportStats: function(format) {
                    if (!window.statsData) {
                        toast('Önce istatistikleri yükleyin', true);
                        return;
                    }

                    if (format === 'json') {
                        var dataStr = JSON.stringify(window.statsData, null, 2);
                        var dataBlob = new Blob([dataStr], { type: 'application/json' });
                        var url = URL.createObjectURL(dataBlob);
                        var link = document.createElement('a');
                        link.href = url;
                        link.download = 'istatistikler_' + new Date().getTime() + '.json';
                        link.click();
                        URL.revokeObjectURL(url);
                        toast('JSON dosyası indirildi');
                    } else if (format === 'csv') {
                        var csv = 'Kategori,Veri,Değer\n';

                        // Genel Özet
                        csv += 'Genel Özet,Toplam Takım,' + window.statsData.overview.totalTeams + '\n';
                        csv += 'Genel Özet,Toplam Kullanıcı,' + window.statsData.overview.totalUsers + '\n';
                        csv += 'Genel Özet,Toplam Mesaj,' + window.statsData.overview.totalMessages + '\n';
                        csv += 'Genel Özet,Toplam İpucu,' + window.statsData.overview.totalClues + '\n';
                        csv += '\n';

                        // Mesajlaşma
                        csv += 'Mesajlaşma,Takım Başına Ortalama,' + window.statsData.messaging.avgPerTeam + '\n';
                        window.statsData.messaging.byTeam.forEach(function(team) {
                            csv += 'Mesajlaşma,"' + team.name.replace(/"/g, '""') + '",' + team.message_count + '\n';
                        });
                        csv += '\n';

                        // İpuçları
                        csv += 'İpuçları,Takım Başına Ortalama,' + window.statsData.clues.avgPerTeam + '\n';
                        window.statsData.clues.byTeam.forEach(function(team) {
                            csv += 'İpuçları,"' + team.name.replace(/"/g, '""') + '",' + team.clue_count + '\n';
                        });
                        csv += '\n';

                        // En Aktif Kullanıcılar
                        window.statsData.users.mostActive.forEach(function(user, index) {
                            csv += 'En Aktif Kullanıcılar,"' + user.nickname.replace(/"/g, '""') + ' (' + (user.team_name || 'Takımsız').replace(/"/g, '""') + ')",' + user.message_count + '\n';
                        });
                        csv += '\n';

                        // Puan Sıralaması
                        window.statsData.scoring.forEach(function(team, index) {
                            csv += 'Puan Sıralaması,"' + (index + 1) + '. ' + team.name.replace(/"/g, '""') + '",' + team.score + '\n';
                        });

                        var csvBlob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                        var url = URL.createObjectURL(csvBlob);
                        var link = document.createElement('a');
                        link.href = url;
                        link.download = 'istatistikler_' + new Date().getTime() + '.csv';
                        link.click();
                        URL.revokeObjectURL(url);
                        toast('CSV dosyası indirildi');
                    }
                },

                // OYUN OTURUMU BAÅLAT
                startGameSession: function() {
                    if (!confirm('Yeni bir oyun oturumu başlatmak istediğinizden emin misiniz?\n\nBu işlem oyun olaylarını kaydetmeye başlayacak.')) {
                        return;
                    }

                    window.safeSocketEmit('start-game-session', null, function(res) {
                        if (res.success) {
                            toast('âœ… Oyun oturumu başlatıldı!');
                            console.log('Oyun oturumu ID:', res.sessionId);
                        } else {
                            toast(res.error || 'Oyun başlatılamadı!', true);
                        }
                    });
                },

                // OYUN OTURUMUNU BİTİR VE RAPOR OLUÅTUR
                endGameSession: function() {
                    if (!confirm('Oyunu bitirmek ve final raporunu görmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz.')) {
                        return;
                    }

                    window.safeSocketEmit('end-game-session', null, function(res) {
                        if (res.success) {
                            toast('âœ… Oyun bitti! Rapor gösteriliyor...');
                            GAME.showFinalReport(res.report);
                        } else {
                            toast(res.error || 'Oyun bitirilemedi!', true);
                        }
                    });
                }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.ADMIN = ADMIN;
}
