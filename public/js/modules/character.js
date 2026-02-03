// Character Management Module
// Admin interface for managing game characters

// Get global functions

export const CHARACTER = {
    addCharacter() {
        const socket = window.socket;

        const name = document.getElementById('charName').value.trim();
        const photoUrl = document.getElementById('charPhotoUrl').value.trim();
        const description = document.getElementById('charDescription').value.trim();
        const age = document.getElementById('charAge').value;
        const occupation = document.getElementById('charOccupation').value.trim();
        const additionalInfo = document.getElementById('charAdditionalInfo').value.trim();

        // Validation
        if (!name) {
            window.toast('Karakter ismi zorunludur!', true);
            return;
        }

        // Send to socket (default: not visible)
        window.safeSocketEmit('add-character', {
            name: name,
            photoUrl: photoUrl || null,
            description: description || null,
            age: age ? parseInt(age) : null,
            occupation: occupation || null,
            additionalInfo: additionalInfo || null,
            visibleToTeams: false
        }, (response) => {
            if (response.success) {
                window.toast('✅ Karakter başarıyla eklendi! Görünürlüğünü "Oyun Kontrolü" bölümünden ayarlayabilirsiniz.');

                // Clear form
                document.getElementById('charName').value = '';
                document.getElementById('charPhotoUrl').value = '';
                document.getElementById('charDescription').value = '';
                document.getElementById('charAge').value = '';
                document.getElementById('charOccupation').value = '';
                document.getElementById('charAdditionalInfo').value = '';

                // Refresh list
                this.loadCharacters();
                if (window.ADMIN) {
                    window.ADMIN.loadGameCharacters(); // Update game control list
                }
            } else {
                window.toast(response.error || 'Karakter eklenemedi!', true);
            }
        });
    },

    loadCharacters() {
        window.safeSocketEmit('get-characters', (response) => {
            if (response && response.success) {
                this.renderCharacters(response.characters || []);
            } else {
                this.renderCharacters([]);
            }
        });
    },

    renderCharacters(characters) {
        const container = document.getElementById('charactersList');
        const countSpan = document.getElementById('characterCount');
        const escapeHtml = window.escapeHtml;

        if (!container || !countSpan) return;

        countSpan.textContent = characters.length + ' karakter';

        if (characters.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #555;">
                    <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">👤</div>
                    <div style="font-size: 14px;">Henüz karakter eklenmemiş</div>
                </div>
            `;
            return;
        }

        let html = '';
        characters.forEach(char => {
            html += `
                <div style="background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                    <div style="display: flex; gap: 15px; align-items: start;">
                        ${char.photo_url ? `
                            <img src="${char.photo_url}" alt="${char.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px solid #444;">
                        ` : `
                            <div style="width: 80px; height: 80px; background: #222; border-radius: 8px; border: 2px solid #444; display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>
                        `}

                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <h4 style="color: #4dd4d4; margin: 0; font-size: 16px; font-weight: 600;">${window.escapeHtml(char.name)}</h4>
                                    <div style="margin-top: 4px;">
                                        <span style="display: inline-block; padding: 2px 8px; background: ${char.visible_to_teams ? '#1a4d1a' : '#4d4d1a'}; border: 1px solid ${char.visible_to_teams ? '#4dd44d' : '#888'}; color: ${char.visible_to_teams ? '#4dd44d' : '#888'}; border-radius: 4px; font-size: 10px;">
                                            ${char.visible_to_teams ? '👁️ Görünür' : '🔒 Gizli'}
                                        </span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    <button onclick="CHARACTER.openPhotoSelectorForChar('${char.id}')" style="background: #1a3a4a; border: 1px solid #2a6a7a; color: #6dd4e4; padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#1f4f60'" onmouseout="this.style.background='#1a3a4a'">📸 Fotoğraf</button>
                                    <button onclick="CHARACTER.deleteCharacter('${char.id}')" style="background: #500; border: 1px solid #800; color: #faa; padding: 4px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#700'" onmouseout="this.style.background='#500'">🗑️ Sil</button>
                                </div>
                            </div>

                            ${char.age || char.occupation ? `
                                <div style="display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
                                    ${char.age ? `<span style="color: #888; font-size: 12px;">📅 ${char.age} yaşında</span>` : ''}
                                    ${char.occupation ? `<span style="color: #888; font-size: 12px;">💼 ${window.escapeHtml(char.occupation)}</span>` : ''}
                                </div>
                            ` : ''}

                            ${char.description ? `
                                <p style="color: #aaa; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5;">${window.escapeHtml(char.description)}</p>
                            ` : ''}

                            ${char.additional_info ? `
                                <details style="margin-top: 8px;">
                                    <summary style="color: #666; font-size: 12px; cursor: pointer; user-select: none;">Ek Bilgiler</summary>
                                    <p style="color: #888; font-size: 12px; margin: 8px 0 0 0; padding-left: 12px; border-left: 2px solid #333; line-height: 1.5;">${window.escapeHtml(char.additional_info)}</p>
                                </details>
                            ` : ''}

                            <div style="color: #555; font-size: 11px; margin-top: 8px;">
                                Eklendi: ${new Date(char.created_at).toLocaleString('tr-TR')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    deleteCharacter(characterId) {
        if (!confirm('Bu karakteri silmek istediğinizden emin misiniz?')) {
            return;
        }

        const socket = window.socket;

        window.safeSocketEmit('delete-character', characterId, (response) => {
            if (response.success) {
                window.toast('🗑️ Karakter silindi');
                this.loadCharacters();
                if (window.ADMIN) {
                    window.ADMIN.loadGameCharacters(); // Update game control list
                }
            } else {
                window.toast(response.error || 'Karakter silinemedi!', true);
            }
        });
    },

    openPhotoSelectorForChar(characterId) {
        this._editingCharacterId = characterId;
        this._loadPhotoSelector();
    },

    openPhotoSelector() {
        this._editingCharacterId = null;
        this._loadPhotoSelector();
    },

    _loadPhotoSelector() {
        const modal = document.getElementById('photoSelectorModal');
        if (modal) {
            modal.style.display = 'flex';
        }

        // Get uploaded photos
        window.safeSocketEmit('get-uploaded-photos', (response) => {
            const gallery = document.getElementById('photoGallery');
            if (!gallery) return;

            if (!response || !response.success || !response.photos || response.photos.length === 0) {
                gallery.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #555;">
                        <div style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">📂</div>
                        <div style="font-size: 14px;">Henüz fotoğraf yüklenmemiş</div>
                        <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">Fotoğrafları <code style="background: #222; padding: 2px 6px; border-radius: 3px;">public/uploads/characters/</code> klasörüne yükleyin</div>
                    </div>
                `;
                return;
            }

            // List photos
            let html = '';
            response.photos.forEach(photoUrl => {
                html += `
                    <div onclick="CHARACTER.selectPhoto('${photoUrl}')" style="cursor: pointer; border: 2px solid #333; border-radius: 8px; overflow: hidden; transition: all 0.2s; aspect-ratio: 1;" onmouseover="this.style.borderColor='#4dd4d4'; this.style.transform='scale(1.05)'" onmouseout="this.style.borderColor='#333'; this.style.transform='scale(1)'">
                        <img src="${photoUrl}" alt="Karakter" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    </div>
                `;
            });

            gallery.innerHTML = html;
        });
    },

    closePhotoSelector() {
        const modal = document.getElementById('photoSelectorModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    selectPhoto(photoUrl) {
        this.closePhotoSelector();

        // Mevcut karakter düzenleme modunda
        if (this._editingCharacterId) {
            const charId = this._editingCharacterId;
            this._editingCharacterId = null;

            window.safeSocketEmit('update-character-photo', {
                characterId: charId,
                photoUrl: photoUrl
            }, (response) => {
                if (response && response.success) {
                    window.toast('✅ Karakter fotoğrafı güncellendi');
                    this.loadCharacters();
                } else {
                    window.toast((response && response.error) || 'Fotoğraf güncellenemedi!', true);
                }
            });
            return;
        }

        // Yeni karakter ekleme modunda — sadece input'a doldur
        const input = document.getElementById('charPhotoUrl');
        if (input) {
            input.value = photoUrl;
        }
        window.toast('✅ Fotoğraf seçildi');
    }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.CHARACTER = CHARACTER;
}
