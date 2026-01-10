// Admin Panel Module
// Admin controls for game management

export const ADMIN = {

                currentSection: 'game',

                showSection: function(section) {
                    // TÃ¼m bÃ¶lÃ¼mleri gizle
                    document.querySelectorAll('.admin-section').forEach(function(el) {
                        el.style.display = 'none';
                    });

                    // SeÃ§ili bÃ¶lÃ¼mÃ¼ gÃ¶ster
                    document.getElementById('adminSection' + section.charAt(0).toUpperCase() + section.slice(1)).style.display = 'block';

                    // MenÃ¼ butonlarÄ±nÄ± gÃ¼ncelle
                    var buttons = document.querySelectorAll('#pgAdmin > div:nth-child(2) button');
                    buttons.forEach(function(btn) {
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn');
                    });

                    // SeÃ§ili butonu vurgula
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

                    // Oyun kontrolÃ¼ bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa karakterleri ve fazlarÄ± yÃ¼kle
                    if (section === 'game') {
                        ADMIN.loadGameCharacters();
                        ADMIN.loadPhases();
                    }

                    // Karakterler bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa karakterleri yÃ¼kle
                    if (section === 'characters') {
                        CHARACTER.loadCharacters();
                    }

                    // Admin MesajlarÄ± bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa mesajlarÄ± yÃ¼kle
                    if (section === 'adminmessages') {
                        ADMIN.loadAdminMessages();
                    }

                    // Murder Board Ä°zleme bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa takÄ±mlarÄ± ve board'u yÃ¼kle
                    if (section === 'murderboard') {
                        if (socketConnected) {
                            ADMIN_BOARD.init();
                        } else {
                            console.log('Socket baÄŸlantÄ±sÄ± bekliyor...');
                        }
                    }

                    // KullanÄ±cÄ±lar bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa listeyi render et
                    if (section === 'users') {
                        // Manuel olarak kullanÄ±cÄ±larÄ± server'dan Ã§ek
                        if (socketConnected) {
                            socket.emit('get-users-by-team', function(fetchedUsers) {
                                users = fetchedUsers;
                                renderUsersList();
                            });
                        } else {
                            renderUsersList();
                        }
                    }

                    // Chat Ä°zleme bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa dropdown'Ä± doldur
                    if (section === 'chat') {
                        ADMIN.updateChatTeamSelector();
                    }

                    // EmeÄŸi geÃ§enler bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa listeyi render et
                    if (section === 'credits') {
                        renderCreditsList();
                    }

                    // IP LoglarÄ± bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa varsayÄ±lan tab'Ä± gÃ¶ster
                    if (section === 'iplogs') {
                        IP_SECTION.showTab('logs');
                    }

                    // Profil FotoÄŸraflarÄ± bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa kullanÄ±cÄ±larÄ± yÃ¼kle
                    if (section === 'profilephotos') {
                        PHOTO_ADMIN.loadUsers();
                    }

                    // Ä°statistikler bÃ¶lÃ¼mÃ¼ aÃ§Ä±ldÄ±ysa verileri yÃ¼kle
                    if (section === 'stats') {
                        ADMIN.loadStatistics();
                    }
                },

                loadGameCharacters: function() {
                    console.log('loadGameCharacters Ã§aÄŸrÄ±ldÄ±');
                    if (!socketConnected) {
                        console.error('Socket baÄŸlantÄ±sÄ± yok, karakterler yÃ¼klenemiyor!');
                        return;
                    }

                    socket.emit('get-characters', function(characters) {
                        console.log('Karakterler yÃ¼klendi:', characters);
                        ADMIN.renderGameCharacters(characters);
                    });
                },

                renderGameCharacters: function(characters) {
                    console.log('renderGameCharacters Ã§aÄŸrÄ±ldÄ±, karakter sayÄ±sÄ±:', characters.length);
                    const container = document.getElementById('gameCharactersList');

                    if (!container) {
                        console.error('gameCharactersList container bulunamadÄ±!');
                        return;
                    }

                    if (characters.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">ğŸ‘¤</div>
                                <div style="font-size: 14px;">HenÃ¼z karakter eklenmemiÅŸ</div>
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
                                        ${char.age ? char.age + ' yaÅŸ' : ''} ${char.occupation ? ' â€¢ ' + escapeHtml(char.occupation) : ''}
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
                    console.log('toggleGameCharacterVisibility Ã§aÄŸrÄ±ldÄ±:', characterId, visible);

                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        console.error('Socket baÄŸlantÄ±sÄ± yok!');
                        return;
                    }

                    // Toggle gÃ¶rselini gÃ¼ncelle
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

                    socket.emit('toggle-character-visibility', {
                        characterId: characterId,
                        visible: visible
                    }, function(response) {
                        console.log('Toggle response:', response);
                        if (response.success) {
                            toast(visible ? 'ğŸ‘ï¸ Karakter aÃ§Ä±ldÄ± - TakÄ±mlar gÃ¶rebilir' : 'ğŸ”’ Karakter kapatÄ±ldÄ±');
                        } else {
                            // Hata varsa toggle'Ä± geri al
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
                            toast(response.error || 'Ä°ÅŸlem baÅŸarÄ±sÄ±z!', true);
                            ADMIN.loadGameCharacters(); // Hata varsa listeyi yenile
                        }
                    });
                },

                // FAZ YÃ–NETÄ°MÄ°
                loadPhases: function() {
                    console.log('loadPhases Ã§aÄŸrÄ±ldÄ±');
                    if (!socketConnected) {
                        console.error('Socket baÄŸlantÄ±sÄ± yok, fazlar yÃ¼klenemiyor!');
                        return;
                    }

                    socket.emit('get-phases', function(response) {
                        if (response.success) {
                            console.log('Fazlar yÃ¼klendi:', response.phases);
                            ADMIN.renderPhases(response.phases);
                        } else {
                            console.error('Faz yÃ¼kleme hatasÄ±:', response.error);
                        }
                    });
                },

                renderPhases: function(phases) {
                    console.log('renderPhases Ã§aÄŸrÄ±ldÄ±, faz sayÄ±sÄ±:', phases.length);
                    const container = document.getElementById('phasesList');

                    if (!container) {
                        console.error('phasesList container bulunamadÄ±!');
                        return;
                    }

                    if (phases.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">â±ï¸</div>
                                <div style="font-size: 14px;">HenÃ¼z faz baÅŸlatÄ±lmamÄ±ÅŸ</div>
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
                                        <div style="color: #666;">BaÅŸlangÄ±Ã§:</div>
                                        <div style="color: #aaa;">${formatDate(startDate)}</div>
                                    </div>
                                    <div>
                                        <div style="color: #666;">BitiÅŸ:</div>
                                        <div style="color: #aaa;">${endDate ? formatDate(endDate) : '---'}</div>
                                    </div>
                                </div>

                                ${!isActive ? `
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding-top: 10px; border-top: 1px solid #222;">
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">Ä°puÃ§larÄ±</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalClues}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">Mesajlar</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalMessages}</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="color: #666; font-size: 10px;">Puan DeÄŸiÅŸimi</div>
                                            <div style="color: #4dd4d4; font-weight: 600; font-size: 13px;">${phase.totalScoreChanges}</div>
                                        </div>
                                    </div>

                                    ${phase.leadingTeamName ? `
                                        <div style="margin-top: 10px; padding: 8px; background: #0d0d0d; border-radius: 6px; text-align: center; font-size: 11px;">
                                            <span style="color: #666;">Lider TakÄ±m:</span>
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
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    var text = document.getElementById('generalClueText').value.trim();
                    if (!text) {
                        toast('Ä°pucu metni giriniz', true);
                        return;
                    }
                    if (confirm('Bu ipucu tÃ¼m takÄ±mlara gÃ¶nderilecek. Emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        socket.emit('send-general-clue', text, function(res) {
                            isProcessing = false;
                            if (res.success) {
                                document.getElementById('generalClueText').value = '';
                                toast('Ä°pucu gÃ¶nderildi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                sendAnnouncement: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    var text = document.getElementById('announcementText').value.trim();
                    if (!text) {
                        toast('Duyuru metni giriniz', true);
                        return;
                    }
                    if (confirm('Bu duyuru tÃ¼m takÄ±mlara gÃ¶nderilecek. Emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        socket.emit('send-announcement', text, function(res) {
                            isProcessing = false;
                            if (res.success) {
                                document.getElementById('announcementText').value = '';
                                toast('Duyuru gÃ¶nderildi');
                                // Bildirim listesini gÃ¼ncelle
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
                    if (confirm('TÃœM bildirimleri silmek istediÄŸinize emin misiniz? Bu iÅŸlem geri alÄ±namaz.')) {
                        NOTIF.clearAll();
                        toast('TÃ¼m bildirimler silindi');
                    }
                },

                deleteNotification: function(notifId) {
                    if (confirm('Bu bildirimi silmek istediÄŸinize emin misiniz?')) {
                        NOTIF.deleteById(notifId);
                        toast('Bildirim silindi');
                    }
                },

                // Admin mesajlarÄ± global state
                adminMessagesData: [],
                selectedAdminTeamId: null,

                // Admin mesajlarÄ±nÄ± yÃ¼kle
                loadAdminMessages: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    // TÃ¼m takÄ±mlarÄ± yÃ¼kle ve dropdown'Ä± doldur
                    socket.emit('admin-get-teams', function(res) {
                        if (res.success) {
                            var selector = document.getElementById('adminMessagesTeamSelector');
                            if (!selector) return;

                            selector.innerHTML = '<option value="">TakÄ±m seÃ§in...</option>';
                            res.teams.forEach(function(team) {
                                selector.innerHTML += `<option value="${team.id}">${htmlEscape(team.name)}</option>`;
                            });
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Dropdown'dan takÄ±m seÃ§
                selectTeamForAdminMessages: function(teamId) {
                    if (!teamId) {
                        // BoÅŸ seÃ§im
                        ADMIN.selectedAdminTeamId = null;
                        document.getElementById('adminMessagesViewerContainer').style.display = 'none';
                        document.getElementById('adminMessagesEmptyState').style.display = 'block';
                        return;
                    }

                    ADMIN.selectedAdminTeamId = teamId;

                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    // TakÄ±m bilgisini al
                    socket.emit('admin-get-teams', function(res) {
                        if (res.success) {
                            var team = res.teams.find(function(t) { return t.id === teamId; });
                            if (team) {
                                document.getElementById('adminSelectedTeamName').textContent = team.name;
                            }
                        }
                    });

                    // Admin mesajlarÄ±nÄ± yÃ¼kle (bu takÄ±mla olan mesajlar)
                    socket.emit('load-admin-messages', function(res) {
                        if (res.success) {
                            // SeÃ§ili takÄ±mÄ±n mesajlarÄ±nÄ± filtrele
                            var teamMessages = res.messages.filter(function(msg) {
                                return msg.team_id === teamId || msg.target_team_id === teamId;
                            });

                            // MesajlarÄ± render et
                            ADMIN.renderAdminTeamMessages(teamMessages);

                            // GÃ¶rÃ¼nÃ¼mleri deÄŸiÅŸtir
                            document.getElementById('adminMessagesViewerContainer').style.display = 'block';
                            document.getElementById('adminMessagesEmptyState').style.display = 'none';
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // SeÃ§ili takÄ±mÄ±n mesajlarÄ±nÄ± render et
                renderAdminTeamMessages: function(teamMessages) {
                    var container = document.getElementById('adminMessagesContainer');
                    var countEl = document.getElementById('adminSelectedTeamMessageCount');

                    if (!container) return;

                    // SayacÄ± gÃ¼ncelle
                    if (countEl) {
                        countEl.textContent = teamMessages.length + ' mesaj';
                    }

                    if (teamMessages.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 80px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">ğŸ“­</div>
                                <div style="font-size: 14px;">Bu takÄ±mdan mesaj yok</div>
                            </div>`;
                        return;
                    }

                    // MesajlarÄ± WhatsApp sÄ±ralamasÄ±na gÃ¶re dÃ¼zenle (eski â†’ yeni)
                    var sortedMessages = teamMessages.slice().reverse();

                    var html = '';
                    sortedMessages.forEach(function(msg) {
                        var time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        var date = new Date(msg.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
                        var isAdminMessage = msg.team_id === null; // Admin mesajlarÄ± team_id NULL

                        // TakÄ±m rengi badge
                        var teamColor = msg.team_color || '#3b82f6';
                        var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(msg.team_name)}</span>`;

                        // WhatsApp tarzÄ± gÃ¶rÃ¼nÃ¼m
                        if (isAdminMessage) {
                            // Admin'in mesajÄ± - SAÄDA
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
                            // TakÄ±mÄ±n mesajÄ± - SOLDA
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
                    container.scrollTop = container.scrollHeight; // En alta kaydÄ±r
                },

                // Admin'den takÄ±ma mesaj gÃ¶nder
                sendReplyMessage: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (!ADMIN.selectedAdminTeamId) {
                        toast('LÃ¼tfen dropdown\'dan bir takÄ±m seÃ§in!', true);
                        return;
                    }

                    var messageInput = document.getElementById('adminReplyMessage');
                    var message = messageInput ? messageInput.value.trim() : '';

                    if (!message) {
                        toast('Mesaj boÅŸ olamaz!', true);
                        return;
                    }

                    socket.emit('admin-send-message', {
                        targetTeamId: ADMIN.selectedAdminTeamId,
                        message: message
                    }, function(res) {
                        if (res.success) {
                            if (messageInput) messageInput.value = '';
                            toast('Mesaj gÃ¶nderildi!');

                            // MesajlarÄ± yeniden yÃ¼kle (gÃ¶nderilen mesaj gÃ¶rÃ¼nsÃ¼n)
                            ADMIN.selectTeamForAdminMessages(ADMIN.selectedAdminTeamId);
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                clearAllClues: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (confirm('TÃœM ipuÃ§larÄ±nÄ± silmek istediÄŸinize emin misiniz? Bu iÅŸlem geri alÄ±namaz.')) {
                        socket.emit('clear-all-clues', function(res) {
                            if (res.success) {
                                toast('TÃ¼m ipuÃ§larÄ± silindi');
                            } else {
                                toast(res.error, true);
                            }
                        });
                    }
                },

                deleteClue: function(clueId) {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (confirm('Bu ipucunu silmek istediÄŸinize emin misiniz?')) {
                        socket.emit('delete-general-clue', clueId, function(res) {
                            if (res.success) {
                                toast('Ä°pucu silindi');
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
                        container.innerHTML = '<div style="text-align:center; padding:40px; color:#555; font-size:13px;">HenÃ¼z ipucu yok</div>';
                        return;
                    }

                    var html = '';
                    generalClues.forEach(function(clue) {
                        html += `
                        <div class="admin-notif-item">
                            <div class="admin-notif-content">
                                <span class="admin-notif-type clue">Ä°pucu</span>
                                <div class="admin-notif-message">${htmlEscape(clue.text)}</div>
                                <div class="admin-notif-time">${clue.created_at ? new Date(clue.created_at).toLocaleString('tr-TR') : ''}</div>
                            </div>
                            <button class="admin-notif-delete" onclick="ADMIN.deleteClue(${clue.id})">ğŸ—‘ï¸ Sil</button>
                        </div>`;
                    });
                    container.innerHTML = html;
                },

                // Chat Ä°zleme - TakÄ±m seÃ§ici dropdown'Ä± gÃ¼ncelle
                updateChatTeamSelector: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    var selector = document.getElementById('adminChatTeamSelector');
                    if (!selector) return;

                    var selectedValue = selector.value;

                    // TakÄ±mlarÄ± server'dan Ã§ek
                    socket.emit('admin-get-teams', function(res) {
                        if (res.success) {
                            var html = '<option value="">TakÄ±m seÃ§in...</option>';
                            res.teams.forEach(function(team) {
                                html += `<option value="${team.id}" ${selectedValue === team.id ? 'selected' : ''}>${htmlEscape(team.name)}</option>`;
                            });
                            selector.innerHTML = html;
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Chat Ä°zleme - TakÄ±m seÃ§
                selectedChatTeamId: null,
                selectedChatTeamName: null,

                selectTeamForChat: function(teamId) {
                    if (!teamId) {
                        // BoÅŸ seÃ§im
                        ADMIN.selectedChatTeamId = null;
                        ADMIN.selectedChatTeamName = null;
                        document.getElementById('adminChatViewerContainer').style.display = 'none';
                        document.getElementById('adminChatEmptyState').style.display = 'block';
                        return;
                    }

                    ADMIN.selectedChatTeamId = teamId;

                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    // TakÄ±m chat'ini yÃ¼kle
                    socket.emit('admin-load-team-chat', teamId, function(res) {
                        if (res.success) {
                            ADMIN.selectedChatTeamName = res.teamName;
                            document.getElementById('adminChatTeamName').textContent = res.teamName;
                            document.getElementById('adminChatMessageCount').textContent = res.totalCount + ' mesaj';

                            // MesajlarÄ± render et
                            ADMIN.renderTeamChat(res.messages);

                            // GÃ¶rÃ¼nÃ¼mleri deÄŸiÅŸtir
                            document.getElementById('adminChatViewerContainer').style.display = 'block';
                            document.getElementById('adminChatEmptyState').style.display = 'none';
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Chat Ä°zleme - MesajlarÄ± render et
                renderTeamChat: function(messages) {
                    var container = document.getElementById('adminChatMessages');
                    if (!container) return;

                    // SeÃ§ili takÄ±mla ilgili mesajlarÄ± filtrele (takÄ±ma gÃ¶nderilen veya takÄ±mÄ±n gÃ¶nderdiÄŸi + admin mesajlarÄ±)
                    var filteredMessages = messages.filter(function(msg) {
                        // Admin mesajlarÄ±nÄ± hariÃ§ tut (sadece takÄ±mlara Ã¶zel deÄŸil, herkese olanlarÄ±)
                        if (msg.target_team_id === 'admin') return false;

                        // Admin'in bu takÄ±ma gÃ¶nderdiÄŸi mesajlarÄ± dahil et
                        if (msg.team_id === null && msg.target_team_id === ADMIN.selectedChatTeamId) return true;

                        // DiÄŸer mesajlarÄ± olduÄŸu gibi bÄ±rak
                        return true;
                    });

                    if (filteredMessages.length === 0) {
                        container.innerHTML = `
                            <div style="text-align: center; padding: 60px 20px; color: #555;">
                                <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.5;">ğŸ’¬</div>
                                <div style="font-size: 14px;">HenÃ¼z mesaj yok</div>
                            </div>`;
                        return;
                    }

                    // MesajlarÄ± WhatsApp sÄ±ralamasÄ±na gÃ¶re dÃ¼zenle (eski â†’ yeni)
                    var sortedMessages = filteredMessages.slice().reverse();

                    var html = '';
                    sortedMessages.forEach(function(msg) {
                        var time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        var isFromSelectedTeam = msg.team_id === ADMIN.selectedChatTeamId;
                        var isFromAdmin = msg.team_id === null; // Admin mesajÄ±

                        // TakÄ±m rengi badge
                        var teamColor = msg.team_color || '#3b82f6';
                        var teamBadge = `<span style="background: ${teamColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${htmlEscape(msg.team_name)}</span>`;

                        // Hedef takÄ±m etiketi
                        var targetLabel = '';
                        if (msg.target_team_name) {
                            targetLabel = `<span style="color: #d4af37; font-size: 10px; background: rgba(212,175,55,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">ğŸ”’ â†’ ${htmlEscape(msg.target_team_name)}</span>`;
                        } else {
                            targetLabel = `<span style="color: #4dd4d4; font-size: 10px; background: rgba(77,212,212,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(77,212,212,0.3);">ğŸ“¢ TÃ¼m TakÄ±mlar</span>`;
                        }

                        // WhatsApp tarzÄ± gÃ¶rÃ¼nÃ¼m
                        if (isFromAdmin) {
                            // Admin mesajÄ± - SAÄDA (Ã¶zel altÄ±n rengi)
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
                            // SeÃ§ili takÄ±mÄ±n mesajÄ± - SOLDA
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
                            // DiÄŸer takÄ±mÄ±n mesajÄ± - SOLDA
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
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    var minutes = parseInt(document.getElementById('gameMinutes').value);
                    var title = document.getElementById('gameTitle').value.trim();

                    if (!minutes || minutes <= 0) {
                        toast('GeÃ§erli bir sÃ¼re giriniz!', true);
                        return;
                    }

                    if (isProcessing) return;
                    isProcessing = true;

                    socket.emit('start-game', { minutes: minutes, title: title }, function(res) {
                        isProcessing = false;
                        if (res.success) {
                            toast('Oyun baÅŸlatÄ±ldÄ±!');
                            document.getElementById('gameMinutes').value = '';
                            document.getElementById('gameTitle').value = '';
                            // Backend otomatik olarak session ve faz kaydÄ±nÄ± baÅŸlatÄ±r
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                addTime: function(seconds) {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (isProcessing) return;
                    isProcessing = true;

                    socket.emit('add-time', seconds, function(res) {
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
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (confirm('Oyunu bitirmek istediÄŸinize emin misiniz?')) {
                        if (isProcessing) return;
                        isProcessing = true;

                        socket.emit('end-game', function(res) {
                            isProcessing = false;
                            if (res.success) {
                                toast('Oyun bitirildi!');
                                // Backend otomatik olarak faz + session kapatÄ±p 'game-ended' event ile rapor gÃ¶nderir
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
                        toast('Ä°sim giriniz', true);
                        return;
                    }

                    socket.emit('add-credit', name, function(res) {
                        if (res.success) {
                            input.value = '';
                            toast('Ä°sim eklendi');
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                removeCredit: function(creditId, name) {
                    if (confirm('"' + name + '" isimli kiÅŸiyi listeden silmek istediÄŸinize emin misiniz?')) {
                        socket.emit('remove-credit', creditId, function(res) {
                            if (res.success) {
                                toast('Ä°sim silindi');
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

                    socket.emit('update-credit-content', {
                        creditId: creditId,
                        content: content
                    }, function(res) {
                        if (res.success) {
                            toast('Ä°Ã§erik gÃ¼ncellendi');
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Ä°STATÄ°STÄ°KLER FONKSÄ°YONLARI
                loadStatistics: function() {
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    socket.emit('get-statistics', function(res) {
                        if (res.success) {
                            ADMIN.renderStatsOverview(res.stats.overview);
                            ADMIN.renderStatsMessaging(res.stats.messaging);
                            ADMIN.renderStatsClues(res.stats.clues);
                            ADMIN.renderStatsUsers(res.stats.users);
                            ADMIN.renderStatsScoring(res.stats.scoring);

                            // Export iÃ§in veriyi sakla
                            window.statsData = res.stats;

                            toast('Ä°statistikler yÃ¼klendi');
                        } else {
                            toast(res.error || 'Ä°statistikler yÃ¼klenemedi!', true);
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
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">HenÃ¼z mesaj yok</div>';
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
                        <span style="color:#888; font-size:12px;">TakÄ±m baÅŸÄ±na ortalama: </span>
                        <span style="color:var(--gold); font-weight:700; font-size:16px;">${messaging.avgPerTeam}</span>
                        <span style="color:#888; font-size:12px;"> mesaj</span>
                    </div>`;

                    container.innerHTML = html;
                },

                renderStatsClues: function(clues) {
                    var container = document.getElementById('statCluesList');
                    if (!container) return;

                    if (clues.byTeam.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">HenÃ¼z ipucu yok</div>';
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
                        <span style="color:#888; font-size:12px;">TakÄ±m baÅŸÄ±na ortalama: </span>
                        <span style="color:var(--gold); font-weight:700; font-size:16px;">${clues.avgPerTeam}</span>
                        <span style="color:#888; font-size:12px;"> ipucu</span>
                    </div>`;

                    container.innerHTML = html;
                },

                renderStatsUsers: function(users) {
                    var container = document.getElementById('statUsersList');
                    if (!container) return;

                    if (users.mostActive.length === 0) {
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">HenÃ¼z aktif kullanÄ±cÄ± yok</div>';
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
                                <span style="color:#666; font-size:11px; margin-left:10px;">${htmlEscape(user.team_name || 'TakÄ±msÄ±z')}</span>
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
                        container.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">HenÃ¼z takÄ±m yok</div>';
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
                        toast('Ã–nce istatistikleri yÃ¼kleyin', true);
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
                        toast('JSON dosyasÄ± indirildi');
                    } else if (format === 'csv') {
                        var csv = 'Kategori,Veri,DeÄŸer\n';

                        // Genel Ã–zet
                        csv += 'Genel Ã–zet,Toplam TakÄ±m,' + window.statsData.overview.totalTeams + '\n';
                        csv += 'Genel Ã–zet,Toplam KullanÄ±cÄ±,' + window.statsData.overview.totalUsers + '\n';
                        csv += 'Genel Ã–zet,Toplam Mesaj,' + window.statsData.overview.totalMessages + '\n';
                        csv += 'Genel Ã–zet,Toplam Ä°pucu,' + window.statsData.overview.totalClues + '\n';
                        csv += '\n';

                        // MesajlaÅŸma
                        csv += 'MesajlaÅŸma,TakÄ±m BaÅŸÄ±na Ortalama,' + window.statsData.messaging.avgPerTeam + '\n';
                        window.statsData.messaging.byTeam.forEach(function(team) {
                            csv += 'MesajlaÅŸma,"' + team.name.replace(/"/g, '""') + '",' + team.message_count + '\n';
                        });
                        csv += '\n';

                        // Ä°puÃ§larÄ±
                        csv += 'Ä°puÃ§larÄ±,TakÄ±m BaÅŸÄ±na Ortalama,' + window.statsData.clues.avgPerTeam + '\n';
                        window.statsData.clues.byTeam.forEach(function(team) {
                            csv += 'Ä°puÃ§larÄ±,"' + team.name.replace(/"/g, '""') + '",' + team.clue_count + '\n';
                        });
                        csv += '\n';

                        // En Aktif KullanÄ±cÄ±lar
                        window.statsData.users.mostActive.forEach(function(user, index) {
                            csv += 'En Aktif KullanÄ±cÄ±lar,"' + user.nickname.replace(/"/g, '""') + ' (' + (user.team_name || 'TakÄ±msÄ±z').replace(/"/g, '""') + ')",' + user.message_count + '\n';
                        });
                        csv += '\n';

                        // Puan SÄ±ralamasÄ±
                        window.statsData.scoring.forEach(function(team, index) {
                            csv += 'Puan SÄ±ralamasÄ±,"' + (index + 1) + '. ' + team.name.replace(/"/g, '""') + '",' + team.score + '\n';
                        });

                        var csvBlob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                        var url = URL.createObjectURL(csvBlob);
                        var link = document.createElement('a');
                        link.href = url;
                        link.download = 'istatistikler_' + new Date().getTime() + '.csv';
                        link.click();
                        URL.revokeObjectURL(url);
                        toast('CSV dosyasÄ± indirildi');
                    }
                },

                // OYUN OTURUMU BAÅLAT
                startGameSession: function() {
                    if (!confirm('Yeni bir oyun oturumu baÅŸlatmak istediÄŸinizden emin misiniz?\n\nBu iÅŸlem oyun olaylarÄ±nÄ± kaydetmeye baÅŸlayacak.')) {
                        return;
                    }

                    socket.emit('start-game-session', function(res) {
                        if (res.success) {
                            toast('âœ… Oyun oturumu baÅŸlatÄ±ldÄ±!');
                            console.log('Oyun oturumu ID:', res.sessionId);
                        } else {
                            toast(res.error || 'Oyun baÅŸlatÄ±lamadÄ±!', true);
                        }
                    });
                },

                // OYUN OTURUMUNU BÄ°TÄ°R VE RAPOR OLUÅTUR
                endGameSession: function() {
                    if (!confirm('Oyunu bitirmek ve final raporunu gÃ¶rmek istediÄŸinizden emin misiniz?\n\nBu iÅŸlem geri alÄ±namaz.')) {
                        return;
                    }

                    socket.emit('end-game-session', function(res) {
                        if (res.success) {
                            toast('âœ… Oyun bitti! Rapor gÃ¶steriliyor...');
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
