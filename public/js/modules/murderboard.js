// Murder Board Module
// Investigation board with drag-drop, connections, and zoom functionality

export const MURDERBOARD = {

                connectionMode: false,
                connectionStart: null,
                boardItems: [],
                connections: [],
                draggedItem: null,
                dragOffset: { x: 0, y: 0 },
                editingItemId: null,
                allCharacters: [],
                zoomLevel: 1,
                renderScheduled: false, // requestAnimationFrame için flag

                loadAvailableCharacters: function() {
                    // Karakter listesini yükle
                    socket.emit('get-characters-for-board', function(characters) {
                        console.log('Karakterler yüklendi (Murder Board):', characters);
                        MURDERBOARD.allCharacters = characters;
                        MURDERBOARD.updateCharacterDropdown();
                    });
                },

                openMurderBoard: function() {
                    // Karakter listesini yükle
                    MURDERBOARD.loadAvailableCharacters();

                    // Board verilerini yükle
                    MURDERBOARD.loadBoard();

                    // Takım adını göster (UUID değil, takım adı)
                    if (currentUser && currentUser.teamId) {
                        socket.emit('get-team', currentUser.teamId, function(team) {
                            if (team) {
                                document.getElementById('mbTeamName').textContent = team.name;
                            }
                        });
                    } else {
                        document.getElementById('mbTeamName').textContent = 'Takım';
                    }

                    // Zoom sıfırla
                    MURDERBOARD.zoomLevel = 1;
                    MURDERBOARD.updateZoom();

                    // Sayfayı göster
                    showPage('pgMurderBoard', true);
                },

                closeMurderBoard: function() {
                    showPage('pgTeam', false);
                },

                showCharacterSelector: function() {
                    document.getElementById('characterSelectorModal').style.display = 'flex';
                },

                hideCharacterSelector: function() {
                    document.getElementById('characterSelectorModal').style.display = 'none';
                    document.getElementById('characterDropdown').value = '';
                    document.getElementById('characterNote').value = '';
                },

                updateCharacterDropdown: function() {
                    const dropdown = document.getElementById('characterDropdown');
                    dropdown.innerHTML = '<option value="">Karakter seçin...</option>';

                    // Zaten board'a eklenmiş karakter ID'lerini bul
                    const addedCharacterIds = MURDERBOARD.boardItems.map(function(item) {
                        return item.character_id;
                    });

                    // Eklenmemiş karakterleri dropdown'a ekle
                    MURDERBOARD.allCharacters.forEach(function(char) {
                        if (addedCharacterIds.indexOf(char.id) === -1) {
                            const option = document.createElement('option');
                            option.value = char.id;
                            option.textContent = char.name;
                            option.dataset.photoUrl = char.photo_url || '';
                            option.dataset.name = char.name;
                            dropdown.appendChild(option);
                        }
                    });
                },

                showEditNoteModal: function(itemId) {
                    const item = MURDERBOARD.boardItems.find(function(i) { return i.id === itemId; });
                    if (!item) return;

                    MURDERBOARD.editingItemId = itemId;
                    document.getElementById('editCharacterName').textContent = item.character_name;
                    document.getElementById('editNoteTextarea').value = item.note || '';
                    document.getElementById('editNoteModal').style.display = 'flex';
                },

                hideEditNoteModal: function() {
                    document.getElementById('editNoteModal').style.display = 'none';
                    MURDERBOARD.editingItemId = null;
                    document.getElementById('editNoteTextarea').value = '';
                },

                saveEditedNote: function() {
                    if (!MURDERBOARD.editingItemId) return;

                    const newNote = document.getElementById('editNoteTextarea').value.trim();

                    socket.emit('update-board-item-note', {
                        itemId: MURDERBOARD.editingItemId,
                        note: newNote
                    }, function(response) {
                        if (response.success) {
                            toast('âœ… Not güncellendi');
                            MURDERBOARD.hideEditNoteModal();
                            MURDERBOARD.loadBoard();
                        } else {
                            toast(response.error || 'Not güncellenemedi!', true);
                        }
                    });
                },

                addCharacterToBoard: function() {
                    const dropdown = document.getElementById('characterDropdown');
                    const note = document.getElementById('characterNote').value.trim();

                    if (!dropdown.value) {
                        toast('Lütfen bir karakter seçin!', true);
                        return;
                    }

                    const selectedOption = dropdown.options[dropdown.selectedIndex];
                    const characterId = dropdown.value;
                    const characterName = selectedOption.dataset.name;
                    const photoUrl = selectedOption.dataset.photoUrl;

                    // Rastgele pozisyon
                    const x = Math.random() * 300 + 50;
                    const y = Math.random() * 200 + 50;

                    const itemData = {
                        characterId: characterId,
                        characterName: characterName,
                        photoUrl: photoUrl,
                        note: note,
                        x: x,
                        y: y
                    };

                    // Server'a kaydet
                    socket.emit('add-board-item', itemData, function(response) {
                        if (response.success) {
                            toast('âœ… Karakter eklendi');
                            MURDERBOARD.hideCharacterSelector();
                            MURDERBOARD.loadBoard();
                        } else {
                            toast(response.error || 'Karakter eklenemedi!', true);
                        }
                    });
                },

                loadBoard: function() {
                    if (!currentUser || !currentUser.teamId) return;

                    socket.emit('get-board-items', function(data) {
                        MURDERBOARD.boardItems = data.items || [];
                        MURDERBOARD.connections = data.connections || [];
                        MURDERBOARD.renderBoard();
                        MURDERBOARD.updateCharacterDropdown();
                    });
                },

                renderBoard: function() {
                    const canvas = document.getElementById('murderBoardCanvas');
                    const emptyState = document.getElementById('boardEmptyState');
                    const itemCount = document.getElementById('mbItemCount');

                    // Öğe sayısını güncelle
                    itemCount.textContent = MURDERBOARD.boardItems.length;

                    // Empty state kontrolü
                    if (MURDERBOARD.boardItems.length === 0) {
                        emptyState.style.display = 'block';
                    } else {
                        emptyState.style.display = 'none';
                    }

                    // Mevcut öğeleri temizle (SVG hariç)
                    Array.from(canvas.children).forEach(function(child) {
                        if (child.id !== 'connectionsLayer' && child.id !== 'boardEmptyState') {
                            canvas.removeChild(child);
                        }
                    });

                    // Bağlantıları çiz
                    MURDERBOARD.renderConnections();

                    // Karakterleri ekle
                    MURDERBOARD.boardItems.forEach(function(item) {
                        const itemEl = MURDERBOARD.createItemElement(item);
                        canvas.appendChild(itemEl);
                    });
                },

                createItemElement: function(item) {
                    const div = document.createElement('div');
                    div.className = 'board-item';
                    div.dataset.itemId = item.id;
                    div.style.cssText = 'position: absolute; left: ' + item.x + 'px; top: ' + item.y + 'px; width: 120px; background: #fff; border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); cursor: move; user-select: none; -webkit-user-select: none; -webkit-user-drag: none; touch-action: none; z-index: 10;';

                    // Pin efekti
                    const pin = document.createElement('div');
                    pin.style.cssText = 'position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 16px; height: 16px; background: radial-gradient(circle, #d44d4d, #8b0000); border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 1;';
                    div.appendChild(pin);

                    // Fotoğraf veya placeholder
                    if (item.photo_url) {
                        const img = document.createElement('img');
                        img.src = item.photo_url;
                        img.style.cssText = 'width: 100%; height: 100px; object-fit: cover; border-radius: 6px 6px 0 0; display: block;';
                        div.appendChild(img);
                    } else {
                        const placeholder = document.createElement('div');
                        placeholder.style.cssText = 'width: 100%; height: 100px; background: #ddd; border-radius: 6px 6px 0 0; display: flex; align-items: center; justify-content: center; font-size: 48px;';
                        placeholder.textContent = '👤';
                        div.appendChild(placeholder);
                    }

                    // İsim
                    const name = document.createElement('div');
                    name.style.cssText = 'padding: 8px; font-size: 12px; font-weight: 600; color: #000; text-align: center; border-bottom: 1px solid #ddd;';
                    name.textContent = item.character_name;
                    div.appendChild(name);

                    // Not
                    if (item.note) {
                        const note = document.createElement('div');
                        note.style.cssText = 'padding: 6px 8px; font-size: 10px; color: #555; max-height: 60px; overflow-y: auto; font-style: italic;';
                        note.textContent = item.note;
                        div.appendChild(note);
                    }

                    // Sil butonu
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '🗑️';
                    deleteBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(255,255,255,0.9); border: 1px solid #d44d4d; border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer; z-index: 2;';
                    deleteBtn.onclick = function(e) {
                        e.stopPropagation();
                        MURDERBOARD.deleteItem(item.id);
                    };
                    div.appendChild(deleteBtn);

                    // Çift tıklama ile not düzenleme
                    div.addEventListener('dblclick', function(e) {
                        e.stopPropagation();
                        MURDERBOARD.showEditNoteModal(item.id);
                    });

                    // Modern pointer-based drag (hem mouse hem touch için)
                    var isDragging = false;
                    var startPointerX = 0;
                    var startPointerY = 0;
                    var startItemX = 0;
                    var startItemY = 0;
                    var dragStartTime = 0;
                    var hasMoved = false;
                    var offsetX = 0;
                    var offsetY = 0;
                    var lastPointerEventTime = 0; // Pointer event tekrarını önle

                    var getPointerCoords = function(e) {
                        // Touch event'ten koordinat al
                        if (e.touches && e.touches.length) {
                            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                        }
                        // Mouse/pointer event'ten koordinat al
                        return { x: e.clientX, y: e.clientY };
                    };

                    var onPointerDown = function(e) {
                        // Pointer event varsa touch'ı 100ms ignore et (çift tetiklenmeyi önle)
                        if (e.type === 'pointerdown') {
                            lastPointerEventTime = Date.now();
                        } else if (e.type.includes('touch') && Date.now() - lastPointerEventTime < 100) {
                            return; // Touch ignore et
                        }

                        if (MURDERBOARD.connectionMode) {
                            // Connection mode'da drag başlatma, sadece click handle et
                            e.preventDefault();
                            e.stopPropagation();
                            MURDERBOARD.handleConnectionClick(item.id);
                            return;
                        }

                        dragStartTime = Date.now();
                        hasMoved = false;
                        isDragging = true;

                        var coords = getPointerCoords(e);
                        var canvas = document.getElementById('murderBoardCanvas');
                        var canvasRect = canvas.getBoundingClientRect();
                        var zoom = MURDERBOARD.zoomLevel;

                        // Mouse/touch'ın karakter içindeki offsetini hesapla (senkronizasyon için)
                        var canvasX = (coords.x - canvasRect.left) / zoom;
                        var canvasY = (coords.y - canvasRect.top) / zoom;
                        offsetX = canvasX - item.x;
                        offsetY = canvasY - item.y;

                        startPointerX = coords.x;
                        startPointerY = coords.y;
                        startItemX = item.x;
                        startItemY = item.y;

                        div.style.zIndex = '100';
                        div.style.cursor = 'grabbing';

                        e.preventDefault();
                        e.stopPropagation();
                    };

                    var onPointerMove = function(e) {
                        if (!isDragging) return;

                        hasMoved = true;
                        var coords = getPointerCoords(e);
                        var canvas = document.getElementById('murderBoardCanvas');
                        var canvasRect = canvas.getBoundingClientRect();
                        var zoom = MURDERBOARD.zoomLevel;

                        // Mouse/touch pozisyonunu canvas koordinatına çevir ve offset'i çıkar
                        var canvasX = (coords.x - canvasRect.left) / zoom;
                        var canvasY = (coords.y - canvasRect.top) / zoom;

                        var newX = canvasX - offsetX;
                        var newY = canvasY - offsetY;

                        // Negatif değerleri engelle
                        newX = Math.max(0, newX);
                        newY = Math.max(0, newY);

                        div.style.left = newX + 'px';
                        div.style.top = newY + 'px';

                        // Board items'ı güncelle (bağlantılar için)
                        item.x = newX;
                        item.y = newY;

                        MURDERBOARD.scheduleConnectionRender();

                        e.preventDefault();
                        e.stopPropagation();
                    };

                    var onPointerUp = function(e) {
                        if (!isDragging) return;

                        isDragging = false;
                        div.style.zIndex = '10';
                        div.style.cursor = 'move';

                        var dragDuration = Date.now() - dragStartTime;

                        // Çok kısa dokunma ve hareket yoksa (tıklama gibi) - sadece mobilde
                        if (!hasMoved && dragDuration < 200 && e.type.includes('touch')) {
                            MURDERBOARD.showEditNoteModal(item.id);
                        } else if (hasMoved) {
                            // Server'a pozisyonu kaydet
                            socket.emit('update-board-item-position', {
                                itemId: item.id,
                                x: Math.floor(item.x),
                                y: Math.floor(item.y)
                            });
                        }

                        // Tüm document listener'ları temizle
                        document.removeEventListener('pointermove', onPointerMove);
                        document.removeEventListener('pointerup', onPointerUp);
                        document.removeEventListener('pointercancel', onPointerUp);
                        document.removeEventListener('touchmove', onPointerMove);
                        document.removeEventListener('touchend', onPointerUp);
                        document.removeEventListener('touchcancel', onPointerUp);
                        document.removeEventListener('mousemove', onPointerMove);
                        document.removeEventListener('mouseup', onPointerUp);

                        if (e.preventDefault) e.preventDefault();
                    };

                    var onPointerDownHandler = function(e) {
                        // Pointer için özel handler (document listener'ları ekle)
                        onPointerDown(e);
                        if (isDragging && e.type.includes('pointer')) {
                            // Pointer event için document listener'ları ekle
                            document.addEventListener('pointermove', onPointerMove, { passive: false });
                            document.addEventListener('pointerup', onPointerUp);
                            document.addEventListener('pointercancel', onPointerUp);
                        }
                    };

                    var onMouseDown = function(e) {
                        // Mouse için özel handler (document listener'ları ekle)
                        onPointerDown(e);
                        if (isDragging) {
                            document.addEventListener('mousemove', onPointerMove, { passive: false });
                            document.addEventListener('mouseup', onPointerUp);
                        }
                    };

                    var onTouchStart = function(e) {
                        // Touch için özel handler (document listener'ları ekle)
                        onPointerDown(e);
                        if (isDragging) {
                            document.addEventListener('touchmove', onPointerMove, { passive: false });
                            document.addEventListener('touchend', onPointerUp, { passive: false });
                            document.addEventListener('touchcancel', onPointerUp, { passive: false });
                        }
                    };

                    // Pointer events (modern, tüm cihazları destekler)
                    div.addEventListener('pointerdown', onPointerDownHandler, { passive: false });

                    // Fallback: Touch events (eski mobil tarayıcılar için)
                    div.addEventListener('touchstart', onTouchStart, { passive: false });

                    // Fallback: Mouse events (eski tarayıcılar için)
                    div.addEventListener('mousedown', onMouseDown, { passive: false });

                    return div;
                },

                startDrag: function(e, itemId) {
                    const item = MURDERBOARD.boardItems.find(function(i) { return i.id === itemId; });
                    if (!item) return;

                    MURDERBOARD.draggedItem = item;

                    const itemEl = document.querySelector('[data-item-id="' + itemId + '"]');
                    const canvasRect = document.getElementById('murderBoardCanvas').getBoundingClientRect();

                    // Zoom'u hesaba katarak offset hesapla
                    const zoom = MURDERBOARD.zoomLevel;
                    const canvasX = (e.clientX - canvasRect.left) / zoom;
                    const canvasY = (e.clientY - canvasRect.top) / zoom;

                    MURDERBOARD.dragOffset = {
                        x: canvasX - item.x,
                        y: canvasY - item.y
                    };

                    itemEl.style.zIndex = '100';

                    document.addEventListener('mousemove', MURDERBOARD.onDrag);
                    document.addEventListener('mouseup', MURDERBOARD.stopDrag);
                    document.addEventListener('touchmove', MURDERBOARD.onDragTouch, { passive: false });
                    document.addEventListener('touchend', MURDERBOARD.stopDrag);
                },

                onDrag: function(e) {
                    if (!MURDERBOARD.draggedItem) return;

                    e.preventDefault(); // Canvas scroll'u engelle

                    const canvasRect = document.getElementById('murderBoardCanvas').getBoundingClientRect();
                    const zoom = MURDERBOARD.zoomLevel;

                    // Zoom'u hesaba katarak pozisyon hesapla
                    const canvasX = (e.clientX - canvasRect.left) / zoom;
                    const canvasY = (e.clientY - canvasRect.top) / zoom;

                    const x = canvasX - MURDERBOARD.dragOffset.x;
                    const y = canvasY - MURDERBOARD.dragOffset.y;

                    const itemEl = document.querySelector('[data-item-id="' + MURDERBOARD.draggedItem.id + '"]');
                    itemEl.style.left = x + 'px';
                    itemEl.style.top = y + 'px';

                    // Drag sırasında boardItems'daki pozisyonu da güncelle (bağlantılar için)
                    MURDERBOARD.draggedItem.x = x;
                    MURDERBOARD.draggedItem.y = y;

                    // requestAnimationFrame ile optimize render (performans için)
                    MURDERBOARD.scheduleConnectionRender();
                },

                scheduleConnectionRender: function() {
                    if (MURDERBOARD.renderScheduled) return;

                    MURDERBOARD.renderScheduled = true;
                    requestAnimationFrame(function() {
                        MURDERBOARD.renderConnections();
                        MURDERBOARD.renderScheduled = false;
                    });
                },

                onDragTouch: function(e) {
                    e.preventDefault(); // Touch scroll'u engelle
                    MURDERBOARD.onDrag(e.touches[0]);
                },

                stopDrag: function() {
                    if (!MURDERBOARD.draggedItem) return;

                    const itemEl = document.querySelector('[data-item-id="' + MURDERBOARD.draggedItem.id + '"]');
                    itemEl.style.zIndex = '10';

                    const x = parseInt(itemEl.style.left);
                    const y = parseInt(itemEl.style.top);

                    socket.emit('update-board-item-position', {
                        itemId: MURDERBOARD.draggedItem.id,
                        x: x,
                        y: y
                    });

                    MURDERBOARD.draggedItem.x = x;
                    MURDERBOARD.draggedItem.y = y;
                    MURDERBOARD.draggedItem = null;

                    document.removeEventListener('mousemove', MURDERBOARD.onDrag);
                    document.removeEventListener('mouseup', MURDERBOARD.stopDrag);
                    document.removeEventListener('touchmove', MURDERBOARD.onDragTouch, { passive: false });
                    document.removeEventListener('touchend', MURDERBOARD.stopDrag);
                },

                toggleConnectionMode: function() {
                    MURDERBOARD.connectionMode = !MURDERBOARD.connectionMode;
                    MURDERBOARD.connectionStart = null;

                    const btn = document.getElementById('btnAddConnection');
                    if (MURDERBOARD.connectionMode) {
                        btn.style.background = 'linear-gradient(135deg, #1a4d1a, #0d3310)';
                        btn.style.borderColor = '#4dd44d';
                        btn.style.color = '#4dd44d';
                        toast('🔗 Bağlantı modu aktif - İki karakter seçin');
                    } else {
                        btn.style.background = 'linear-gradient(135deg, #4d4d1a, #333310)';
                        btn.style.borderColor = '#d4d44d';
                        btn.style.color = '#d4d44d';
                    }
                },

                handleConnectionClick: function(itemId) {
                    if (!MURDERBOARD.connectionStart) {
                        MURDERBOARD.connectionStart = itemId;
                        toast('İkinci karakteri seçin');
                    } else {
                        if (MURDERBOARD.connectionStart === itemId) {
                            toast('Aynı karaktere bağlantı eklenemez!', true);
                            MURDERBOARD.connectionStart = null;
                            return;
                        }

                        socket.emit('add-board-connection', {
                            fromItemId: MURDERBOARD.connectionStart,
                            toItemId: itemId
                        }, function(response) {
                            if (response.success) {
                                toast('âœ… Bağlantı eklendi - Başka bir karakter seçerek devam edebilirsiniz');
                                MURDERBOARD.loadBoard();
                                // Bağlantı modunu kapatma - devam edebilsin
                                MURDERBOARD.connectionStart = null; // Sadece başlangıç noktasını sıfırla
                            } else {
                                toast(response.error || 'Bağlantı eklenemedi!', true);
                            }
                        });
                    }
                },

                renderConnections: function() {
                    const svg = document.getElementById('connectionsLayer');
                    const canvas = document.getElementById('murderBoardCanvas');
                    svg.innerHTML = '';

                    // Tüm karakterlerin pozisyonlarını kontrol ederek gerekli canvas boyutunu hesapla
                    let maxX = 800; // Minimum genişlik
                    let maxY = 600; // Minimum yükseklik

                    MURDERBOARD.boardItems.forEach(function(item) {
                        const itemRight = item.x + 120; // Karakter genişliği
                        const itemBottom = item.y + 100; // Karakter yüksekliği
                        if (itemRight > maxX) maxX = itemRight;
                        if (itemBottom > maxY) maxY = itemBottom;
                    });

                    // Canvas boyutunu güncelle (padding ekle)
                    canvas.style.minWidth = (maxX + 100) + 'px';
                    canvas.style.minHeight = (maxY + 100) + 'px';

                    // SVG boyutunu canvas boyutuna eşitle
                    svg.style.width = (maxX + 100) + 'px';
                    svg.style.height = (maxY + 100) + 'px';

                    // Add defs for arrow markers and glow effects
                    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

                    // Arrow marker
                    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                    marker.setAttribute('id', 'arrowhead');
                    marker.setAttribute('markerWidth', '10');
                    marker.setAttribute('markerHeight', '10');
                    marker.setAttribute('refX', '9');
                    marker.setAttribute('refY', '3');
                    marker.setAttribute('orient', 'auto');

                    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '0 0, 10 3, 0 6');
                    polygon.setAttribute('fill', '#d44d4d');
                    marker.appendChild(polygon);
                    defs.appendChild(marker);

                    // Glow filter
                    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                    filter.setAttribute('id', 'glow');
                    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
                    feGaussianBlur.setAttribute('stdDeviation', '2.5');
                    feGaussianBlur.setAttribute('result', 'coloredBlur');
                    filter.appendChild(feGaussianBlur);

                    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
                    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
                    feMergeNode1.setAttribute('in', 'coloredBlur');
                    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
                    feMergeNode2.setAttribute('in', 'SourceGraphic');
                    feMerge.appendChild(feMergeNode1);
                    feMerge.appendChild(feMergeNode2);
                    filter.appendChild(feMerge);
                    defs.appendChild(filter);

                    svg.appendChild(defs);

                    MURDERBOARD.connections.forEach(function(conn) {
                        const fromItem = MURDERBOARD.boardItems.find(function(i) { return i.id === conn.from_item_id; });
                        const toItem = MURDERBOARD.boardItems.find(function(i) { return i.id === conn.to_item_id; });

                        if (!fromItem || !toItem) return;

                        const fromX = fromItem.x + 60;
                        const fromY = fromItem.y + 50;
                        const toX = toItem.x + 60;
                        const toY = toItem.y + 50;

                        // Create curved path instead of straight line
                        const midX = (fromX + toX) / 2;
                        const midY = (fromY + toY) / 2;

                        // Calculate control point for curve (perpendicular offset)
                        const dx = toX - fromX;
                        const dy = toY - fromY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const offset = Math.min(dist * 0.2, 50); // Curve intensity

                        const controlX = midX + (-dy / dist) * offset;
                        const controlY = midY + (dx / dist) * offset;

                        // Create path element for curved line
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        const pathData = `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
                        path.setAttribute('d', pathData);
                        path.setAttribute('stroke', '#d44d4d');
                        path.setAttribute('stroke-width', '2.5');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('marker-end', 'url(#arrowhead)');
                        path.setAttribute('filter', 'url(#glow)');
                        path.style.cursor = 'pointer';
                        path.style.transition = 'all 0.3s ease';

                        // Animated dashes
                        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
                        animate.setAttribute('attributeName', 'stroke-dasharray');
                        animate.setAttribute('from', '0, 10');
                        animate.setAttribute('to', '10, 0');
                        animate.setAttribute('dur', '0.5s');
                        animate.setAttribute('repeatCount', 'indefinite');
                        path.appendChild(animate);

                        // Hover effects
                        path.addEventListener('mouseenter', function() {
                            path.setAttribute('stroke-width', '4');
                            path.setAttribute('stroke', '#ff6b6b');
                        });

                        path.addEventListener('mouseleave', function() {
                            path.setAttribute('stroke-width', '2.5');
                            path.setAttribute('stroke', '#d44d4d');
                        });

                        path.addEventListener('click', function() {
                            if (confirm('Bu bağlantıyı silmek istiyor musunuz?')) {
                                MURDERBOARD.deleteConnection(conn.id);
                            }
                        });

                        svg.appendChild(path);

                        // Add connection label if notes exist
                        if (conn.notes && conn.notes.trim()) {
                            const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            labelG.style.cursor = 'pointer';

                            // Label background
                            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            const textWidth = Math.min(conn.notes.length * 7, 100);
                            labelBg.setAttribute('x', controlX - textWidth/2);
                            labelBg.setAttribute('y', controlY - 10);
                            labelBg.setAttribute('width', textWidth);
                            labelBg.setAttribute('height', '20');
                            labelBg.setAttribute('fill', 'rgba(0, 0, 0, 0.8)');
                            labelBg.setAttribute('rx', '4');
                            labelBg.setAttribute('stroke', '#d44d4d');
                            labelBg.setAttribute('stroke-width', '1');

                            // Label text
                            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            labelText.setAttribute('x', controlX);
                            labelText.setAttribute('y', controlY + 4);
                            labelText.setAttribute('text-anchor', 'middle');
                            labelText.setAttribute('fill', '#fff');
                            labelText.setAttribute('font-size', '11');
                            labelText.setAttribute('font-weight', '600');
                            labelText.textContent = conn.notes.length > 12 ? conn.notes.substring(0, 12) + '...' : conn.notes;

                            labelG.appendChild(labelBg);
                            labelG.appendChild(labelText);

                            labelG.addEventListener('click', function() {
                                alert('Bağlantı Notu: ' + conn.notes);
                            });

                            svg.appendChild(labelG);
                        }
                    });
                },

                deleteItem: function(itemId) {
                    if (!confirm('Bu karakteri kaldırmak istiyor musunuz?')) return;

                    socket.emit('delete-board-item', itemId, function(response) {
                        if (response.success) {
                            toast('🗑️ Karakter kaldırıldı');
                            MURDERBOARD.loadBoard();
                        } else {
                            toast(response.error || 'Karakter kaldırılamadı!', true);
                        }
                    });
                },

                deleteConnection: function(connectionId) {
                    socket.emit('delete-board-connection', connectionId, function(response) {
                        if (response.success) {
                            toast('🗑️ Bağlantı silindi');
                            MURDERBOARD.loadBoard();
                        } else {
                            toast(response.error || 'Bağlantı silinemedi!', true);
                        }
                    });
                },

                clearBoard: function() {
                    if (!confirm('Tüm murder board\'u temizlemek istediğinizden emin misiniz?')) return;

                    socket.emit('clear-board', function(response) {
                        if (response.success) {
                            toast('🗑️ Murder board temizlendi');
                            MURDERBOARD.loadBoard();
                        } else {
                            toast(response.error || 'Temizlenemedi!', true);
                        }
                    });
                },

                // Zoom fonksiyonları
                zoomIn: function() {
                    MURDERBOARD.zoomLevel = Math.min(MURDERBOARD.zoomLevel + 0.1, 2);
                    MURDERBOARD.updateZoom();
                },

                zoomOut: function() {
                    MURDERBOARD.zoomLevel = Math.max(MURDERBOARD.zoomLevel - 0.1, 0.3);
                    MURDERBOARD.updateZoom();
                },

                resetZoom: function() {
                    MURDERBOARD.zoomLevel = 1;
                    MURDERBOARD.updateZoom();
                },

                updateZoom: function() {
                    const canvas = document.getElementById('murderBoardCanvas');
                    if (canvas) {
                        // Transform uygula
                        canvas.style.transform = 'scale(' + MURDERBOARD.zoomLevel + ')';

                        // Canvas boyutunu zoom seviyesine göre ayarla (scrollbar için)
                        const baseWidth = 800;
                        const baseHeight = 600;
                        canvas.style.minWidth = baseWidth + 'px';
                        canvas.style.minHeight = baseHeight + 'px';
                    }

                    // Zoom yüzdesini güncelle
                    const zoomDisplay = document.getElementById('zoomLevel');
                    if (zoomDisplay) {
                        zoomDisplay.textContent = Math.round(MURDERBOARD.zoomLevel * 100) + '%';
                    }
                }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.MURDERBOARD = MURDERBOARD;
}
