// Admin Board Monitoring Module
// Admin interface for viewing team murder boards

// Get global functions
const toast = window.toast;
const escapeHtml = window.escapeHtml;

export const ADMIN_BOARD = {
    selectedTeamId: null,
    boardItems: [],
    connections: [],
    zoomLevel: 1,

    init: function() {
        // Takımları yükle
        this.loadTeams();
    },

    loadTeams: function() {
        const self = this;
        window.safeSocketEmit('admin-get-teams', null, function(res) {
            const select = document.getElementById('adminBoardTeamSelect');
            if (!select) {
                console.error('adminBoardTeamSelect bulunamadı!');
                return;
            }

            select.innerHTML = '<option value="">-- Takım Seçin --</option>';

            if (!res || !res.success || !res.teams || res.teams.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Henüz takım oluşturulmamış';
                option.disabled = true;
                select.appendChild(option);
                return;
            }

            res.teams.forEach(function(team) {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name + ' (' + team.score + ' puan)';
                select.appendChild(option);
            });
        });
    },

    selectTeam: function(teamId) {
        const socket = window.socket;
        if (!teamId) {
            // Seçim kaldırıldı
            this.selectedTeamId = null;
            document.getElementById('adminBoardViewContainer').style.display = 'none';
            document.getElementById('adminBoardEmptyStateMain').style.display = 'block';
            return;
        }

        this.selectedTeamId = teamId;
        document.getElementById('adminBoardViewContainer').style.display = 'block';
        document.getElementById('adminBoardEmptyStateMain').style.display = 'none';

        // Seçili takımın bilgilerini göster
        window.safeSocketEmit('admin-get-teams', null, function(res) {
            if (!res || !res.success) return;
            const team = res.teams.find(function(t) { return t.id === teamId; });
            if (team) {
                document.getElementById('adminBoardTeamName').textContent = team.name;
                document.getElementById('adminBoardTeamName').style.color = team.color || '#4dd4d4';
            }
        });

        // Board'u yükle
        this.loadBoard();
    },

    loadBoard: function() {
        if (!this.selectedTeamId) return;

        const self = this;
        window.safeSocketEmit('get-team-board', this.selectedTeamId, function(response) {
            if (response && response.success) {
                self.boardItems = response.items || [];
                self.connections = response.connections || [];
            } else {
                self.boardItems = [];
                self.connections = [];
            }

            // Sayıları güncelle
            document.getElementById('adminBoardItemCount').textContent = self.boardItems.length;
            document.getElementById('adminBoardConnectionCount').textContent = self.connections.length;

            // Board'u render et
            self.renderBoard();
        });
    },

    renderBoard: function() {
        const escapeHtml = window.escapeHtml;
        const canvas = document.getElementById('adminBoardCanvas');
        const emptyState = document.getElementById('adminBoardEmptyState');

        // Mevcut öğeleri temizle (SVG ve boş durum hariç)
        Array.from(canvas.children).forEach(function(child) {
            if (child.id !== 'adminConnectionsLayer' && child.id !== 'adminBoardEmptyState') {
                canvas.removeChild(child);
            }
        });

        // Boş durum kontrolü
        if (this.boardItems.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Karakterleri render et
        this.boardItems.forEach(function(item) {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = item.x + 'px';
            div.style.top = item.y + 'px';
            div.style.width = '120px';
            div.style.background = 'linear-gradient(135deg, #1a1a1a, #0a0a0a)';
            div.style.border = '2px solid #333';
            div.style.borderRadius = '12px';
            div.style.padding = '10px';
            div.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
            div.style.zIndex = '10';
            div.style.cursor = 'default';

            let html = '';

            // Fotoğraf
            if (item.photo_url) {
                html += '<img src="' + item.photo_url + '" alt="' + escapeHtml(item.character_name) + '" style="width:100%; height:80px; object-fit:cover; border-radius:8px; margin-bottom:8px; border:1px solid #444;">';
            } else {
                html += '<div style="width:100%; height:80px; background:#222; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:center; font-size:32px; border:1px solid #444;">👤</div>';
            }

            // İsim
            html += '<div style="color:#4dd4d4; font-weight:600; font-size:13px; margin-bottom:5px; text-align:center;">' + escapeHtml(item.character_name) + '</div>';

            // Not (varsa)
            if (item.note) {
                html += '<div style="color:#888; font-size:11px; line-height:1.4; margin-top:5px; padding:6px; background:#000; border-radius:6px; max-height:60px; overflow-y:auto;">' + escapeHtml(item.note) + '</div>';
            }

            div.innerHTML = html;
            canvas.appendChild(div);
        });

        // Bağlantıları çiz
        this.renderConnections();
    },

    renderConnections: function() {
        const svg = document.getElementById('adminConnectionsLayer');
        const canvas = document.getElementById('adminBoardCanvas');
        svg.innerHTML = '';

        // Canvas boyutunu hesapla (MURDERBOARD ile aynı mantık)
        let maxX = 800;
        let maxY = 600;

        this.boardItems.forEach(function(item) {
            const itemRight = item.x + 120;
            const itemBottom = item.y + 100;
            if (itemRight > maxX) maxX = itemRight;
            if (itemBottom > maxY) maxY = itemBottom;
        });

        canvas.style.minWidth = (maxX + 100) + 'px';
        canvas.style.minHeight = (maxY + 100) + 'px';
        svg.style.width = (maxX + 100) + 'px';
        svg.style.height = (maxY + 100) + 'px';

        const self = this;
        this.connections.forEach(function(conn) {
            const fromItem = self.boardItems.find(function(i) { return i.id === conn.from_item_id; });
            const toItem = self.boardItems.find(function(i) { return i.id === conn.to_item_id; });

            if (!fromItem || !toItem) return;

            const fromX = fromItem.x + 60;
            const fromY = fromItem.y + 50;
            const toX = toItem.x + 60;
            const toY = toItem.y + 50;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', fromX);
            line.setAttribute('y1', fromY);
            line.setAttribute('x2', toX);
            line.setAttribute('y2', toY);
            line.setAttribute('stroke', '#d44d4d');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('stroke-dasharray', '5,5');

            svg.appendChild(line);
        });
    },

    refreshBoard: function() {
        const toast = window.toast;
        if (this.selectedTeamId) {
            this.loadBoard();
            toast('🔄 Board yenilendi');
        }
    },

    // Zoom fonksiyonları
    zoomIn: function() {
        this.zoomLevel = Math.min(this.zoomLevel + 0.1, 2);
        this.updateZoom();
    },

    zoomOut: function() {
        this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.3);
        this.updateZoom();
    },

    resetZoom: function() {
        this.zoomLevel = 1;
        this.updateZoom();
    },

    updateZoom: function() {
        const canvas = document.getElementById('adminBoardCanvas');
        if (canvas) {
            canvas.style.transform = 'scale(' + this.zoomLevel + ')';
        }
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.ADMIN_BOARD = ADMIN_BOARD;
}
