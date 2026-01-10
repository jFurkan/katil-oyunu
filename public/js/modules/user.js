// User Module
// User registration, profile photo, and authentication

export const USER = {

                cameraStream: null, // Aktif kamera stream'i
                selectedPhotoBlob: null, // SeÃ§ilen/Ã§ekilen fotoÄŸraf

                registerNickname: function() {
                    var nickname = document.getElementById('inpNickname').value.trim();
                    if (!nickname) {
                        toast('LÃ¼tfen bir nick girin!', true);
                        return;
                    }

                    // Socket baÄŸlantÄ±sÄ± kontrolÃ¼
                    if (!socketConnected) {
                        toast('BaÄŸlantÄ± kuruluyor, lÃ¼tfen bekleyin...', true);
                        return;
                    }

                    if (isProcessing) return;
                    isProcessing = true;

                    socket.emit('register-user', nickname, function(res) {
                        isProcessing = false;
                        if (res.success) {
                            // GÃœVENLÄ°K: localStorage'a kaydetme, sadece memory'de tut
                            currentUser = {
                                userId: res.userId,
                                nickname: res.nickname,
                                teamId: null,
                                profilePhotoUrl: res.profilePhotoUrl || null
                            };
                            updateCurrentUserDisplay();
                            console.log('âœ… KayÄ±t baÅŸarÄ±lÄ±! UserId:', res.userId);

                            // Profil fotoÄŸrafÄ± varsa yÃ¼kle
                            if (USER.selectedPhotoBlob) {
                                USER.uploadProfilePhoto(function(uploadSuccess) {
                                    if (uploadSuccess) {
                                        console.log('âœ… Profil fotoÄŸrafÄ± yÃ¼klendi');
                                    }
                                    // BaÅŸarÄ±lÄ± ya da deÄŸil, sayfaya geÃ§
                                    USER.selectedPhotoBlob = null; // Temizle
                                    showPage('pgLobby');
                                    history.pushState(null, null, '/lobby');
                                    toast('HoÅŸgeldin, ' + res.nickname + '!');
                                });
                            } else {
                                // FotoÄŸraf yoksa direkt geÃ§
                                showPage('pgLobby');
                                history.pushState(null, null, '/lobby');
                                toast('HoÅŸgeldin, ' + res.nickname + '!');
                            }
                        } else {
                            toast(res.error, true);
                        }
                    });
                },

                // Profil fotoÄŸrafÄ± yÃ¼kleme
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
                            console.log('âœ… FotoÄŸraf yÃ¼klendi:', data.photoUrl);
                            if (currentUser) {
                                currentUser.profilePhotoUrl = data.photoUrl;
                            }
                            if (callback) callback(true);
                        } else {
                            console.error('âŒ FotoÄŸraf yÃ¼kleme hatasÄ±:', data.error);
                            toast('FotoÄŸraf yÃ¼klenemedi', true);
                            if (callback) callback(false);
                        }
                    })
                    .catch(function(err) {
                        console.error('âŒ FotoÄŸraf yÃ¼kleme hatasÄ±:', err);
                        if (callback) callback(false);
                    });
                },

                // Kamera aÃ§
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
                            console.error('Kamera eriÅŸim hatasÄ±:', err);
                            toast('Kamera aÃ§Ä±lamadÄ±. LÃ¼tfen izinleri kontrol edin.', true);
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

                // FotoÄŸraf Ã§ek
                capturePhoto: function() {
                    var video = document.getElementById('cameraVideo');
                    var canvas = document.getElementById('photoCanvas');
                    var ctx = canvas.getContext('2d');

                    // Canvas boyutunu video ile eÅŸitle
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    // Video frame'ini canvas'a Ã§iz
                    ctx.drawImage(video, 0, 0);

                    // Canvas'Ä± blob'a Ã§evir
                    canvas.toBlob(function(blob) {
                        USER.selectedPhotoBlob = blob;

                        // Ã–nizlemeyi gÃ¶ster
                        var preview = document.getElementById('photoPreview');
                        var previewImg = document.getElementById('photoPreviewImg');
                        previewImg.src = URL.createObjectURL(blob);
                        preview.style.display = 'block';

                        // KamerayÄ± kapat
                        USER.closeCamera();

                        toast('FotoÄŸraf Ã§ekildi!');
                    }, 'image/jpeg', 0.85);
                },

                // Galeriden dosya seÃ§
                handleFileSelect: function(event) {
                    var file = event.target.files[0];
                    if (!file) return;

                    // Dosya boyutu kontrolÃ¼ (5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        toast('Dosya Ã§ok bÃ¼yÃ¼k! Maksimum 5MB olmalÄ±.', true);
                        event.target.value = '';
                        return;
                    }

                    // Dosya tipi kontrolÃ¼
                    if (!file.type.startsWith('image/')) {
                        toast('LÃ¼tfen bir resim dosyasÄ± seÃ§in!', true);
                        event.target.value = '';
                        return;
                    }

                    this.selectedPhotoBlob = file;

                    // Ã–nizlemeyi gÃ¶ster
                    var preview = document.getElementById('photoPreview');
                    var previewImg = document.getElementById('photoPreviewImg');
                    previewImg.src = URL.createObjectURL(file);
                    preview.style.display = 'block';

                    toast('FotoÄŸraf seÃ§ildi!');
                },

                // FotoÄŸrafÄ± kaldÄ±r
                removeProfilePhoto: function() {
                    this.selectedPhotoBlob = null;

                    var preview = document.getElementById('photoPreview');
                    var previewImg = document.getElementById('photoPreviewImg');
                    var fileInput = document.getElementById('photoFileInput');

                    preview.style.display = 'none';
                    previewImg.src = '';
                    fileInput.value = '';

                    // Kamera aÃ§Ä±ksa kapat
                    if (this.cameraStream) {
                        this.closeCamera();
                    }

                    toast('FotoÄŸraf kaldÄ±rÄ±ldÄ±');
                },

                logout: function() {
                    if (confirm('Ã‡Ä±kÄ±ÅŸ yapmak istediÄŸinize emin misiniz?')) {
                        // Cleanup: TÃ¼m timeout'larÄ± temizle
                        clearAllTimeouts();

                        // FotoÄŸraf verilerini temizle
                        this.selectedPhotoBlob = null;
                        if (this.cameraStream) {
                            this.closeCamera();
                        }

                        // GÃœVENLÄ°K: Session'Ä± temizle
                        currentUser = null;
                        currentTeamId = null;
                        isAdmin = false;

                        // Server'a logout isteÄŸi gÃ¶nder (session'Ä± temizle)
                        socket.emit('logout-user', function() {
                            // Nick giriÅŸ sayfasÄ±na yÃ¶nlendir
                            router.navigate('/');
                            updateCurrentUserDisplay();
                            toast('Ã‡Ä±kÄ±ÅŸ yapÄ±ldÄ±.');
                        });
                    }
                }
};

// Make globally available
if (typeof window !== 'undefined') {
    window.USER = USER;
}
