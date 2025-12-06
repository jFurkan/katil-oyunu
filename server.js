const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// Veri dosyaları
const DATA_FILE = path.join(__dirname, 'data.json');
const CREDITS_FILE = path.join(__dirname, 'credits.json');

// Verileri dosyadan yükle
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.log('Veri dosyası okunamadı, yeni başlatılıyor');
    }
    return [];
}

// Verileri dosyaya kaydet
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2));
    } catch (err) {
        console.log('Veri kaydedilemedi:', err);
    }
}

// Emeği geçenleri yükle
function loadCredits() {
    try {
        if (fs.existsSync(CREDITS_FILE)) {
            const data = fs.readFileSync(CREDITS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.log('Emeği geçenler dosyası okunamadı, varsayılan liste kullanılıyor');
    }
    return ['Furkan', 'Claude'];
}

// Emeği geçenleri kaydet
function saveCredits() {
    try {
        fs.writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2));
    } catch (err) {
        console.log('Emeği geçenler kaydedilemedi:', err);
    }
}

// Oyun verileri
let teams = loadData();
let credits = loadCredits();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '260678';

// Oyun durumu
let gameState = {
    started: false,
    countdown: 0,
    countdownInterval: null,
    phaseTitle: ''
};

// Countdown'u başlat
function startCountdown() {
    if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
    }

    gameState.countdownInterval = setInterval(() => {
        if (gameState.countdown > 0) {
            gameState.countdown--;
            io.emit('countdown-update', gameState.countdown);

            if (gameState.countdown === 0) {
                clearInterval(gameState.countdownInterval);

                const endedPhaseTitle = gameState.phaseTitle || 'OYUN';

                // Süre doldu bildirimi gönder
                io.emit('notification', {
                    title: '⏰ Süre Doldu',
                    message: `${endedPhaseTitle.toUpperCase()} SÜRESİ DOLDU! Artık ipucu gönderemezsiniz.`,
                    type: 'announcement'
                });

                io.emit('game-ended');
                console.log('Oyun süresi doldu!');
            }
        }
    }, 1000);
}

// Countdown'u durdur
function stopCountdown() {
    if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
    }
}

// Socket.io bağlantıları
io.on('connection', (socket) => {
    console.log('Kullanıcı bağlandı:', socket.id);

    // Takım listesini gönder
    socket.emit('teams-update', teams);

    // Oyun durumunu gönder
    socket.emit('game-state-update', {
        started: gameState.started,
        countdown: gameState.countdown,
        phaseTitle: gameState.phaseTitle
    });

    // Emeği geçenleri gönder
    socket.emit('credits-update', credits);

    // Yeni takım oluştur
    socket.on('create-team', (data, callback) => {
        const exists = teams.some(t => t.name.toLowerCase() === data.name.toLowerCase());
        if (exists) {
            callback({ success: false, error: 'Bu isimde takım var!' });
            return;
        }

        if (!data.password || data.password.trim() === '') {
            callback({ success: false, error: 'Şifre boş olamaz!' });
            return;
        }

        const team = {
            id: 'team_' + Date.now(),
            name: data.name,
            password: data.password,
            score: 0,
            clues: []
        };

        teams.push(team);
        saveData();
        callback({ success: true, team: team });

        io.emit('teams-update', teams);
        console.log('Takım oluşturuldu:', data.name);
    });

    // Takıma giriş yap
    socket.on('join-team', (data, callback) => {
        const team = teams.find(t => t.id === data.teamId);
        if (!team) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        if (team.password !== data.password) {
            callback({ success: false, error: 'Hatalı şifre!' });
            return;
        }

        socket.join(data.teamId);
        callback({ success: true, team: team });
    });

    // Takım bilgisi al
    socket.on('get-team', (teamId, callback) => {
        const team = teams.find(t => t.id === teamId);
        callback(team || null);
    });

    // İpucu ekle
    socket.on('add-clue', (data, callback) => {
        // Oyun başlamadıysa ipucu gönderilemez
        if (!gameState.started) {
            callback({ success: false, error: 'Oyun henüz başlamadı!' });
            return;
        }

        const team = teams.find(t => t.id === data.teamId);
        if (team) {
            team.clues.push({
                text: data.clue,
                time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            });
            saveData();
            callback({ success: true });

            io.emit('teams-update', teams);
            io.to(data.teamId).emit('team-update', team);
        } else {
            callback({ success: false, error: 'Takım bulunamadı!' });
        }
    });

    // Admin şifre kontrolü
    socket.on('admin-login', (password, callback) => {
        if (password === ADMIN_PASSWORD) {
            callback({ success: true });
        } else {
            callback({ success: false, error: 'Yanlış şifre!' });
        }
    });

    // Puan değiştir (admin)
    socket.on('change-score', (data, callback) => {
        const team = teams.find(t => t.id === data.teamId);
        if (team) {
            const newScore = team.score + data.amount;
            if (newScore < 0) {
                callback({ success: false, error: 'Puan 0 altına düşemez!' });
                return;
            }
            team.score = newScore;
            saveData();
            callback({ success: true, team: team });

            io.emit('teams-update', teams);
            io.to(data.teamId).emit('team-update', team);

            // Puan değişikliği bildirimi gönder
            io.emit('score-changed', {
                teamName: team.name,
                amount: data.amount,
                newScore: team.score
            });

            console.log(`${team.name}: ${data.amount > 0 ? '+' : ''}${data.amount} puan`);
        } else {
            callback({ success: false, error: 'Takım bulunamadı!' });
        }
    });

    // Takım sil (admin)
    socket.on('delete-team', (teamId, callback) => {
        const teamIndex = teams.findIndex(t => t.id === teamId);
        if (teamIndex !== -1) {
            const teamName = teams[teamIndex].name;
            teams.splice(teamIndex, 1);
            saveData();
            callback({ success: true });

            io.emit('teams-update', teams);
            io.emit('team-deleted', teamId);
            console.log('Takım silindi:', teamName);
        } else {
            callback({ success: false, error: 'Takım bulunamadı!' });
        }
    });

    // Oyunu sıfırla (admin)
    socket.on('reset-game', (callback) => {
        const count = teams.length;
        teams = [];
        saveData();
        callback({ success: true, count: count });

        io.emit('teams-update', teams);
        io.emit('game-reset');
        console.log('Oyun sıfırlandı! ' + count + ' takım silindi.');
    });

    // Genel ipucu gönder (admin)
    socket.on('send-general-clue', (clue, callback) => {
        if (!clue || clue.trim() === '') {
            callback({ success: false, error: 'İpucu metni boş olamaz!' });
            return;
        }

        // Tüm kullanıcılara ipucu gönder
        io.emit('general-clue', {
            clue: clue.trim()
        });

        callback({ success: true });
        console.log('Genel ipucu gönderildi:', clue.trim());
    });

    // Duyuru gönder (admin)
    socket.on('send-announcement', (message, callback) => {
        if (!message || message.trim() === '') {
            callback({ success: false, error: 'Duyuru metni boş olamaz!' });
            return;
        }

        // Tüm kullanıcılara bildirim gönder
        io.emit('notification', {
            title: 'Yönetici Duyurusu',
            message: message.trim(),
            type: 'announcement'
        });

        callback({ success: true });
        console.log('Duyuru gönderildi:', message.trim());
    });

    // Oyunu başlat (admin)
    socket.on('start-game', (data, callback) => {
        if (gameState.started) {
            callback({ success: false, error: 'Oyun zaten başlamış!' });
            return;
        }

        if (!data.minutes || data.minutes <= 0) {
            callback({ success: false, error: 'Geçerli bir süre giriniz!' });
            return;
        }

        gameState.started = true;
        gameState.countdown = data.minutes * 60; // Dakikayı saniyeye çevir
        gameState.phaseTitle = data.title || 'Oyun Başladı';
        startCountdown();

        io.emit('game-started', {
            countdown: gameState.countdown,
            phaseTitle: gameState.phaseTitle
        });

        // Oyun başlama bildirimi gönder
        const phaseText = data.title ? data.title.toUpperCase() : 'OYUN';
        io.emit('notification', {
            title: '🎮 Oyun Başladı',
            message: `${phaseText} BAŞLADI! ${data.minutes} DAKİKA SÜRENİZ VAR.`,
            type: 'announcement'
        });

        callback({ success: true });
        console.log(`Oyun başlatıldı! Başlık: "${gameState.phaseTitle}" - Süre: ${data.minutes} dakika`);
    });

    // Countdown'a süre ekle (admin)
    socket.on('add-time', (seconds, callback) => {
        if (!gameState.started) {
            callback({ success: false, error: 'Oyun başlamadı!' });
            return;
        }

        gameState.countdown += seconds;
        io.emit('countdown-update', gameState.countdown);

        // Süre ekleme bildirimi gönder
        const minutes = Math.floor(seconds / 60);
        io.emit('notification', {
            title: '⏱️ Süre Eklendi',
            message: `Oyuna ${minutes} dakika eklendi! Yeni toplam süre: ${Math.floor(gameState.countdown / 60)} dakika.`,
            type: 'announcement'
        });

        callback({ success: true });
        console.log(`${seconds} saniye eklendi. Yeni süre: ${gameState.countdown}s`);
    });

    // Oyunu bitir (admin)
    socket.on('end-game', (callback) => {
        if (!gameState.started) {
            callback({ success: false, error: 'Oyun zaten bitmedi!' });
            return;
        }

        const endedPhaseTitle = gameState.phaseTitle || 'OYUN';

        stopCountdown();
        gameState.started = false;
        gameState.countdown = 0;
        gameState.phaseTitle = '';

        io.emit('game-ended');

        // Oyun bitirme bildirimi gönder
        io.emit('notification', {
            title: '🏁 Oyun Bitti',
            message: `${endedPhaseTitle.toUpperCase()} SONA ERDİ! Artık ipucu gönderemezsiniz.`,
            type: 'announcement'
        });

        callback({ success: true });
        console.log('Oyun bitirildi!');
    });

    // Emeği geçenler - İsim ekle (admin)
    socket.on('add-credit', (name, callback) => {
        if (!name || name.trim() === '') {
            callback({ success: false, error: 'İsim boş olamaz!' });
            return;
        }

        const trimmedName = name.trim();
        if (credits.includes(trimmedName)) {
            callback({ success: false, error: 'Bu isim zaten listede!' });
            return;
        }

        credits.push(trimmedName);
        saveCredits();
        io.emit('credits-update', credits);
        callback({ success: true });
        console.log('Emeği geçenler listesine eklendi:', trimmedName);
    });

    // Emeği geçenler - İsim sil (admin)
    socket.on('remove-credit', (name, callback) => {
        const index = credits.indexOf(name);
        if (index === -1) {
            callback({ success: false, error: 'İsim bulunamadı!' });
            return;
        }

        credits.splice(index, 1);
        saveCredits();
        io.emit('credits-update', credits);
        callback({ success: true });
        console.log('Emeği geçenler listesinden silindi:', name);
    });

    // Bağlantı koptu
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║         KATİL KİM? OYUNU               ║
║────────────────────────────────────────║
║  Sunucu çalışıyor!                     ║
║  http://localhost:${PORT}                  ║
║                                        ║
║  Admin Şifresi: ${ADMIN_PASSWORD}                 ║
╚════════════════════════════════════════╝
    `);
});