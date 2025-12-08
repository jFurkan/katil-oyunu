const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { pool, initDatabase } = require('./database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// Veritabanı test endpoint'i
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time, COUNT(*) as team_count FROM teams');
        res.json({
            status: 'OK',
            database: 'Connected',
            serverTime: result.rows[0].time,
            teamCount: result.rows[0].team_count
        });
    } catch (err) {
        res.status(500).json({
            status: 'ERROR',
            database: 'Disconnected',
            error: err.message
        });
    }
});

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

// Helper fonksiyonlar - PostgreSQL işlemleri
async function getAllTeams() {
    const result = await pool.query(`
        SELECT t.*,
               COALESCE(
                   json_agg(
                       json_build_object('text', c.text, 'time', c.time)
                       ORDER BY c.created_at
                   ) FILTER (WHERE c.id IS NOT NULL),
                   '[]'
               ) as clues
        FROM teams t
        LEFT JOIN clues c ON t.id = c.team_id
        GROUP BY t.id
        ORDER BY t.created_at
    `);
    return result.rows;
}

async function getAllCredits() {
    const result = await pool.query('SELECT * FROM credits ORDER BY created_at');
    return result.rows;
}

// Socket.io bağlantıları
io.on('connection', async (socket) => {
    console.log('Kullanıcı bağlandı:', socket.id);

    // Takım listesini gönder
    const teams = await getAllTeams();
    socket.emit('teams-update', teams);

    // Oyun durumunu gönder
    socket.emit('game-state-update', {
        started: gameState.started,
        countdown: gameState.countdown,
        phaseTitle: gameState.phaseTitle
    });

    // Emeği geçenleri gönder
    const credits = await getAllCredits();
    socket.emit('credits-update', credits);

    // Yeni takım oluştur
    socket.on('create-team', async (data, callback) => {
        try {
            // Takım var mı kontrol et
            const checkResult = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM teams WHERE LOWER(name) = LOWER($1))',
                [data.name]
            );

            if (checkResult.rows[0].exists) {
                callback({ success: false, error: 'Bu isimde takım var!' });
                return;
            }

            if (!data.password || data.password.trim() === '') {
                callback({ success: false, error: 'Şifre boş olamaz!' });
                return;
            }

            const teamId = 'team_' + Date.now();

            // Takım oluştur
            const result = await pool.query(
                'INSERT INTO teams (id, name, password, score) VALUES ($1, $2, $3, 0) RETURNING *',
                [teamId, data.name, data.password]
            );

            const team = result.rows[0];
            team.clues = [];

            callback({ success: true, team: team });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            console.log('Takım oluşturuldu:', data.name);
        } catch (err) {
            console.error('Takım oluşturma hatası:', err);
            callback({ success: false, error: 'Takım oluşturulamadı!' });
        }
    });

    // Takıma giriş yap
    socket.on('join-team', async (data, callback) => {
        try {
            const result = await pool.query(`
                SELECT t.*,
                       COALESCE(
                           json_agg(
                               json_build_object('text', c.text, 'time', c.time)
                               ORDER BY c.created_at
                           ) FILTER (WHERE c.id IS NOT NULL),
                           '[]'
                       ) as clues
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                WHERE t.id = $1
                GROUP BY t.id
            `, [data.teamId]);

            const team = result.rows[0];

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
        } catch (err) {
            console.error('Takıma giriş hatası:', err);
            callback({ success: false, error: 'Giriş yapılamadı!' });
        }
    });

    // Takım bilgisi al
    socket.on('get-team', async (teamId, callback) => {
        try {
            const result = await pool.query(`
                SELECT t.*,
                       COALESCE(
                           json_agg(
                               json_build_object('text', c.text, 'time', c.time)
                               ORDER BY c.created_at
                           ) FILTER (WHERE c.id IS NOT NULL),
                           '[]'
                       ) as clues
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                WHERE t.id = $1
                GROUP BY t.id
            `, [teamId]);

            callback(result.rows[0] || null);
        } catch (err) {
            console.error('Takım bilgisi alma hatası:', err);
            callback(null);
        }
    });

    // İpucu ekle
    socket.on('add-clue', async (data, callback) => {
        // Oyun başlamadıysa ipucu gönderilemez
        if (!gameState.started) {
            callback({ success: false, error: 'Oyun henüz başlamadı!' });
            return;
        }

        try {
            const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            // İpucu ekle
            await pool.query(
                'INSERT INTO clues (team_id, text, time) VALUES ($1, $2, $3)',
                [data.teamId, data.clue, time]
            );

            callback({ success: true });

            // Güncel takım listesini ve takım bilgisini gönder
            const teams = await getAllTeams();
            io.emit('teams-update', teams);

            const teamResult = await pool.query(`
                SELECT t.*,
                       COALESCE(
                           json_agg(
                               json_build_object('text', c.text, 'time', c.time)
                               ORDER BY c.created_at
                           ) FILTER (WHERE c.id IS NOT NULL),
                           '[]'
                       ) as clues
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                WHERE t.id = $1
                GROUP BY t.id
            `, [data.teamId]);

            io.to(data.teamId).emit('team-update', teamResult.rows[0]);
        } catch (err) {
            console.error('İpucu ekleme hatası:', err);
            callback({ success: false, error: 'İpucu eklenemedi!' });
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
    socket.on('change-score', async (data, callback) => {
        try {
            // Mevcut takımı al
            const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [data.teamId]);
            const team = teamResult.rows[0];

            if (!team) {
                callback({ success: false, error: 'Takım bulunamadı!' });
                return;
            }

            const newScore = team.score + data.amount;
            if (newScore < 0) {
                callback({ success: false, error: 'Puan 0 altına düşemez!' });
                return;
            }

            // Puanı güncelle
            await pool.query('UPDATE teams SET score = $1 WHERE id = $2', [newScore, data.teamId]);

            team.score = newScore;
            callback({ success: true, team: team });

            // Güncel takım listesini gönder
            const teams = await getAllTeams();
            io.emit('teams-update', teams);

            // Güncel takım bilgisini gönder
            const updatedTeamResult = await pool.query(`
                SELECT t.*,
                       COALESCE(
                           json_agg(
                               json_build_object('text', c.text, 'time', c.time)
                               ORDER BY c.created_at
                           ) FILTER (WHERE c.id IS NOT NULL),
                           '[]'
                       ) as clues
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                WHERE t.id = $1
                GROUP BY t.id
            `, [data.teamId]);

            io.to(data.teamId).emit('team-update', updatedTeamResult.rows[0]);

            // Puan değişikliği bildirimi gönder
            io.emit('score-changed', {
                teamName: team.name,
                amount: data.amount,
                newScore: team.score
            });

            console.log(`${team.name}: ${data.amount > 0 ? '+' : ''}${data.amount} puan`);
        } catch (err) {
            console.error('Puan değiştirme hatası:', err);
            callback({ success: false, error: 'Puan değiştirilemedi!' });
        }
    });

    // Takım sil (admin)
    socket.on('delete-team', async (teamId, callback) => {
        try {
            const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING name', [teamId]);

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Takım bulunamadı!' });
                return;
            }

            const teamName = result.rows[0].name;
            callback({ success: true });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            io.emit('team-deleted', teamId);
            console.log('Takım silindi:', teamName);
        } catch (err) {
            console.error('Takım silme hatası:', err);
            callback({ success: false, error: 'Takım silinemedi!' });
        }
    });

    // Oyunu sıfırla (admin)
    socket.on('reset-game', async (callback) => {
        try {
            const result = await pool.query('DELETE FROM teams RETURNING *');
            const count = result.rowCount;

            callback({ success: true, count: count });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            io.emit('game-reset');
            console.log('Oyun sıfırlandı! ' + count + ' takım silindi.');
        } catch (err) {
            console.error('Oyun sıfırlama hatası:', err);
            callback({ success: false, error: 'Oyun sıfırlanamadı!' });
        }
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
    socket.on('add-credit', async (name, callback) => {
        if (!name || name.trim() === '') {
            callback({ success: false, error: 'İsim boş olamaz!' });
            return;
        }

        try {
            const trimmedName = name.trim();

            // İsim var mı kontrol et
            const checkResult = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM credits WHERE name = $1)',
                [trimmedName]
            );

            if (checkResult.rows[0].exists) {
                callback({ success: false, error: 'Bu isim zaten listede!' });
                return;
            }

            const creditId = 'credit_' + Date.now();

            // Credit ekle
            await pool.query(
                'INSERT INTO credits (id, name, content) VALUES ($1, $2, $3)',
                [creditId, trimmedName, '']
            );

            const credits = await getAllCredits();
            io.emit('credits-update', credits);
            callback({ success: true });
            console.log('Emeği geçenler listesine eklendi:', trimmedName);
        } catch (err) {
            console.error('Credit ekleme hatası:', err);
            callback({ success: false, error: 'Eklenemedi!' });
        }
    });

    // Emeği geçenler - İsim sil (admin)
    socket.on('remove-credit', async (creditId, callback) => {
        try {
            const result = await pool.query(
                'DELETE FROM credits WHERE id = $1 RETURNING name',
                [creditId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'İsim bulunamadı!' });
                return;
            }

            const creditName = result.rows[0].name;
            const credits = await getAllCredits();
            io.emit('credits-update', credits);
            callback({ success: true });
            console.log('Emeği geçenler listesinden silindi:', creditName);
        } catch (err) {
            console.error('Credit silme hatası:', err);
            callback({ success: false, error: 'Silinemedi!' });
        }
    });

    // Emeği geçenler - İçerik güncelle (admin)
    socket.on('update-credit-content', async (data, callback) => {
        try {
            const result = await pool.query(
                'UPDATE credits SET content = $1 WHERE id = $2 RETURNING name',
                [data.content || '', data.creditId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Kişi bulunamadı!' });
                return;
            }

            const credits = await getAllCredits();
            io.emit('credits-update', credits);
            callback({ success: true });
            console.log('İçerik güncellendi:', result.rows[0].name);
        } catch (err) {
            console.error('Credit içerik güncelleme hatası:', err);
            callback({ success: false, error: 'Güncellenemedi!' });
        }
    });

    // Bağlantı koptu
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Veritabanını başlat
        await initDatabase();

        // Sunucuyu başlat
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
    } catch (err) {
        console.error('Sunucu başlatılamadı:', err);
        process.exit(1);
    }
}

startServer();