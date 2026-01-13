// IP Management Module
// Admin IP logs, user management, and photo administration

// Get global functions
const toast = window.toast;
const escapeHtml = window.escapeHtml;
const formatTime = window.formatTime;

export const IP_SECTION = {
    currentTab: 'logs',

    showTab: function(tab) {
        // Tab içeriklerini gizle/göster
        document.getElementById('ipTabContentLogs').style.display = tab === 'logs' ? 'block' : 'none';
        document.getElementById('ipTabContentUsers').style.display = tab === 'users' ? 'block' : 'none';

        // Tab butonlarını güncelle
        var logsBtn = document.getElementById('ipTabLogs');
        var usersBtn = document.getElementById('ipTabUsers');

        logsBtn.classList.remove('btn-primary');
        logsBtn.classList.add('btn');
        usersBtn.classList.remove('btn-primary');
        usersBtn.classList.add('btn');

        if (tab === 'logs') {
            logsBtn.classList.remove('btn');
            logsBtn.classList.add('btn-primary');
            IP_LOGS.loadLogs();
        } else if (tab === 'users') {
            usersBtn.classList.remove('btn');
            usersBtn.classList.add('btn-primary');
            IP_USERS.loadAllUsers();
        }

        this.currentTab = tab;
    }
};

export const IP_LOGS = {
    logs: [],

    loadLogs: function() {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        if (!socketConnected) {
            toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        window.safeSocketEmit('get-ip-logs', null, function(res) {
            if (res && res.success) {
                IP_LOGS.logs = res.logs;
                IP_LOGS.render();
                toast('Loglar yüklendi');
            } else {
                toast(res.error, true);
            }
        });
    },

    render: function() {
        const htmlEscape = window.htmlEscape;
        var container = document.getElementById('ipLogsList');
        var countEl = document.getElementById('ipLogsCount');

        if (!container) return;

        countEl.textContent = this.logs.length + ' kayıt';

        if (this.logs.length === 0) {
            container.innerHTML = '<div style="color:#666; text-align:center; padding:30px;">Son 24 saatte aktivite yok</div>';
            return;
        }

        var html = '';
        this.logs.forEach(function(log) {
            var actionText = log.action === 'register-user' ? 'Kullanıcı Kaydı' : 'Takım Oluşturma';
            var actionColor = log.action === 'register-user' ? '#3b82f6' : '#8b5cf6';
            var maxCount = log.action === 'register-user' ? 3 : 2;
            var isNearLimit = parseInt(log.count) >= maxCount;
            var date = new Date(log.last_activity);
            var timeStr = date.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // GÜVENLİK: onclick için JavaScript string escape
            var safeIP = log.ip_address.replace(/'/g, "\\'").replace(/"/g, '\\"');
            var safeAction = log.action.replace(/'/g, "\\'").replace(/"/g, '\\"');

            html += `
            <div style="background:#1a1a1a; border:1px solid ${isNearLimit ? '#ff4444' : '#333'}; border-radius:8px; padding:15px;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                    <div style="flex:1;">
                        <div style="color:#fff; font-weight:600; margin-bottom:5px;">
                            ${htmlEscape(log.ip_address)}
                        </div>
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                            <span style="background:${actionColor}; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600;">
                                ${actionText}
                            </span>
                            <span style="color:${isNearLimit ? '#ff4444' : '#888'}; font-size:13px; font-weight:600;">
                                ${log.count} / ${maxCount} ${isNearLimit ? '⚠️' : ''}
                            </span>
                        </div>
                        <div style="color:#666; font-size:12px;">
                            Son: ${timeStr}
                        </div>
                    </div>
                    <button class="btn" style="width:auto; padding:8px 16px; margin:0; font-size:12px; ${isNearLimit ? 'background:#ff9800; border-color:#ff9800; color:#000; font-weight:600;' : ''}"
                        onclick="IP_LOGS.clearSpecific('${safeIP}', '${safeAction}')"
                        title="Bu IP'nin ${actionText} hakkını sıfırla">
                        ${isNearLimit ? '🔄 Limiti Sıfırla' : '🗑️ Sıfırla'}
                    </button>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
    },

    clearSpecific: function(ipAddress, action) {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        var actionText = action === 'register-user' ? 'Kullanıcı Kaydı' : 'Takım Oluşturma';
        if (!confirm(`${ipAddress} IP'sinin "${actionText}" logunu sıfırlamak istediğinize emin misiniz?`)) {
            return;
        }

        if (!socketConnected) {
            toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        window.safeSocketEmit('clear-ip-logs', { ipAddress: ipAddress, action: action }, function(res) {
            if (res && res.success) {
                toast('Log sıfırlandı: ' + res.deletedCount + ' kayıt silindi');
                IP_LOGS.loadLogs();
            } else {
                toast(res.error, true);
            }
        });
    },

    clearAll: function() {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        if (!confirm('TÜM IP loglarını sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
            return;
        }

        if (!socketConnected) {
            toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        window.safeSocketEmit('clear-ip-logs', {}, function(res) {
            if (res && res.success) {
                toast('Tüm loglar sıfırlandı: ' + res.deletedCount + ' kayıt silindi');
                IP_LOGS.loadLogs();
            } else {
                toast(res.error, true);
            }
        });
    }
};

export const IP_USERS = {
    users: [],

    loadAllUsers: function() {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        if (!socketConnected) {
            toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        window.safeSocketEmit('get-all-users', null, function(res) {
            if (res && res.success) {
                IP_USERS.users = res.users;
                IP_USERS.render();
                toast('Kullanıcılar yüklendi: ' + res.users.length + ' kayıt');
            } else {
                toast(res.error, true);
            }
        });
    },

    render: function() {
        const htmlEscape = window.htmlEscape;
        var container = document.getElementById('ipUsersList');
        var countEl = document.getElementById('ipUsersCount');

        if (!container) return;

        countEl.textContent = this.users.length + ' kullanıcı';

        if (this.users.length === 0) {
            container.innerHTML = '<div style="color:#666; text-align:center; padding:30px;">Henüz kayıtlı kullanıcı yok</div>';
            return;
        }

        var html = '';
        this.users.forEach(function(user) {
            var onlineStatus = user.online ? '🟢 Online' : '⚫ Offline';
            var onlineColor = user.online ? '#10b981' : '#666';
            var date = new Date(user.created_at);
            var timeStr = date.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            var teamInfo = user.team_name ? `<span style="color:#8b5cf6;">👥 Takım: ${htmlEscape(user.team_name)}</span>` : '<span style="color:#666;">Takımsız</span>';

            // GÜVENLİK: onclick için JavaScript string escape
            var safeNickname = user.nickname.replace(/'/g, "\\'").replace(/"/g, '\\"');

            html += `
            <div style="background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:15px;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1;">
                        <div style="color:#fff; font-weight:600; font-size:16px; margin-bottom:8px;">
                            ${htmlEscape(user.nickname)}
                        </div>
                        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:8px;">
                            <span style="color:${onlineColor}; font-size:12px;">${onlineStatus}</span>
                            ${teamInfo}
                        </div>
                        <div style="color:#666; font-size:12px;">
                            📅 Kayıt: ${timeStr}
                        </div>
                        <div style="color:#888; font-size:11px; margin-top:5px;">
                            🌐 IP: ${htmlEscape(user.ip_address)} • ID: ${user.id}
                        </div>
                    </div>
                    <button class="btn" style="width:auto; padding:8px 16px; margin:0; font-size:12px; background:#dc2626; border-color:#dc2626; color:#fff;"
                        onclick="IP_USERS.deleteUser('${user.id}', '${safeNickname}')"
                        title="Bu kullanıcıyı sil">
                        🗑️ Sil
                    </button>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
    },

    deleteUser: function(userId, nickname) {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        if (!confirm(`"${nickname}" kullanıcısını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz ve başka biri bu nickname ile kaydolabilir.`)) {
            return;
        }

        window.safeSocketEmit('delete-user', userId, function(res) {
            if (res.success) {
                toast('Kullanıcı silindi: ' + res.user.nickname + ' - Nickname artık kullanıma açık!');

                // Listeden çıkar
                IP_USERS.users = IP_USERS.users.filter(u => u.id !== userId);
                IP_USERS.render();
            } else {
                toast(res.error, true);
            }
        });
    },

    deleteAll: function() {
        const socket = window.socket;
        const socketConnected = window.socketConnected;
        const toast = window.toast;

        if (this.users.length === 0) {
            toast('Silinecek kullanıcı yok', true);
            return;
        }

        if (!confirm(`TÜM KULLANICILAR SİLİNECEK! (${this.users.length} kullanıcı)\n\nBu işlem geri alınamaz ve tüm nickname'ler serbest kalacak.\n\nEmin misiniz?`)) {
            return;
        }

        if (!socketConnected) {
            toast('Bağlantı kuruluyor, lütfen bekleyin...', true);
            return;
        }

        window.safeSocketEmit('delete-all-users', null, function(res) {
            if (res && res.success) {
                toast('Tüm kullanıcılar silindi: ' + res.deletedCount + ' kayıt');
                IP_USERS.users = [];
                IP_USERS.render();
            } else {
                toast(res.error, true);
            }
        });
    }
};

export const PHOTO_ADMIN = {
    users: [],
    currentUserId: null,

    loadUsers: function() {
        const toast = window.toast;
        const htmlEscape = window.htmlEscape;

        fetch('/api/admin/users-with-photos', {
            method: 'GET',
            credentials: 'include'
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                PHOTO_ADMIN.users = data.users;
                PHOTO_ADMIN.render();
                toast('Kullanıcılar yüklendi: ' + data.users.length + ' kayıt');
            } else {
                toast(data.error, true);
            }
        })
        .catch(function(err) {
            console.error('Kullanıcı yükleme hatası:', err);
            toast('Kullanıcılar yüklenemedi', true);
        });
    },

    render: function() {
        const htmlEscape = window.htmlEscape;
        var container = document.getElementById('photoUsersList');
        var countEl = document.getElementById('photoUsersCount');

        if (!container) return;

        countEl.textContent = this.users.length + ' kullanıcı';

        if (this.users.length === 0) {
            container.innerHTML = '<div style="color:#666; text-align:center; padding:30px; grid-column: 1/-1;">Henüz kayıtlı kullanıcı yok</div>';
            return;
        }

        var html = '';
        this.users.forEach(function(user) {
            var onlineStatus = user.online ? '🟢 Online' : '⚫ Offline';
            var onlineColor = user.online ? '#10b981' : '#666';

            var teamInfo = user.team_name ?
                `<span style="display:inline-block; padding:4px 8px; background:${user.team_color || '#333'}; border-radius:4px; font-size:11px; color:#fff;">👥 ${htmlEscape(user.team_name)}</span>` :
                '<span style="color:#666; font-size:11px;">Takımsız</span>';

            var photoDisplay = user.profile_photo_url ?
                `<img src="${user.profile_photo_url}" alt="Profil" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--gold);">` :
                '<div style="width:100px; height:100px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center; font-size:40px; color:#666; border:3px solid #444;">👤</div>';

            var safeNickname = user.nickname.replace(/'/g, "\\'").replace(/"/g, '\\"');

            html += `
            <div style="background:#1a1a1a; border:1px solid #333; border-radius:12px; padding:20px; text-align:center;">
                <div style="margin-bottom:15px;">
                    ${photoDisplay}
                </div>
                <div style="color:#fff; font-weight:600; font-size:16px; margin-bottom:8px;">
                    ${htmlEscape(user.nickname)}
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:15px; align-items:center;">
                    <span style="color:${onlineColor}; font-size:12px;">${onlineStatus}</span>
                    ${teamInfo}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <button class="btn" style="margin:0; padding:10px; font-size:12px; background:linear-gradient(135deg, #4a5568, #2d3748);"
                        onclick="PHOTO_ADMIN.changePhoto('${user.id}', '${safeNickname}')">
                        📷 Değiştir
                    </button>
                    <button class="btn" style="margin:0; padding:10px; font-size:12px; background:#dc2626; border-color:#dc2626;"
                        onclick="PHOTO_ADMIN.deletePhoto('${user.id}', '${safeNickname}')"
                        ${user.profile_photo_url ? '' : 'disabled style="opacity:0.5; cursor:not-allowed;"'}>
                        🗑️ Sil
                    </button>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;
    },

    changePhoto: function(userId, nickname) {
        this.currentUserId = userId;
        document.getElementById('adminPhotoInput').click();
    },

    handlePhotoSelect: function(event) {
        const toast = window.toast;
        var file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast('Dosya çok büyük! Maksimum 5MB olmalı.', true);
            event.target.value = '';
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast('Lütfen bir resim dosyası seçin!', true);
            event.target.value = '';
            return;
        }

        if (!this.currentUserId) {
            toast('Kullanıcı seçilmedi', true);
            return;
        }

        var formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', this.currentUserId);

        toast('Fotoğraf yükleniyor...');

        fetch('/api/admin/update-user-photo', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                toast('Fotoğraf güncellendi!');
                PHOTO_ADMIN.loadUsers();
            } else {
                toast(data.error, true);
            }
        })
        .catch(function(err) {
            console.error('Fotoğraf yükleme hatası:', err);
            toast('Fotoğraf yüklenemedi', true);
        })
        .finally(function() {
            event.target.value = '';
            PHOTO_ADMIN.currentUserId = null;
        });
    },

    deletePhoto: function(userId, nickname) {
        const toast = window.toast;

        if (!confirm(`"${nickname}" kullanıcısının profil fotoğrafını silmek istediğinize emin misiniz?`)) {
            return;
        }

        toast('Fotoğraf siliniyor...');

        fetch('/api/admin/delete-user-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userId }),
            credentials: 'include'
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.success) {
                toast('Fotoğraf silindi!');
                PHOTO_ADMIN.loadUsers();
            } else {
                toast(data.error, true);
            }
        })
        .catch(function(err) {
            console.error('Fotoğraf silme hatası:', err);
            toast('Fotoğraf silinemedi', true);
        });
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.IP_SECTION = IP_SECTION;
    window.IP_LOGS = IP_LOGS;
    window.IP_USERS = IP_USERS;
    window.PHOTO_ADMIN = PHOTO_ADMIN;
}
