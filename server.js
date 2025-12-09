require('dotenv').config(); // Railway'de env vars için
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool, initDatabase } = require('./database');

const app = express();
const server = http.createServer(app);

// CORS ayarları - production'da kısıtla
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Güvenlik middleware'leri
// 1. Helmet - Güvenlik başlıkları
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
            scriptSrcAttr: ["'unsafe-inline'"], // inline event handler'lar için (onclick, onkeypress)
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "ws:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// 2. Rate Limiting - DDoS koruması
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 100, // IP başına max 100 request
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Çok fazla istek gönderdiniz, lütfen 1 dakika sonra tekrar deneyin.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 10, // IP başına max 10 login/register denemesi
    skipSuccessfulRequests: true,
    message: 'Çok fazla giriş denemesi, 15 dakika sonra tekrar deneyin.'
});

app.use('/api/', limiter);
app.use(limiter);

// 3. Body size limits - Büyük payload saldırılarını önle
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint - Railway health check
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Favicon route (404 hatasını önle)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Keep alive - Railway health check
app.get('/health', (req, res) => res.status(200).send('OK'));

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
                   (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY id)
                    FROM clues WHERE team_id = t.id),
                   '[]'
               ) as clues,
               COALESCE(
                   (SELECT json_agg(json_build_object('id', b2.id, 'name', b2.name, 'icon', b2.icon, 'color', b2.color) ORDER BY b2.id)
                    FROM team_badges tb2
                    JOIN badges b2 ON tb2.badge_id = b2.id
                    WHERE tb2.team_id = t.id),
                   '[]'
               ) as badges
        FROM teams t
        ORDER BY t.created_at
    `);
    return result.rows;
}

async function getAllCredits() {
    const result = await pool.query('SELECT * FROM credits ORDER BY created_at');
    return result.rows;
}

async function getAllGeneralClues() {
    const result = await pool.query('SELECT * FROM general_clues ORDER BY created_at');
    return result.rows;
}

async function getAllBadges() {
    const result = await pool.query('SELECT * FROM badges ORDER BY created_at');
    return result.rows;
}

async function getTeamBadges(teamId) {
    const result = await pool.query(`
        SELECT b.*, tb.awarded_at
        FROM badges b
        JOIN team_badges tb ON b.id = tb.badge_id
        WHERE tb.team_id = $1
        ORDER BY tb.awarded_at DESC
    `, [teamId]);
    return result.rows;
}

// Kullanıcı fonksiyonları
async function getAllUsers() {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at');
    return result.rows;
}

async function getUsersByTeam() {
    const result = await pool.query(`
        SELECT u.*, t.name as team_name, t.color as team_color
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.online = TRUE
        ORDER BY u.team_id NULLS LAST, u.is_captain DESC, u.created_at
    `);
    return result.rows;
}

// Socket.IO Event Rate Limiter (Spam koruması)
class SocketRateLimiter {
    constructor() {
        this.events = new Map(); // socketId -> { eventName -> timestamps[] }
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Her dakika temizle
    }

    // Event'e izin ver mi?
    check(socketId, eventName, limit = 10, windowMs = 60000) {
        const now = Date.now();
        const key = `${socketId}:${eventName}`;

        if (!this.events.has(key)) {
            this.events.set(key, []);
        }

        const timestamps = this.events.get(key);

        // Eski timestamp'leri temizle
        const validTimestamps = timestamps.filter(t => now - t < windowMs);

        // Limit aşıldı mı?
        if (validTimestamps.length >= limit) {
            return false;
        }

        // Yeni timestamp ekle
        validTimestamps.push(now);
        this.events.set(key, validTimestamps);

        return true;
    }

    // Temizlik
    cleanup() {
        const now = Date.now();
        for (const [key, timestamps] of this.events.entries()) {
            const validTimestamps = timestamps.filter(t => now - t < 300000); // 5 dakikadan eski olanları sil
            if (validTimestamps.length === 0) {
                this.events.delete(key);
            } else {
                this.events.set(key, validTimestamps);
            }
        }
    }

    // Socket disconnect olduğunda temizle
    clear(socketId) {
        const keysToDelete = [];
        for (const key of this.events.keys()) {
            if (key.startsWith(socketId + ':')) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.events.delete(key));
    }
}

const rateLimiter = new SocketRateLimiter();

// IP-based Bot Farm Protection
class IPBotProtection {
    constructor() {
        // Cleanup eski kayıtları her saat (database'de gereksiz veri birikmemesi için)
        this.cleanupInterval = setInterval(() => this.cleanupOldRecords(), 3600000); // Her saat
    }

    // IP'den son N saatte kaç işlem yapılmış kontrol et
    async checkLimit(ipAddress, action, maxAllowed = 5, hours = 24) {
        try {
            const result = await pool.query(
                `SELECT COUNT(*) as count FROM ip_activity
                 WHERE ip_address = $1 AND action = $2
                 AND created_at > NOW() - INTERVAL '${hours} hours'`,
                [ipAddress, action]
            );

            const count = parseInt(result.rows[0].count);
            return count < maxAllowed;
        } catch (err) {
            console.error('IP check error:', err);
            return true; // Hata durumunda engellemiyoruz (fail open)
        }
    }

    // IP aktivitesini kaydet
    async recordActivity(ipAddress, action) {
        try {
            await pool.query(
                'INSERT INTO ip_activity (ip_address, action) VALUES ($1, $2)',
                [ipAddress, action]
            );
        } catch (err) {
            console.error('IP record error:', err);
        }
    }

    // 7 günden eski kayıtları temizle
    async cleanupOldRecords() {
        try {
            const result = await pool.query(
                "DELETE FROM ip_activity WHERE created_at < NOW() - INTERVAL '7 days'"
            );
            if (result.rowCount > 0) {
                console.log(`✓ IP activity cleanup: ${result.rowCount} eski kayıt silindi`);
            }
        } catch (err) {
            console.error('IP cleanup error:', err);
        }
    }

    // IP'yi al (proxy/cloudflare arkasındaysa X-Forwarded-For header'ını kontrol et)
    getClientIP(socket) {
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        return socket.handshake.address || 'unknown';
    }
}

const botProtection = new IPBotProtection();

// WebSocket güvenlik middleware'i
io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;
    const referer = socket.handshake.headers.referer;

    // Development'da origin kontrolü atla
    if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGIN !== '*') {
        if (!origin || (origin !== ALLOWED_ORIGIN && !referer?.startsWith(ALLOWED_ORIGIN))) {
            console.log('❌ WebSocket bağlantısı reddedildi - geçersiz origin:', origin);
            return next(new Error('Origin not allowed'));
        }
    }

    // Bağlantı sayısı limiti (DDoS koruması)
    const clientCount = io.engine.clientsCount;
    const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS) || 1000;

    if (clientCount >= MAX_CONNECTIONS) {
        console.log('❌ WebSocket bağlantısı reddedildi - maksimum bağlantı sayısına ulaşıldı');
        return next(new Error('Server full'));
    }

    next();
});

// Socket.io bağlantıları
io.on('connection', async (socket) => {
    console.log('✓ Kullanıcı bağlandı:', socket.id, '- Toplam:', io.engine.clientsCount);

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

    // Yönetici ipuçlarını gönder
    const generalClues = await getAllGeneralClues();
    socket.emit('general-clues-update', generalClues);

    // Rozetleri gönder
    const badges = await getAllBadges();
    socket.emit('badges-update', badges);

    // Kullanıcıları gönder
    const users = await getUsersByTeam();
    socket.emit('users-update', users);

    // Kullanıcı kaydı (nickname al)
    socket.on('register-user', async (nickname, callback) => {
        // Rate limiting: 5 deneme/dakika
        if (!rateLimiter.check(socket.id, 'register-user', 5, 60000)) {
            callback({ success: false, error: 'Çok fazla kayıt denemesi! Lütfen 1 dakika bekleyin.' });
            console.log('⚠️  Rate limit: register-user -', socket.id);
            return;
        }

        // Bot farm koruması: IP bazlı limit (24 saatte max 3 kullanıcı)
        const clientIP = botProtection.getClientIP(socket);
        const ipAllowed = await botProtection.checkLimit(clientIP, 'register-user', 3, 24);

        if (!ipAllowed) {
            callback({ success: false, error: 'Bu IP adresinden çok fazla kayıt yapıldı. Lütfen daha sonra tekrar deneyin.' });
            console.log('🤖 Bot koruması: register-user engellendi -', clientIP);
            return;
        }

        try {
            if (!nickname || nickname.trim() === '') {
                callback({ success: false, error: 'Nick boş olamaz!' });
                return;
            }

            const trimmedNick = nickname.trim();

            // Aynı nickname var mı kontrol et (case insensitive)
            const checkResult = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(nickname) = LOWER($1))',
                [trimmedNick]
            );

            if (checkResult.rows[0].exists) {
                callback({ success: false, error: 'Bu nick kullanımda!' });
                return;
            }

            const userId = 'user_' + Date.now();

            // Kullanıcı oluştur
            await pool.query(
                'INSERT INTO users (id, nickname, socket_id, online) VALUES ($1, $2, $3, TRUE)',
                [userId, trimmedNick, socket.id]
            );

            // IP aktivitesini kaydet (başarılı kayıt)
            await botProtection.recordActivity(clientIP, 'register-user');

            callback({ success: true, userId: userId, nickname: trimmedNick });

            // Tüm kullanıcılara güncel listeyi gönder
            const users = await getUsersByTeam();
            io.emit('users-update', users);

            console.log('Kullanıcı kaydedildi:', trimmedNick, '- IP:', clientIP);
        } catch (err) {
            console.error('Kullanıcı kayıt hatası:', err);
            callback({ success: false, error: 'Kayıt oluşturulamadı!' });
        }
    });

    // Yeni takım oluştur
    socket.on('create-team', async (data, callback) => {
        // Rate limiting: 3 takım/dakika
        if (!rateLimiter.check(socket.id, 'create-team', 3, 60000)) {
            callback({ success: false, error: 'Çok fazla takım oluşturma denemesi! Lütfen bekleyin.' });
            console.log('⚠️  Rate limit: create-team -', socket.id);
            return;
        }

        // Bot farm koruması: IP bazlı limit (24 saatte max 2 takım)
        const clientIP = botProtection.getClientIP(socket);
        const ipAllowed = await botProtection.checkLimit(clientIP, 'create-team', 2, 24);

        if (!ipAllowed) {
            callback({ success: false, error: 'Bu IP adresinden çok fazla takım oluşturuldu. Lütfen daha sonra tekrar deneyin.' });
            console.log('🤖 Bot koruması: create-team engellendi -', clientIP);
            return;
        }

        try {
            // userId kontrolü
            if (!data.userId) {
                callback({ success: false, error: 'Kullanıcı girişi yapmalısınız!' });
                return;
            }

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

            // Kullanıcıyı al
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [data.userId]);
            const user = userResult.rows[0];

            if (!user) {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
                return;
            }

            const teamId = 'team_' + Date.now();
            const avatar = data.avatar || '🕵️';
            const color = data.color || '#3b82f6';

            // Takım oluştur ve captain nickname kaydet
            await pool.query(
                'INSERT INTO teams (id, name, password, score, avatar, color, captain_nickname) VALUES ($1, $2, $3, 0, $4, $5, $6)',
                [teamId, data.name, data.password, avatar, color, user.nickname]
            );

            // Kullanıcıyı takıma ekle ve captain yap
            await pool.query(
                'UPDATE users SET team_id = $1, is_captain = TRUE WHERE id = $2',
                [teamId, data.userId]
            );

            // Tam team objesini badges ve clues ile birlikte al
            const teamResult = await pool.query(`
                SELECT t.*,
                       COALESCE(json_agg(DISTINCT jsonb_build_object('text', c.text, 'time', c.time)) FILTER (WHERE c.id IS NOT NULL), '[]') as clues,
                       COALESCE(json_agg(DISTINCT jsonb_build_object('id', b.id, 'name', b.name, 'icon', b.icon, 'color', b.color)) FILTER (WHERE b.id IS NOT NULL), '[]') as badges
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                LEFT JOIN team_badges tb ON t.id = tb.team_id
                LEFT JOIN badges b ON tb.badge_id = b.id
                WHERE t.id = $1
                GROUP BY t.id
            `, [teamId]);

            const team = teamResult.rows[0];

            // IP aktivitesini kaydet (başarılı takım oluşturma)
            await botProtection.recordActivity(clientIP, 'create-team');

            callback({ success: true, team: team });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);

            // Kullanıcı listesini güncelle
            const users = await getUsersByTeam();
            io.emit('users-update', users);

            console.log('Takım oluşturuldu:', data.name, '- Kaptan:', user.nickname, '- IP:', clientIP);
        } catch (err) {
            console.error('Takım oluşturma hatası:', err);
            callback({ success: false, error: 'Takım oluşturulamadı!' });
        }
    });

    // Takıma giriş yap
    socket.on('join-team', async (data, callback) => {
        try {
            // userId kontrolü
            if (!data.userId) {
                callback({ success: false, error: 'Kullanıcı girişi yapmalısınız!' });
                return;
            }

            const result = await pool.query(`
                SELECT t.*,
                       COALESCE(
                           (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY created_at)
                            FROM clues WHERE team_id = t.id),
                           '[]'
                       ) as clues
                FROM teams t
                WHERE t.id = $1
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

            // Kullanıcıyı takıma ekle
            await pool.query(
                'UPDATE users SET team_id = $1, is_captain = FALSE WHERE id = $2',
                [data.teamId, data.userId]
            );

            socket.join(data.teamId);
            callback({ success: true, team: team });

            // Kullanıcı listesini güncelle
            const users = await getUsersByTeam();
            io.emit('users-update', users);

            console.log('Kullanıcı takıma katıldı:', team.name);
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
                           (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY created_at)
                            FROM clues WHERE team_id = t.id),
                           '[]'
                       ) as clues
                FROM teams t
                WHERE t.id = $1
            `, [teamId]);

            callback(result.rows[0] || null);
        } catch (err) {
            console.error('Takım bilgisi alma hatası:', err);
            callback(null);
        }
    });

    // İpucu ekle
    socket.on('add-clue', async (data, callback) => {
        // Rate limiting: 10 ipucu/dakika (spam önleme)
        if (!rateLimiter.check(socket.id, 'add-clue', 10, 60000)) {
            callback({ success: false, error: 'Çok hızlı ipucu gönderiyorsunuz! Biraz yavaşlayın.' });
            console.log('⚠️  Rate limit: add-clue -', socket.id);
            return;
        }

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
                           (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY created_at)
                            FROM clues WHERE team_id = t.id),
                           '[]'
                       ) as clues
                FROM teams t
                WHERE t.id = $1
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
                           (SELECT json_agg(json_build_object('text', text, 'time', time) ORDER BY created_at)
                            FROM clues WHERE team_id = t.id),
                           '[]'
                       ) as clues
                FROM teams t
                WHERE t.id = $1
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
    socket.on('send-general-clue', async (clue, callback) => {
        // Rate limiting: 20 ipucu/dakika (admin spam önleme)
        if (!rateLimiter.check(socket.id, 'send-general-clue', 20, 60000)) {
            callback({ success: false, error: 'Çok hızlı ipucu gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: send-general-clue -', socket.id);
            return;
        }

        if (!clue || clue.trim() === '') {
            callback({ success: false, error: 'İpucu metni boş olamaz!' });
            return;
        }

        try {
            const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            // Veritabanına kaydet
            await pool.query(
                'INSERT INTO general_clues (text, time) VALUES ($1, $2)',
                [clue.trim(), time]
            );

            // Tüm kullanıcılara ipucu gönder
            const generalClues = await getAllGeneralClues();
            io.emit('general-clues-update', generalClues);

            // Bildirim olarak gönder
            io.emit('general-clue-notification', {
                clue: clue.trim(),
                time: time
            });

            callback({ success: true });
            console.log('Genel ipucu gönderildi:', clue.trim());
        } catch (err) {
            console.error('Genel ipucu gönderme hatası:', err);
            callback({ success: false, error: 'İpucu gönderilemedi!' });
        }
    });

    // Duyuru gönder (admin)
    socket.on('send-announcement', (message, callback) => {
        // Rate limiting: 10 duyuru/dakika
        if (!rateLimiter.check(socket.id, 'send-announcement', 10, 60000)) {
            callback({ success: false, error: 'Çok fazla duyuru gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: send-announcement -', socket.id);
            return;
        }

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

    // Takım özelleştirme (avatar + renk)
    socket.on('update-team-customization', async (data, callback) => {
        try {
            await pool.query(
                'UPDATE teams SET avatar = $1, color = $2 WHERE id = $3',
                [data.avatar, data.color, data.teamId]
            );

            callback({ success: true });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            console.log('Takım özelleştirildi:', data.teamId);
        } catch (err) {
            console.error('Özelleştirme hatası:', err);
            callback({ success: false, error: 'Özelleştirilemedi!' });
        }
    });

    // Rozet oluştur (admin)
    socket.on('create-badge', async (data, callback) => {
        if (!data.name || !data.icon) {
            callback({ success: false, error: 'Rozet adı ve ikonu gerekli!' });
            return;
        }

        try {
            const result = await pool.query(
                'INSERT INTO badges (name, icon, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
                [data.name, data.icon, data.description || '', data.color || '#FFD700']
            );

            const badges = await getAllBadges();
            io.emit('badges-update', badges);
            callback({ success: true, badge: result.rows[0] });
            console.log('Rozet oluşturuldu:', data.name);
        } catch (err) {
            console.error('Rozet oluşturma hatası:', err);
            callback({ success: false, error: 'Rozet oluşturulamadı!' });
        }
    });

    // Rozet ver (admin)
    socket.on('award-badge', async (data, callback) => {
        try {
            await pool.query(
                'INSERT INTO team_badges (team_id, badge_id) VALUES ($1, $2) ON CONFLICT (team_id, badge_id) DO NOTHING',
                [data.teamId, data.badgeId]
            );

            callback({ success: true });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            console.log(`Rozet verildi: Badge ${data.badgeId} -> Team ${data.teamId}`);
        } catch (err) {
            console.error('Rozet verme hatası:', err);
            callback({ success: false, error: 'Rozet verilemedi!' });
        }
    });

    // Rozeti takımdan kaldır (admin)
    socket.on('remove-badge-from-team', async (data, callback) => {
        try {
            await pool.query(
                'DELETE FROM team_badges WHERE team_id = $1 AND badge_id = $2',
                [data.teamId, data.badgeId]
            );

            callback({ success: true });

            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            console.log(`Rozet kaldırıldı: Badge ${data.badgeId} <- Team ${data.teamId}`);
        } catch (err) {
            console.error('Rozet kaldırma hatası:', err);
            callback({ success: false, error: 'Rozet kaldırılamadı!' });
        }
    });

    // Rozeti sil (admin)
    socket.on('delete-badge', async (badgeId, callback) => {
        try {
            await pool.query('DELETE FROM badges WHERE id = $1', [badgeId]);

            const badges = await getAllBadges();
            io.emit('badges-update', badges);
            callback({ success: true });
            console.log('Rozet silindi:', badgeId);
        } catch (err) {
            console.error('Rozet silme hatası:', err);
            callback({ success: false, error: 'Rozet silinemedi!' });
        }
    });

    // Bağlantı koptu
    socket.on('disconnect', async () => {
        console.log('✓ Kullanıcı ayrıldı:', socket.id, '- Kalan:', io.engine.clientsCount - 1);

        // Rate limiter temizliği
        rateLimiter.clear(socket.id);

        // Kullanıcıyı offline yap
        try {
            await pool.query('UPDATE users SET online = FALSE WHERE socket_id = $1', [socket.id]);

            // Kullanıcı listesini güncelle
            const users = await getUsersByTeam();
            io.emit('users-update', users);
        } catch (err) {
            console.error('Disconnect hatası:', err);
        }
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Veritabanını başlat
        await initDatabase();

        // Sunucuyu başlat (0.0.0.0 Railway için gerekli)
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════╗
║         KATİL KİM? OYUNU               ║
║────────────────────────────────────────║
║  Sunucu çalışıyor!                     ║
║  Port: ${PORT}                             ║
║  Admin Şifresi: ${ADMIN_PASSWORD}                 ║
╚════════════════════════════════════════╝
            `);
            console.log('✓ Server ready and listening on', server.address());
        });
    } catch (err) {
        console.error('Sunucu başlatılamadı:', err);
        process.exit(1);
    }
}

startServer();