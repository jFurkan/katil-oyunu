// User Module
// User registration, profile photo, and authentication

export const USER = {

                cameraStream: null, // Aktif kamera stream'i
                selectedPhotoBlob: null, // Seçilen/çekilen fotoğraf

                registerNickname: function() {
                    var nickname = document.getElementById('inpNickname').value.trim();
                    if (!nickname) {
                        toast('Lütfen bir nick girin!', true);
                        return;
                    }

                    if (isProcessing) return;
                    isProcessing = true;

                    window.safeSocketEmit('register-user', nickname, function(res) {
                        isProcessing = false;
                        if (res.success) {
                            // GÜVENLÄ°K: localStorage'a kaydetme, sadece memory'de tut
                            currentUser = {
                                userId: res.userId,
                                nickname: res.nickname,
                                teamId: null,
                                profilePhotoUrl: res.profilePhotoUrl || null
                            };
                            updateCurrentUserDisplay();
                            console.log('âœ… Kayıt başarılı! UserId:', res.userId);

                            // Profil fotoğrafı varsa yükle
                            if (USER.selectedPhotoBlob) {
                                USER.uploadProfilePhoto(function(uploadSuccess) {
                                    if (uploadSuccess) {
                                        console.log('âœ… Profil fotoğrafı yüklendi');
                                    }
                                    // Başarılı ya da değil, sayfaya geç
                                    USER.selectedPhotoBlob = null; // Temizle
                                    showPage('pgLobby');
                                    history.pushState(null, null, '/lobby');
                                    toast('Hoşgeldin, ' + res.nickname + '!');
                                });
                            } else {
                                // Fotoğraf yoksa direkt geç
                                showPage('pgLobby');
                                history.pushState(null, null, '/lobby');
                                toast('Hoşgeldin, ' + res.nickname + '!');
                            }
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Profil fotoğrafı yükleme
                uploadProfilePhoto: function(callback) {
                    if (!this.selectedPhotoBlob) {
                        if (callback) callback(false);
                        return;
                    }

                    var formData = new FormData();
                    formData.append('photo', this.selectedPhotoBlob, 'profile.jpg');

                    fetch('/api/upload-profile-photo', {
                        method: 'POST',
                        body: formData,
                        credentials: 'include'
                    })
                    .then(function(response) { return response.json(); })
                    .then(function(data) {
                        if (data.success) {
                            console.log('âœ… Fotoğraf yüklendi:', data.photoUrl);
                            if (currentUser) {
                                currentUser.profilePhotoUrl = data.photoUrl;
                            }
                            if (callback) callback(true);
                        } else {
                            console.error('âŒ Fotoğraf yükleme hatası:', data.error);
                            toast('Fotoğraf yüklenemedi', true);
                            if (callback) callback(false);
                        }
                    })
                    .catch(function(err) {
                        console.error('âŒ Fotoğraf yükleme hatası:', err);
                        if (callback) callback(false);
                    });
                },

                // Kamera aç
                openCamera: function() {
                    var video = document.getElementById('cameraVideo');
                    var container = document.getElementById('cameraContainer');
                    var buttons = document.getElementById('photoUploadButtons');

                    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                        navigator.mediaDevices.getUserMedia({
                            video: {
                                facingMode: 'user',
                                width: { ideal: 640 },
                                height: { ideal: 640 }
                            }
                        })
                        .then(function(stream) {
                            USER.cameraStream = stream;
                            video.srcObject = stream;
                            container.style.display = 'block';
                            buttons.style.display = 'none';
                        })
                        .catch(function(err) {
                            console.error('Kamera erişim hatası:', err);
                            toast('Kamera açılamadı. Lütfen izinleri kontrol edin.', true);
                        });
                    } else {
                        toast('Kamera desteklenmiyor', true);
                    }
                },

                // Kamera kapat
                closeCamera: function() {
                    if (this.cameraStream) {
                        this.cameraStream.getTracks().forEach(function(track) {
                            track.stop();
                        });
                        this.cameraStream = null;
                    }

                    var video = document.getElementById('cameraVideo');
                    var container = document.getElementById('cameraContainer');
                    var buttons = document.getElementById('photoUploadButtons');

                    video.srcObject = null;
                    container.style.display = 'none';
                    buttons.style.display = 'grid';
                },

                // Fotoğraf çek
                capturePhoto: function() {
                    var video = document.getElementById('cameraVideo');
                    var canvas = document.getElementById('photoCanvas');
                    var ctx = canvas.getContext('2d');

                    // Canvas boyutunu video ile eşitle
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    // Video frame'ini canvas'a çiz
                    ctx.drawImage(video, 0, 0);

                    // Canvas'ı blob'a çevir
                    canvas.toBlob(function(blob) {
                        USER.selectedPhotoBlob = blob;

                        // Önizlemeyi göster
                        var preview = document.getElementById('photoPreview');
                        var previewImg = document.getElementById('photoPreviewImg');
                        previewImg.src = URL.createObjectURL(blob);
                        preview.style.display = 'block';

                        // Kamerayı kapat
                        USER.closeCamera();

                        toast('Fotoğraf çekildi!');
                    }, 'image/jpeg', 0.85);
                },

                // Galeriden dosya seç
                handleFileSelect: function(event) {
                    var file = event.target.files[0];
                    if (!file) return;

                    // Dosya boyutu kontrolü (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        toast('Dosya çok büyük! Maksimum 5MB olmalı.', true);
                        event.target.value = '';
                        return;
                    }

                    // Dosya tipi kontrolü
                    if (!file.type.startsWith('image/')) {
                        toast('Lütfen bir resim dosyası seçin!', true);
                        event.target.value = '';
                        return;
                    }

                    this.selectedPhotoBlob = file;

                    // Önizlemeyi göster
                    var preview = document.getElementById('photoPreview');
                    var previewImg = document.getElementById('photoPreviewImg');
                    previewImg.src = URL.createObjectURL(file);
                    preview.style.display = 'block';

                    toast('Fotoğraf seçildi!');
                },

                // Fotoğrafı kaldır
                removeProfilePhoto: function() {
                    this.selectedPhotoBlob = null;

                    var preview = document.getElementById('photoPreview');
                    var previewImg = document.getElementById('photoPreviewImg');
                    var fileInput = document.getElementById('photoFileInput');

                    preview.style.display = 'none';
                    previewImg.src = '';
                    fileInput.value = '';

                    // Kamera açıksa kapat
                    if (this.cameraStream) {
                        this.closeCamera();
                    }

                    toast('Fotoğraf kaldırıldı');
                },

                logout: function() {
                    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
                        // Cleanup: Tüm timeout'ları temizle
                        clearAllTimeouts();

                        // Fotoğraf verilerini temizle
                        this.selectedPhotoBlob = null;
                        if (this.cameraStream) {
                            this.closeCamera();
                        }

                        // GÜVENLÄ°K: Session'ı temizle
                        currentUser = null;
                        currentTeamId = null;
                        isAdmin = false;

                        // Server'a logout isteği gönder (session'ı temizle)
                        socket.emit('logout-user', function() {
                            // Nick giriş sayfasına yönlendir
                            router.navigate('/');
                            updateCurrentUserDisplay();
                            toast('Çıkış yapıldı.');
                        });
                    }
                }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.USER = USER;
}
