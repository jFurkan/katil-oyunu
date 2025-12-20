require('dotenv').config(); // Railway'de env vars için
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto'); // UUID üretmek için
const validator = require('validator'); // Input validation için
const escapeHtml = require('escape-html'); // XSS koruması için
const cookieParser = require('cookie-parser'); // Cookie yönetimi için
const session = require('express-session'); // Session yönetimi için
const { pool, initDatabase } = require('./database');

// GÜVENLİK: Environment variable validation
const requiredEnvVars = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ HATA: Gerekli environment variable eksik:');
    missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nLütfen .env dosyasını kontrol edin veya Railway environment variables ayarlayın.');
    process.exit(1);
}

// GÜVENLİK: Admin şifre kontrolü
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (ADMIN_PASSWORD.length < 8) {
    console.warn('⚠️  UYARI: ADMIN_PASSWORD çok kısa! En az 8 karakter önerilir.');
}

console.log('✓ Admin password loaded from environment variables');
console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔒 Cookie settings will be: secure=${process.env.NODE_ENV === 'production'}, sameSite=${process.env.NODE_ENV === 'production' ? 'none' : 'lax'}`);

const app = express();
const server = http.createServer(app);

// Railway/Reverse proxy için trust proxy ayarı
app.set('trust proxy', 1); // Railway, Heroku gibi platformlar için gerekli

// CORS ayarları
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*');

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN || true,  // Production'da env'den, dev'de *
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
    },
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    permissionsPolicy: {
        features: {
            camera: ["'none'"],
            microphone: ["'none'"],
            geolocation: ["'none'"],
            payment: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Socket.IO compatibility
    crossOriginResourcePolicy: { policy: "cross-origin" }
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

// 4. Cookie parser - Güvenli cookie yönetimi
// Socket.IO için de kullanacağız, bu yüzden middleware'i değişkene atıyoruz
const cookieParserMiddleware = cookieParser(process.env.SESSION_SECRET);
app.use(cookieParserMiddleware);

// 5. Session yönetimi - PostgreSQL store ile production-ready
const pgSession = require('connect-pg-simple')(session);

const sessionMiddleware = session({
    store: new pgSession({
        pool,  // PostgreSQL connection pool'u kullan (database.js'den)
        tableName: 'user_sessions',  // Session tablosu adı
        createTableIfMissing: true,  // Tablo yoksa oluştur
        ttl: 7 * 24 * 60 * 60  // 7 gün (saniye cinsinden)
    }),
    secret: process.env.SESSION_SECRET,  // Artık zorunlu (validation yukarıda)
    resave: false,
    saveUninitialized: false,  // FIX: Sadece gerçek veri yazıldığında session oluştur (boş session'ları engelle)
    cookie: {
        httpOnly: true,        // XSS koruması: JavaScript erişimi yok
        secure: process.env.NODE_ENV === 'production',  // Railway'de HTTPS için gerekli
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // Cross-site cookie için
        maxAge: 7 * 24 * 60 * 60 * 1000  // 7 gün (otomatik temizlik ile aynı)
    },
    name: 'connect.sid'  // Explicit cookie name
});

app.use(sessionMiddleware);

// Statik dosyalar
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint - Railway health check
app.get('/', (req, res) => {
    console.log('📄 Ana sayfa yüklendi:', {
        sessionID: req.sessionID || 'yok',
        hasSession: !!req.session,
        userId: req.session?.userId,
        hasCookie: !!req.headers.cookie,
        protocol: req.protocol,
        secure: req.secure
    });

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

// Admin korumalı kullanıcı temizleme endpoint'i
app.post('/api/cleanup-users', async (req, res) => {
    try {
        // Admin authentication
        const adminPassword = req.body.password || req.query.password;

        if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(403).json({
                success: false,
                error: 'Yetkisiz erişim - Admin şifresi gerekli'
            });
        }

        // Temizliği çalıştır
        const result = await userCleanup.cleanup();

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// SPA CLIENT-SIDE ROUTING
// ========================================

// Catch-all route - Tüm client-side route'lar index.html'i serve eder
// NOT: Bu route en sonda olmalı, diğer tüm route'lardan sonra
app.get('*', (req, res) => {
    // API route'ları hariç tut
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'API endpoint not found'
        });
    }

    // Static dosyalar hariç (favicon, css, js, vb.)
    const staticExtensions = ['.css', '.js', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    if (staticExtensions.some(ext => req.path.endsWith(ext))) {
        return res.status(404).send('File not found');
    }

    // Client-side route - index.html serve et
    console.log('📄 SPA route:', req.path, {
        sessionID: req.sessionID || 'yok',
        userId: req.session?.userId,
        hasCookie: !!req.headers.cookie
    });

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Team messages fonksiyonları
async function getTeamMessages(teamId, limit = 50, offset = 0, excludeAdminMessages = false) {
    // Kullanıcı görebileceği mesajlar:
    // 1. Genel mesajlar (target_team_id IS NULL)
    // 2. Kendi takımına gönderilen mesajlar (target_team_id = teamId)
    // 3. Kendi takımının gönderdiği özel mesajlar (team_id = teamId AND target_team_id IS NOT NULL)

    let query = `
        SELECT * FROM team_messages
        WHERE (target_team_id IS NULL
           OR target_team_id = $1
           OR (team_id = $1 AND target_team_id IS NOT NULL))
    `;

    // Admin mesajlarını hariç tut (Chat İzleme için)
    if (excludeAdminMessages) {
        query += ` AND target_team_id != 'admin'`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

    const result = await pool.query(query, [teamId, limit, offset]);
    return result.rows.reverse(); // Eskiden yeniye sıralı döndür
}

async function getTeamMessagesCount(teamId, excludeAdminMessages = false) {
    let query = `
        SELECT COUNT(*) FROM team_messages
        WHERE (target_team_id IS NULL
           OR target_team_id = $1
           OR (team_id = $1 AND target_team_id IS NOT NULL))
    `;

    // Admin mesajlarını hariç tut
    if (excludeAdminMessages) {
        query += ` AND target_team_id != 'admin'`;
    }

    const result = await pool.query(query, [teamId]);
    return parseInt(result.rows[0].count);
}

// Filtrelenmiş takım mesajları (belirli bir kişiyle olan konuşma)
async function getFilteredTeamMessages(teamId, filterTeamId, limit = 50, offset = 0) {
    // filterTeamId yoksa normal mesajları döndür
    if (!filterTeamId) {
        return await getTeamMessages(teamId, limit, offset);
    }

    let query = `
        SELECT * FROM team_messages
        WHERE (
            (
                -- Genel mesajlar hariç, sadece belirli kişiyle olan mesajlar
                -- 1. Bizim takımdan filterTeamId'ye gönderilen mesajlar
                (team_id = $1 AND target_team_id = $2)
                OR
                -- 2. filterTeamId'den bize gönderilen mesajlar
                (team_id = $2 AND target_team_id = $1)
            )
            ${filterTeamId === 'admin' ? `
                OR
                -- Admin ile olan konuşma (admin'e gönderilen veya admin'den gelen)
                (team_id = $1 AND target_team_id = 'admin')
                OR
                (team_id = 'admin' AND target_team_id = $1)
            ` : ''}
        )
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [teamId, filterTeamId, limit, offset]);
    return result.rows.reverse(); // Eskiden yeniye sıralı döndür
}

async function getFilteredTeamMessagesCount(teamId, filterTeamId) {
    // filterTeamId yoksa normal sayıyı döndür
    if (!filterTeamId) {
        return await getTeamMessagesCount(teamId);
    }

    let query = `
        SELECT COUNT(*) FROM team_messages
        WHERE (
            (
                -- 1. Bizim takımdan filterTeamId'ye gönderilen mesajlar
                (team_id = $1 AND target_team_id = $2)
                OR
                -- 2. filterTeamId'den bize gönderilen mesajlar
                (team_id = $2 AND target_team_id = $1)
            )
            ${filterTeamId === 'admin' ? `
                OR
                -- Admin ile olan konuşma
                (team_id = $1 AND target_team_id = 'admin')
                OR
                (team_id = 'admin' AND target_team_id = $1)
            ` : ''}
        )
    `;

    const result = await pool.query(query, [teamId, filterTeamId]);
    return parseInt(result.rows[0].count);
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

// Poke (Dürtme) Rate Limiting Cache
// Map<teamId, Map<targetTeamId, timestamp>>
const pokeRateLimiter = new Map();

// Input Validation & Sanitization Helper
const InputValidator = {
    // Genel text sanitization (XSS önleme)
    sanitizeText(text, maxLength = 500) {
        if (!text || typeof text !== 'string') return '';
        const trimmed = text.trim();
        const truncated = trimmed.substring(0, maxLength);
        return escapeHtml(truncated);
    },

    // Nickname validation
    validateNickname(nickname) {
        if (!nickname || typeof nickname !== 'string') {
            return { valid: false, error: 'Nick geçersiz!' };
        }
        const trimmed = nickname.trim();
        if (trimmed.length < 2) {
            return { valid: false, error: 'Nick en az 2 karakter olmalı!' };
        }
        if (trimmed.length > 20) {
            return { valid: false, error: 'Nick en fazla 20 karakter olabilir!' };
        }
        // Sadece alfanumerik ve Türkçe karakterler, boşluk, tire, alt çizgi
        if (!/^[\wçğıöşüÇĞİÖŞÜ\s\-_]+$/u.test(trimmed)) {
            return { valid: false, error: 'Nick geçersiz karakter içeriyor!' };
        }
        return { valid: true, value: this.sanitizeText(trimmed, 20) };
    },

    // Takım adı validation
    validateTeamName(name) {
        if (!name || typeof name !== 'string') {
            return { valid: false, error: 'Takım adı geçersiz!' };
        }
        const trimmed = name.trim();
        if (trimmed.length < 3) {
            return { valid: false, error: 'Takım adı en az 3 karakter olmalı!' };
        }
        if (trimmed.length > 30) {
            return { valid: false, error: 'Takım adı en fazla 30 karakter olabilir!' };
        }
        return { valid: true, value: this.sanitizeText(trimmed, 30) };
    },

    // Şifre validation (takım şifresi)
    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Şifre geçersiz!' };
        }
        const trimmed = password.trim();
        if (trimmed.length < 4) {
            return { valid: false, error: 'Şifre en az 4 karakter olmalı!' };
        }
        if (trimmed.length > 20) {
            return { valid: false, error: 'Şifre en fazla 20 karakter olabilir!' };
        }
        return { valid: true, value: trimmed }; // Şifreyi escape etmiyoruz
    },

    // İpucu/mesaj validation
    validateMessage(message, maxLength = 200) {
        if (!message || typeof message !== 'string') {
            return { valid: false, error: 'Mesaj geçersiz!' };
        }
        const trimmed = message.trim();
        if (trimmed.length === 0) {
            return { valid: false, error: 'Mesaj boş olamaz!' };
        }
        if (trimmed.length > maxLength) {
            return { valid: false, error: `Mesaj en fazla ${maxLength} karakter olabilir!` };
        }
        return { valid: true, value: this.sanitizeText(trimmed, maxLength) };
    },

    // Sayı validation (puan, süre vs.)
    validateNumber(value, min = 0, max = 999999) {
        // GÜVENLİK: parseInt yerine Number kullan (parseInt "10.5" veya "10abc" gibi değerleri kabul eder)
        const num = Number(value);

        // Strict integer check
        if (!Number.isInteger(num) || isNaN(num)) {
            return { valid: false, error: 'Geçerli bir tam sayı girin!' };
        }

        if (num < min || num > max) {
            return { valid: false, error: `Sayı ${min} ile ${max} arasında olmalı!` };
        }

        return { valid: true, value: num };
    }
};

// IP-based Bot Farm Protection
class IPBotProtection {
    constructor() {
        // Cleanup eski kayıtları her saat (database'de gereksiz veri birikmemesi için)
        this.cleanupInterval = setInterval(() => this.cleanupOldRecords(), 3600000); // Her saat
    }

    // IP'den son N saatte kaç işlem yapılmış kontrol et
    async checkLimit(ipAddress, action, maxAllowed = 5, hours = 24) {
        try {
            // GÜVENLİK: SQL injection riskini önle - hours parametresini integer olarak validate et
            const validHours = Math.max(1, Math.min(168, parseInt(hours) || 24)); // 1-168 saat arası

            const result = await pool.query(
                `SELECT COUNT(*) as count FROM ip_activity
                 WHERE ip_address = $1 AND action = $2
                 AND created_at > NOW() - INTERVAL '1 hour' * $3`,
                [ipAddress, action, validHours]
            );

            const count = parseInt(result.rows[0].count);
            return count <= maxAllowed;
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
        // GÜVENLİK: IP spoofing'e karşı daha güvenli yöntem
        // Railway/Cloudflare gibi güvenilir proxy'ler için X-Real-IP öncelikli
        const realIP = socket.handshake.headers['x-real-ip'];
        if (realIP && this.isValidIP(realIP)) {
            return realIP.trim();
        }

        // X-Forwarded-For sadece güvenilir proxy'lerden geliyorsa kullan
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        if (forwarded) {
            const firstIP = forwarded.split(',')[0].trim();
            if (this.isValidIP(firstIP)) {
                return firstIP;
            }
        }

        // Fallback: Socket IP adresi
        return socket.handshake.address || 'unknown';
    }

    // IP adresi validasyonu (basit format kontrolü)
    isValidIP(ip) {
        if (!ip || typeof ip !== 'string') return false;
        // IPv4 formatı: 0-255.0-255.0-255.0-255
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        // IPv6 formatı (basitleştirilmiş)
        const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }
}

const botProtection = new IPBotProtection();

// Kullanıcı temizleme sınıfı - inaktif kullanıcıları otomatik sil
class UserCleanup {
    constructor(inactiveDays = 7) {
        this.inactiveDays = inactiveDays;
    }

    // İnaktif kullanıcıları temizle
    async cleanup() {
        try {
            const result = await pool.query(
                `DELETE FROM users
                 WHERE last_activity IS NULL
                    OR last_activity < NOW() - INTERVAL '${this.inactiveDays} days'
                 RETURNING id, nickname`
            );

            if (result.rows.length > 0) {
                console.log(`🧹 Temizlik: ${result.rows.length} inaktif kullanıcı silindi (${this.inactiveDays} günden eski)`);
                result.rows.forEach(user => {
                    console.log(`   - ${user.nickname} (${user.id})`);
                });
            }

            return { success: true, removed: result.rows.length, users: result.rows };
        } catch (error) {
            console.error('❌ Kullanıcı temizliği hatası:', error);
            return { success: false, error: error.message };
        }
    }

    // Kullanıcının son aktivitesini güncelle
    async updateActivity(userId) {
        try {
            await pool.query(
                'UPDATE users SET last_activity = NOW() WHERE id = $1',
                [userId]
            );
        } catch (error) {
            console.error('❌ last_activity güncelleme hatası:', error);
        }
    }
}

const userCleanup = new UserCleanup(7); // 7 günden eski kullanıcıları sil

// Admin login rate limiter - Brute-force koruması
class AdminLoginLimiter {
    constructor() {
        this.attempts = new Map(); // IP -> { count, resetAt }
        this.MAX_ATTEMPTS = 5;
        this.WINDOW_MS = 15 * 60 * 1000; // 15 dakika

        // Her 1 saatte bir eski kayıtları temizle
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    check(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip);

        if (!record) return true;

        // Reset zamanı geçtiyse temizle
        if (now >= record.resetAt) {
            this.attempts.delete(ip);
            return true;
        }

        // Max attempt'e ulaşıldıysa engelle
        return record.count < this.MAX_ATTEMPTS;
    }

    recordFailure(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip) || { count: 0, resetAt: now + this.WINDOW_MS };

        record.count++;
        record.resetAt = now + this.WINDOW_MS;
        this.attempts.set(ip, record);

        console.log(`⚠️  Admin login başarısız: ${ip} - Deneme: ${record.count}/${this.MAX_ATTEMPTS}`);
    }

    recordSuccess(ip) {
        this.attempts.delete(ip);
    }

    cleanup() {
        const now = Date.now();
        for (const [ip, record] of this.attempts.entries()) {
            if (now >= record.resetAt) {
                this.attempts.delete(ip);
            }
        }
    }

    getRemainingTime(ip) {
        const record = this.attempts.get(ip);
        if (!record) return 0;

        const remaining = Math.ceil((record.resetAt - Date.now()) / 1000 / 60);
        return Math.max(0, remaining);
    }
}

const adminLoginLimiter = new AdminLoginLimiter();

// WebSocket session middleware - HTTP session'ı Socket.io'da kullan
io.use((socket, next) => {
    // Express sessionMiddleware'i direkt kullan (cookieParser gerekmiyor, express-session kendi okur)
    // Sahte res objesi + cookieParser tekrar çalıştırmak sessionID'nin değişmesine sebep oluyordu
    sessionMiddleware(socket.request, {}, (err) => {
        if (err) {
            console.error('❌ Socket session hatası:', err);
            return next(err);
        }

        // DEBUG: Session kontrolü
        console.log('🔑 Socket session yüklendi:', {
            sessionID: socket.request.sessionID,
            hasSession: !!socket.request.session,
            userId: socket.request.session?.userId,
            isAdmin: socket.request.session?.isAdmin
        });

        next();
    });
});

// WebSocket güvenlik middleware'i
io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;
    const referer = socket.handshake.headers.referer;

    // Development'da origin kontrolü atla
    if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGIN !== '*') {
        // Origin varsa kontrol et, yoksa (undefined) izin ver (bazı WebSocket client'lar origin göndermez)
        if (origin && origin !== ALLOWED_ORIGIN && !referer?.startsWith(ALLOWED_ORIGIN)) {
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
    const totalClients = io.sockets.sockets.size;
    console.log('✓ Kullanıcı bağlandı:', socket.id, '- Toplam:', totalClients);

    // Session tracking - güvenlik için (HTTP-only session'dan oku)
    socket.data.userId = socket.request.session.userId || null;
    socket.data.isAdmin = socket.request.session.isAdmin || false;

    // Admin oturumu varsa logla
    if (socket.data.isAdmin) {
        console.log('✓ Admin oturumu devam ediyor:', socket.id);
    }

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
        // Rate limiting: 10 deneme/dakika (reconnect ve test için yeterli)
        if (!rateLimiter.check(socket.id, 'register-user', 10, 60000)) {
            callback({ success: false, error: 'Çok fazla kayıt denemesi! Lütfen 1 dakika bekleyin.' });
            console.log('⚠️  Rate limit: register-user -', socket.id);
            return;
        }

        // Bot farm koruması: IP bazlı limit (24 saatte max 10 kullanıcı)
        const clientIP = botProtection.getClientIP(socket);
        const ipAllowed = await botProtection.checkLimit(clientIP, 'register-user', 10, 24);

        if (!ipAllowed) {
            callback({ success: false, error: 'Bu IP adresinden çok fazla kayıt yapıldı. Lütfen daha sonra tekrar deneyin.' });
            console.log('🤖 Bot koruması: register-user engellendi -', clientIP);
            return;
        }

        // GÜVENLİK: Database transaction ile race condition önleme
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // GÜVENLİK: Input validation & XSS koruması
            const nickValidation = InputValidator.validateNickname(nickname);
            if (!nickValidation.valid) {
                await client.query('ROLLBACK');
                callback({ success: false, error: nickValidation.error });
                return;
            }
            const trimmedNick = nickValidation.value;

            // UX İYİLEŞTİRME: Aynı nickname var mı kontrol et - FOR UPDATE ile lock
            const userCheckResult = await client.query(
                'SELECT id, online, socket_id FROM users WHERE LOWER(nickname) = LOWER($1) FOR UPDATE',
                [trimmedNick]
            );

            let userId;
            let isReconnect = false;

            if (userCheckResult.rows.length > 0) {
                const existingUser = userCheckResult.rows[0];

                // UX İYİLEŞTİRME: Online ama farklı socket_id ise (sayfa yenileme/timeout)
                const isDifferentSocket = existingUser.socket_id !== socket.id;

                if (existingUser.online && !isDifferentSocket) {
                    // Kullanıcı gerçekten online ve aynı socket - kullanılamaz
                    await client.query('ROLLBACK');
                    callback({ success: false, error: 'Bu nick kullanımda!' });
                    return;
                }

                // Kullanıcı offline VEYA farklı socket (timeout/yenileme)
                // GÜVENLİK: Aynı IP'den mi kontrol et
                const ipCheckResult = await client.query(
                    'SELECT COUNT(*) FROM ip_activity WHERE ip_address = $1 AND action = $2 AND created_at > NOW() - INTERVAL \'24 hours\'',
                    [clientIP, 'register-user']
                );

                const sameIPRegistration = parseInt(ipCheckResult.rows[0].count) > 0;

                if (sameIPRegistration) {
                    // Aynı IP'den 24 saat içinde kayıt var - bu muhtemelen aynı kişi
                    // YENİ: Mevcut kaydı güncelle, silme
                    userId = existingUser.id;
                    await client.query(
                        'UPDATE users SET socket_id = $1, online = TRUE, last_activity = NOW() WHERE id = $2',
                        [socket.id, userId]
                    );
                    isReconnect = true;
                    console.log('✓ Kullanıcı tekrar bağlandı:', trimmedNick, '- IP:', clientIP, '- Sebep:', existingUser.online ? 'timeout/yenileme' : 'offline');
                } else {
                    // Farklı IP'den biri bu nickname'i kullanmaya çalışıyor
                    await client.query('ROLLBACK');
                    callback({ success: false, error: 'Bu nick başka bir IP adresinden kullanıldı!' });
                    return;
                }
            } else {
                // Yeni kullanıcı - UUID üret ve kayıt oluştur
                userId = crypto.randomUUID();

                await client.query(
                    'INSERT INTO users (id, nickname, socket_id, online, ip_address, last_activity) VALUES ($1, $2, $3, TRUE, $4, NOW())',
                    [userId, trimmedNick, socket.id, clientIP]
                );
            }

            // IP aktivitesini kaydet (sadece yeni kayıtlar için)
            if (!isReconnect) {
                await botProtection.recordActivity(clientIP, 'register-user');
            }

            // Transaction commit
            await client.query('COMMIT');

            // GÜVENLİK: Socket session'a userId kaydet
            socket.data.userId = userId;

            console.log('🔍 REGISTER DEBUG:', {
                hasSession: !!socket.request.session,
                sessionID: socket.request.sessionID,
                sessionKeys: socket.request.session ? Object.keys(socket.request.session) : 'NO SESSION'
            });

            // GÜVENLİK: Session kontrolü - eğer session varsa kaydet
            if (socket.request.session) {
                // HTTP-only cookie'ye userId kaydet (güvenli oturum)
                // NOT: Socket.IO'da session.regenerate() kullanmıyoruz çünkü Set-Cookie header gönderilemez
                socket.request.session.userId = userId;

                console.log('💾 Session\'a userId kaydediliyor:', {
                    sessionID: socket.request.sessionID,
                    userId: userId,
                    nickname: trimmedNick
                });

                socket.request.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('❌ Session save error:', saveErr);
                    } else {
                        console.log('✅ Session kaydedildi:', socket.request.sessionID);
                    }

                    // GÜVENLİK FIX: Callback'i session save SONRASINDA çağır
                    callback({ success: true, userId: userId, nickname: trimmedNick });

                    // Tüm kullanıcılara güncel listeyi gönder
                    getUsersByTeam().then(users => {
                        io.emit('users-update', users);
                    });

                    // Log mesajı - yeni kayıt mı yoksa reconnect mi?
                    if (isReconnect) {
                        console.log('✓ Kullanıcı yeniden bağlandı:', trimmedNick, '- IP:', clientIP, '- userId:', userId);
                    } else {
                        console.log('✓ Yeni kullanıcı kaydedildi:', trimmedNick, '- IP:', clientIP, '- userId:', userId);
                    }
                });
            } else {
                // Session yoksa direkt callback
                callback({ success: true, userId: userId, nickname: trimmedNick });

                // Tüm kullanıcılara güncel listeyi gönder
                getUsersByTeam().then(users => {
                    io.emit('users-update', users);
                });

                // Log mesajı
                if (isReconnect) {
                    console.log('✓ Kullanıcı yeniden bağlandı (session yok):', trimmedNick, '- IP:', clientIP, '- userId:', userId);
                } else {
                    console.log('✓ Yeni kullanıcı kaydedildi (session yok):', trimmedNick, '- IP:', clientIP, '- userId:', userId);
                }
            }

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Kullanıcı kayıt hatası:', err);
            callback({ success: false, error: 'Kayıt oluşturulamadı!' });
        } finally {
            client.release();
        }
    });

    // Kullanıcı reconnect (sayfa yenilendiğinde) - Session'dan otomatik oku
    socket.on('reconnect-user', async (callback) => {
        try {
            // DEBUG: Session durumu
            console.log('🔄 Reconnect talebi:', {
                hasSession: !!socket.request.session,
                sessionID: socket.request.sessionID,
                userId: socket.request.session?.userId,
                isAdmin: socket.request.session?.isAdmin,
                cookie: socket.handshake.headers.cookie ? 'var' : 'yok'
            });

            // GÜVENLİK: Sadece session'dan userId oku (HTTP-only cookie)
            const sessionUserId = socket.request.session?.userId;
            const sessionIsAdmin = !!socket.request.session?.isAdmin;

            if (!sessionUserId) {
                // userId yok ama admin session varsa admin restore et
                if (sessionIsAdmin) {
                    socket.data.userId = null;
                    socket.data.isAdmin = true;

                    callback({
                        success: true,
                        userId: null,
                        nickname: 'Admin',
                        teamId: null,
                        isCaptain: false,
                        isAdmin: true
                    });

                    console.log('✅ Reconnect: Admin session restore edildi (userId yok)');
                    return;
                }

                // Session yok - kullanıcı henüz login olmamış (normal durum)
                console.log('ℹ️  Reconnect: Session userId yok (kullanıcı giriş yapmamış)');
                callback({ success: false, requireLogin: true });
                return;
            }

            // Kullanıcının var olup olmadığını kontrol et
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [sessionUserId]);

            if (userResult.rows.length === 0) {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
                return;
            }

            const user = userResult.rows[0];

            // Kullanıcının socket_id'sini güncelle ve online yap
            await pool.query(
                'UPDATE users SET socket_id = $1, online = TRUE WHERE id = $2',
                [socket.id, sessionUserId]
            );

            // GÜVENLİK: Socket session'a userId kaydet
            socket.data.userId = sessionUserId;

            // Eğer kullanıcının takımı varsa socket.data.teamId kaydet
            if (user.team_id) {
                socket.data.teamId = user.team_id;
                socket.join(user.team_id);
            }

            // Son aktivite zamanını güncelle
            await userCleanup.updateActivity(sessionUserId);

            // Kullanıcı bilgilerini döndür (nickname dahil)
            callback({
                success: true,
                userId: user.id,
                nickname: user.nickname,
                teamId: user.team_id,
                isCaptain: user.is_captain,
                isAdmin: socket.request.session?.isAdmin || false
            });

            // Kullanıcı listesini güncelle
            const users = await getUsersByTeam();
            io.emit('users-update', users);

            console.log('Kullanıcı reconnect edildi:', user.nickname, '- Yeni socket:', socket.id);
        } catch (err) {
            console.error('Kullanıcı reconnect hatası:', err);
            callback({ success: false, error: 'Reconnect başarısız!' });
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
            // GÜVENLİK: userId kontrolü ve doğrulama
            if (!data.userId) {
                callback({ success: false, error: 'Kullanıcı girişi yapmalısınız!' });
                return;
            }

            // GÜVENLİK: Client'dan gelen userId ile socket session'daki userId eşleşmeli
            if (socket.data.userId !== data.userId) {
                callback({ success: false, error: 'Yetkisiz işlem!' });
                console.log('⚠️  Güvenlik: userId uyuşmazlığı -', socket.id);
                return;
            }

            // GÜVENLİK: Input validation & XSS koruması
            const teamNameValidation = InputValidator.validateTeamName(data.name);
            if (!teamNameValidation.valid) {
                callback({ success: false, error: teamNameValidation.error });
                return;
            }
            const teamName = teamNameValidation.value;

            const passwordValidation = InputValidator.validatePassword(data.password);
            if (!passwordValidation.valid) {
                callback({ success: false, error: passwordValidation.error });
                return;
            }
            const teamPassword = passwordValidation.value;

            // Takım var mı kontrol et
            const checkResult = await pool.query(
                'SELECT EXISTS(SELECT 1 FROM teams WHERE LOWER(name) = LOWER($1))',
                [teamName]
            );

            if (checkResult.rows[0].exists) {
                callback({ success: false, error: 'Bu isimde takım var!' });
                return;
            }

            // Kullanıcıyı al
            const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [data.userId]);
            const user = userResult.rows[0];

            if (!user) {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
                return;
            }

            // Güvenli UUID üret (sayfa yenilendiğinde değişmez)
            const teamId = crypto.randomUUID();
            const avatar = data.avatar || '🕵️';
            const color = data.color || '#3b82f6';

            // Takım oluştur ve captain nickname kaydet
            await pool.query(
                'INSERT INTO teams (id, name, password, score, avatar, color, captain_nickname) VALUES ($1, $2, $3, 0, $4, $5, $6)',
                [teamId, teamName, teamPassword, avatar, color, user.nickname]
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

            // Socket data'ya teamId kaydet (murder board için gerekli)
            socket.data.teamId = teamId;
            socket.join(teamId);

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
            // GÜVENLİK: userId kontrolü ve doğrulama
            if (!data.userId) {
                callback({ success: false, error: 'Kullanıcı girişi yapmalısınız!' });
                return;
            }

            // GÜVENLİK: Client'dan gelen userId ile socket session'daki userId eşleşmeli
            if (socket.data.userId !== data.userId) {
                callback({ success: false, error: 'Yetkisiz işlem!' });
                console.log('⚠️  Güvenlik: userId uyuşmazlığı (join-team) -', socket.id);
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

            // GÜVENLİK: Şifre validasyonu
            const passwordValidation = InputValidator.validatePassword(data.password);
            if (!passwordValidation.valid) {
                callback({ success: false, error: passwordValidation.error });
                return;
            }

            if (team.password !== passwordValidation.value) {
                callback({ success: false, error: 'Hatalı şifre!' });
                return;
            }

            // Kullanıcıyı takıma ekle
            await pool.query(
                'UPDATE users SET team_id = $1, is_captain = FALSE WHERE id = $2',
                [data.teamId, data.userId]
            );

            // Socket data'ya teamId kaydet (murder board için gerekli)
            socket.data.teamId = data.teamId;

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
            // GÜVENLİK: Input validation & XSS koruması
            const clueValidation = InputValidator.validateMessage(data.clue, 200);
            if (!clueValidation.valid) {
                callback({ success: false, error: clueValidation.error });
                return;
            }

            const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            // İpucu ekle
            await pool.query(
                'INSERT INTO clues (team_id, text, time) VALUES ($1, $2, $3)',
                [data.teamId, clueValidation.value, time]
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
    socket.on('admin-login', async (password, callback) => {
        // GÜVENLİK: Brute-force koruması
        const clientIP = botProtection.getClientIP(socket);

        if (!adminLoginLimiter.check(clientIP)) {
            const remainingMinutes = adminLoginLimiter.getRemainingTime(clientIP);
            callback({
                success: false,
                error: `Çok fazla başarısız deneme! ${remainingMinutes} dakika sonra tekrar deneyin.`
            });
            console.log(`🛡️  Admin login engellendi (rate limit): ${clientIP} - ${remainingMinutes} dakika`);
            return;
        }

        if (password === ADMIN_PASSWORD) {
            // Başarılı giriş - IP'yi temizle
            adminLoginLimiter.recordSuccess(clientIP);

            // GÜVENLİK: Admin session'ı aktif et (socket.data)
            socket.data.isAdmin = true;

            // ÖNEMLI: Admin olduğunda takım bilgisini temizle (admin takımsız olmalı)
            // Eğer kullanıcı daha önce bir takıma girmişse, team_id'yi database'den temizle
            if (socket.data.userId) {
                try {
                    await pool.query('UPDATE users SET team_id = NULL WHERE id = $1', [socket.data.userId]);
                    console.log('✓ Admin login: Kullanıcının team_id temizlendi:', socket.data.userId);
                } catch (err) {
                    console.error('Admin login team_id temizleme hatası:', err);
                }
            }

            // GÜVENLİK: Session kontrolü - eğer session varsa kaydet
            if (socket.request.session) {
                // HTTP-only session'a admin bilgisini kaydet
                // NOT: Socket.IO'da regenerate() kullanmıyoruz, cookie sync sorunu yaratıyor
                socket.request.session.isAdmin = true;

                // Eğer userId varsa onu da session'a kaydet
                if (socket.data.userId) {
                    socket.request.session.userId = socket.data.userId;
                }

                // team_id'yi session'dan temizle
                delete socket.request.session.teamId;

                socket.request.session.save((saveErr) => {
                    if (saveErr) {
                        console.error('❌ Admin session save error:', saveErr);
                    } else {
                        console.log('✅ Admin session saved. isAdmin=', socket.request.session.isAdmin, 'sessionID=', socket.request.sessionID);
                    }
                    callback({ success: true });
                    console.log('✓ Admin girişi yapıldı:', socket.id, '- IP:', clientIP);
                });
            } else {
                // Session yoksa direkt callback
                callback({ success: true });
                console.log('✓ Admin girişi yapıldı (session yok):', socket.id, '- IP:', clientIP);
            }
        } else {
            // Başarısız giriş - kaydet
            adminLoginLimiter.recordFailure(clientIP);

            callback({ success: false, error: 'Yanlış şifre!' });
            console.log('⚠️  Başarısız admin girişi:', socket.id, '- IP:', clientIP);
        }
    });

    // Puan değiştir (admin)
    socket.on('change-score', async (data, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: change-score -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-team -', socket.id);
            return;
        }

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

    // [REMOVED] Duplicate delete-user handler - see line 1835 for the correct implementation

    // KARAKTER YÖNETİMİ

    // Karakter ekle (admin)
    socket.on('add-character', async (characterData, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: add-character -', socket.id);
            return;
        }

        try {
            // Validasyon
            if (!characterData.name || characterData.name.trim().length === 0) {
                callback({ success: false, error: 'Karakter ismi zorunludur!' });
                return;
            }

            // XSS koruması - HTML etiketlerini temizle
            const safeName = validator.escape(characterData.name.trim());
            const safeDescription = characterData.description ? validator.escape(characterData.description.trim()) : null;
            const safeOccupation = characterData.occupation ? validator.escape(characterData.occupation.trim()) : null;
            const safeAdditionalInfo = characterData.additionalInfo ? validator.escape(characterData.additionalInfo.trim()) : null;

            // URL validasyonu
            let safePhotoUrl = null;
            if (characterData.photoUrl && characterData.photoUrl.trim().length > 0) {
                const photoUrl = characterData.photoUrl.trim();

                // Local path (/uploads/...) veya tam URL kabul et
                const isLocalPath = photoUrl.startsWith('/');
                const isValidUrl = validator.isURL(photoUrl, { protocols: ['http', 'https'], require_protocol: true });

                if (!isLocalPath && !isValidUrl) {
                    callback({ success: false, error: 'Geçersiz fotoğraf URL\'si!' });
                    return;
                }

                safePhotoUrl = photoUrl;
            }

            // Yaş validasyonu
            let age = null;
            if (characterData.age) {
                age = parseInt(characterData.age);
                if (isNaN(age) || age < 0 || age > 150) {
                    callback({ success: false, error: 'Geçersiz yaş değeri!' });
                    return;
                }
            }

            // Görünürlük kontrolü (default: false)
            const visibleToTeams = characterData.visibleToTeams === true;

            // UUID oluştur
            const characterId = 'char_' + crypto.randomBytes(8).toString('hex');

            // Database'e kaydet
            await pool.query(
                `INSERT INTO characters (id, name, photo_url, description, age, occupation, additional_info, visible_to_teams)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [characterId, safeName, safePhotoUrl, safeDescription, age, safeOccupation, safeAdditionalInfo, visibleToTeams]
            );

            callback({ success: true, characterId: characterId });
            console.log('✓ Karakter eklendi:', safeName, '- ID:', characterId, '- Görünür:', visibleToTeams);
        } catch (err) {
            console.error('Karakter ekleme hatası:', err);
            callback({ success: false, error: 'Karakter eklenemedi!' });
        }
    });

    // Karakterleri getir
    socket.on('get-characters', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback([]);
            console.log('⚠️  Yetkisiz admin işlemi: get-characters -', socket.id);
            return;
        }

        try {
            const result = await pool.query('SELECT * FROM characters ORDER BY created_at DESC');
            callback(result.rows);
        } catch (err) {
            console.error('Karakter listesi getirme hatası:', err);
            callback([]);
        }
    });

    // Karakter sil (admin)
    socket.on('delete-character', async (characterId, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-character -', socket.id);
            return;
        }

        try {
            const result = await pool.query('DELETE FROM characters WHERE id = $1 RETURNING name', [characterId]);

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Karakter bulunamadı!' });
                return;
            }

            const characterName = result.rows[0].name;
            callback({ success: true });
            console.log('Karakter silindi:', characterName);
        } catch (err) {
            console.error('Karakter silme hatası:', err);
            callback({ success: false, error: 'Karakter silinemedi!' });
        }
    });

    // Yüklenmiş karakter fotoğraflarını listele (admin)
    socket.on('get-uploaded-photos', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: get-uploaded-photos -', socket.id);
            return;
        }

        try {
            const fs = require('fs').promises;
            const path = require('path');
            const uploadsDir = path.join(__dirname, 'public', 'uploads', 'characters');

            // Klasör yoksa oluştur
            try {
                await fs.access(uploadsDir);
            } catch {
                await fs.mkdir(uploadsDir, { recursive: true });
            }

            const files = await fs.readdir(uploadsDir);

            // Sadece resim dosyalarını filtrele
            const imageFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });

            // Dosya yollarını URL'ye çevir
            const photoUrls = imageFiles.map(file => '/uploads/characters/' + file);

            callback({ success: true, photos: photoUrls });
        } catch (err) {
            console.error('Fotoğraf listesi hatası:', err);
            callback({ success: false, error: 'Fotoğraflar yüklenemedi!' });
        }
    });

    // Karakter görünürlüğünü değiştir (admin)
    socket.on('toggle-character-visibility', async (data, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: toggle-character-visibility -', socket.id);
            return;
        }

        try {
            const { characterId, visible } = data;

            await pool.query(
                'UPDATE characters SET visible_to_teams = $1 WHERE id = $2',
                [visible, characterId]
            );

            callback({ success: true });
            console.log('✓ Karakter görünürlüğü değişti:', characterId, '- Görünür:', visible);

            // Takımlara karakter listesini güncellemeleri için event gönder
            io.emit('character-visibility-changed', { characterId: characterId, visible: visible });
        } catch (err) {
            console.error('Karakter görünürlük hatası:', err);
            callback({ success: false, error: 'İşlem başarısız!' });
        }
    });

    // MURDER BOARD YÖNETİMİ

    // Karakterleri board için getir (takım üyeleri - SADECE VISIBLE OLANLAR)
    socket.on('get-characters-for-board', async (callback) => {
        try {
            const result = await pool.query(
                'SELECT id, name, photo_url FROM characters WHERE visible_to_teams = true ORDER BY name'
            );
            callback(result.rows);
        } catch (err) {
            console.error('Karakter listesi getirme hatası:', err);
            callback([]);
        }
    });

    // Board öğelerini ve bağlantılarını getir
    socket.on('get-board-items', async (callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ items: [], connections: [] });
            return;
        }

        try {
            const itemsResult = await pool.query(
                'SELECT * FROM murder_board_items WHERE team_id = $1 ORDER BY created_at',
                [teamId]
            );

            const connectionsResult = await pool.query(
                'SELECT * FROM murder_board_connections WHERE team_id = $1 ORDER BY created_at',
                [teamId]
            );

            callback({
                items: itemsResult.rows,
                connections: connectionsResult.rows
            });
        } catch (err) {
            console.error('Board öğelerini getirme hatası:', err);
            callback({ items: [], connections: [] });
        }
    });

    // Admin için başka bir takımın board'unu getir
    socket.on('get-team-board', async (teamId, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ items: [], connections: [] });
            console.log('⚠️  Yetkisiz admin işlemi: get-team-board -', socket.id);
            return;
        }

        if (!teamId) {
            callback({ items: [], connections: [] });
            return;
        }

        try {
            const itemsResult = await pool.query(
                'SELECT * FROM murder_board_items WHERE team_id = $1 ORDER BY created_at',
                [teamId]
            );

            const connectionsResult = await pool.query(
                'SELECT * FROM murder_board_connections WHERE team_id = $1 ORDER BY created_at',
                [teamId]
            );

            callback({
                items: itemsResult.rows,
                connections: connectionsResult.rows
            });
        } catch (err) {
            console.error('Team board getirme hatası:', err);
            callback({ items: [], connections: [] });
        }
    });

    // Board'a karakter ekle
    socket.on('add-board-item', async (itemData, callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            // Validasyon
            if (!itemData.characterId || !itemData.characterName) {
                callback({ success: false, error: 'Karakter bilgisi eksik!' });
                return;
            }

            // XSS koruması
            const safeName = validator.escape(itemData.characterName);
            const safeNote = itemData.note ? validator.escape(itemData.note) : null;
            const safePhotoUrl = itemData.photoUrl || null;

            // UUID oluştur
            const itemId = 'mbitem_' + crypto.randomBytes(8).toString('hex');

            // Database'e kaydet
            await pool.query(
                `INSERT INTO murder_board_items (id, team_id, character_id, character_name, photo_url, note, x, y)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [itemId, teamId, itemData.characterId, safeName, safePhotoUrl, safeNote, Math.floor(itemData.x), Math.floor(itemData.y)]
            );

            callback({ success: true, itemId: itemId });
            console.log('✓ Murder board item eklendi:', safeName, '- Team:', teamId);

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-item-added', { teamId: teamId, itemId: itemId });
        } catch (err) {
            console.error('Board item ekleme hatası:', err);
            callback({ success: false, error: 'Öğe eklenemedi!' });
        }
    });

    // Board öğesi pozisyonunu güncelle
    socket.on('update-board-item-position', async (data) => {
        const teamId = socket.data.teamId;

        if (!teamId) return;

        try {
            await pool.query(
                'UPDATE murder_board_items SET x = $1, y = $2 WHERE id = $3 AND team_id = $4',
                [Math.floor(data.x), Math.floor(data.y), data.itemId, teamId]
            );

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-item-position-updated', {
                teamId: teamId,
                itemId: data.itemId,
                x: Math.floor(data.x),
                y: Math.floor(data.y)
            });
        } catch (err) {
            console.error('Pozisyon güncelleme hatası:', err);
        }
    });

    // Board öğesi notunu güncelle
    socket.on('update-board-item-note', async (data, callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            // XSS koruması
            const safeNote = data.note ? validator.escape(data.note.trim()) : null;

            const result = await pool.query(
                'UPDATE murder_board_items SET note = $1 WHERE id = $2 AND team_id = $3 RETURNING character_name',
                [safeNote, data.itemId, teamId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Öğe bulunamadı!' });
                return;
            }

            callback({ success: true });
            console.log('✓ Murder board not güncellendi:', result.rows[0].character_name);
        } catch (err) {
            console.error('Not güncelleme hatası:', err);
            callback({ success: false, error: 'Not güncellenemedi!' });
        }
    });

    // Board öğesini sil
    socket.on('delete-board-item', async (itemId, callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            const result = await pool.query(
                'DELETE FROM murder_board_items WHERE id = $1 AND team_id = $2 RETURNING character_name',
                [itemId, teamId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Öğe bulunamadı!' });
                return;
            }

            callback({ success: true });
            console.log('Murder board item silindi:', result.rows[0].character_name);

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-item-deleted', { teamId: teamId, itemId: itemId });
        } catch (err) {
            console.error('Board item silme hatası:', err);
            callback({ success: false, error: 'Öğe silinemedi!' });
        }
    });

    // Board'a bağlantı ekle
    socket.on('add-board-connection', async (connData, callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            // Aynı bağlantı var mı kontrol et
            const existing = await pool.query(
                `SELECT id FROM murder_board_connections
                 WHERE team_id = $1 AND (
                    (from_item_id = $2 AND to_item_id = $3) OR
                    (from_item_id = $3 AND to_item_id = $2)
                 )`,
                [teamId, connData.fromItemId, connData.toItemId]
            );

            if (existing.rowCount > 0) {
                callback({ success: false, error: 'Bu bağlantı zaten var!' });
                return;
            }

            // UUID oluştur
            const connId = 'mbconn_' + crypto.randomBytes(8).toString('hex');

            // Database'e kaydet
            await pool.query(
                `INSERT INTO murder_board_connections (id, team_id, from_item_id, to_item_id)
                 VALUES ($1, $2, $3, $4)`,
                [connId, teamId, connData.fromItemId, connData.toItemId]
            );

            callback({ success: true, connectionId: connId });
            console.log('✓ Murder board bağlantısı eklendi - Team:', teamId);

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-connection-added', { teamId: teamId, connectionId: connId });
        } catch (err) {
            console.error('Bağlantı ekleme hatası:', err);
            callback({ success: false, error: 'Bağlantı eklenemedi!' });
        }
    });

    // Board bağlantısını sil
    socket.on('delete-board-connection', async (connectionId, callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            const result = await pool.query(
                'DELETE FROM murder_board_connections WHERE id = $1 AND team_id = $2',
                [connectionId, teamId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'Bağlantı bulunamadı!' });
                return;
            }

            callback({ success: true });
            console.log('Murder board bağlantısı silindi');

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-connection-deleted', { teamId: teamId, connectionId: connectionId });
        } catch (err) {
            console.error('Bağlantı silme hatası:', err);
            callback({ success: false, error: 'Bağlantı silinemedi!' });
        }
    });

    // Board'u temizle
    socket.on('clear-board', async (callback) => {
        const teamId = socket.data.teamId;

        if (!teamId) {
            callback({ success: false, error: 'Takım bulunamadı!' });
            return;
        }

        try {
            // Önce bağlantıları sil (foreign key)
            await pool.query('DELETE FROM murder_board_connections WHERE team_id = $1', [teamId]);

            // Sonra öğeleri sil
            const result = await pool.query('DELETE FROM murder_board_items WHERE team_id = $1', [teamId]);

            callback({ success: true, count: result.rowCount });
            console.log('Murder board temizlendi - Team:', teamId, '- Silinen öğe:', result.rowCount);

            // Admin paneldeki canlı izleme için event gönder
            io.emit('board-cleared', { teamId: teamId });
        } catch (err) {
            console.error('Board temizleme hatası:', err);
            callback({ success: false, error: 'Board temizlenemedi!' });
        }
    });

    // Oyunu sıfırla (admin)
    socket.on('reset-game', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: reset-game -', socket.id);
            return;
        }

        try {
            console.log('🔄 OYUN SIFIRLANIYOR - TÜM VERİLER SİLİNİYOR...');

            // Sırayla tüm tabloları sıfırla (foreign key constraints nedeniyle sıra önemli)

            // 1. Murder board connections (önce bağlantılar)
            await pool.query('DELETE FROM murder_board_connections');
            console.log('  ✓ Murder board bağlantıları silindi');

            // 2. Murder board items
            await pool.query('DELETE FROM murder_board_items');
            console.log('  ✓ Murder board kartları silindi');

            // 3. Team messages
            await pool.query('DELETE FROM team_messages');
            console.log('  ✓ Takım mesajları silindi');

            // 4. Team badges
            await pool.query('DELETE FROM team_badges');
            console.log('  ✓ Takım rozetleri silindi');

            // 5. Badges
            await pool.query('DELETE FROM badges');
            console.log('  ✓ Rozetler silindi');

            // 6. Clues (takım ipuçları)
            await pool.query('DELETE FROM clues');
            console.log('  ✓ Takım ipuçları silindi');

            // 7. General clues
            await pool.query('DELETE FROM general_clues');
            console.log('  ✓ Genel ipuçları silindi');

            // 8. Users (kullanıcılar)
            await pool.query('DELETE FROM users');
            console.log('  ✓ Kullanıcılar silindi');

            // 9. Teams (takımlar - cascade silme otomatik olacak ama yine de)
            const teamsResult = await pool.query('DELETE FROM teams RETURNING *');
            console.log('  ✓ Takımlar silindi:', teamsResult.rowCount);

            // 10. Characters (karakterler)
            await pool.query('DELETE FROM characters');
            console.log('  ✓ Karakterler silindi');

            // 11. IP Activity (IP logları)
            await pool.query('DELETE FROM ip_activity');
            console.log('  ✓ IP logları silindi');

            // 12. Credits (emeği geçenler)
            await pool.query('DELETE FROM credits');
            console.log('  ✓ Credits silindi');

            callback({ success: true });

            // Tüm clientlara bildir
            const teams = await getAllTeams();
            io.emit('teams-update', teams);
            io.emit('game-reset');

            console.log('✅ OYUN TAMAMEN SIFIRLANDI! Tüm veriler temizlendi.');
        } catch (err) {
            console.error('❌ Oyun sıfırlama hatası:', err);
            callback({ success: false, error: 'Oyun sıfırlanamadı! Hata: ' + err.message });
        }
    });

    // Genel ipucu gönder (admin)
    socket.on('send-general-clue', async (clue, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: send-general-clue -', socket.id);
            return;
        }

        // Rate limiting: 20 ipucu/dakika (admin spam önleme)
        if (!rateLimiter.check(socket.id, 'send-general-clue', 20, 60000)) {
            callback({ success: false, error: 'Çok hızlı ipucu gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: send-general-clue -', socket.id);
            return;
        }

        // GÜVENLİK: Input validation & XSS koruması
        const clueValidation = InputValidator.validateMessage(clue, 500);
        if (!clueValidation.valid) {
            callback({ success: false, error: clueValidation.error });
            return;
        }

        try {
            const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            // Veritabanına kaydet
            await pool.query(
                'INSERT INTO general_clues (text, time) VALUES ($1, $2)',
                [clueValidation.value, time]
            );

            // Tüm kullanıcılara ipucu gönder
            const generalClues = await getAllGeneralClues();
            io.emit('general-clues-update', generalClues);

            // Bildirim olarak gönder
            io.emit('general-clue-notification', {
                clue: clueValidation.value,
                time: time
            });

            callback({ success: true });
            console.log('Genel ipucu gönderildi:', clueValidation.value);
        } catch (err) {
            console.error('Genel ipucu gönderme hatası:', err);
            callback({ success: false, error: 'İpucu gönderilemedi!' });
        }
    });

    // Tek bir ipucunu sil (admin)
    socket.on('delete-general-clue', async (clueId, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-general-clue -', socket.id);
            return;
        }

        // Rate limiting: 30 silme/dakika
        if (!rateLimiter.check(socket.id, 'delete-general-clue', 30, 60000)) {
            callback({ success: false, error: 'Çok hızlı silme işlemi yapıyorsunuz!' });
            console.log('⚠️  Rate limit: delete-general-clue -', socket.id);
            return;
        }

        // GÜVENLİK: ID validation
        if (!Number.isInteger(clueId) || clueId <= 0) {
            callback({ success: false, error: 'Geçersiz ipucu ID!' });
            return;
        }

        try {
            // Veritabanından sil
            const result = await pool.query(
                'DELETE FROM general_clues WHERE id = $1',
                [clueId]
            );

            if (result.rowCount === 0) {
                callback({ success: false, error: 'İpucu bulunamadı!' });
                return;
            }

            // Güncel ipuçlarını tüm kullanıcılara gönder
            const generalClues = await getAllGeneralClues();
            io.emit('general-clues-update', generalClues);

            callback({ success: true });
            console.log('İpucu silindi: ID', clueId);
        } catch (err) {
            console.error('İpucu silme hatası:', err);
            callback({ success: false, error: 'İpucu silinemedi!' });
        }
    });

    // Tüm ipuçlarını sil (admin)
    socket.on('clear-all-clues', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: clear-all-clues -', socket.id);
            return;
        }

        // Rate limiting: 5 toplu silme/dakika (daha sıkı limit)
        if (!rateLimiter.check(socket.id, 'clear-all-clues', 5, 60000)) {
            callback({ success: false, error: 'Çok sık toplu silme işlemi yapıyorsunuz!' });
            console.log('⚠️  Rate limit: clear-all-clues -', socket.id);
            return;
        }

        try {
            // Tüm ipuçlarını sil
            const result = await pool.query('DELETE FROM general_clues');

            // Tüm kullanıcılara boş liste gönder
            io.emit('general-clues-update', []);

            callback({ success: true });
            console.log('Tüm ipuçları silindi! Toplam:', result.rowCount);
        } catch (err) {
            console.error('Toplu ipucu silme hatası:', err);
            callback({ success: false, error: 'İpuçları silinemedi!' });
        }
    });

    // Duyuru gönder (admin)
    socket.on('send-announcement', (message, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: send-announcement -', socket.id);
            return;
        }

        // Rate limiting: 10 duyuru/dakika
        if (!rateLimiter.check(socket.id, 'send-announcement', 10, 60000)) {
            callback({ success: false, error: 'Çok fazla duyuru gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: send-announcement -', socket.id);
            return;
        }

        // GÜVENLİK: Input validation & XSS koruması
        const messageValidation = InputValidator.validateMessage(message, 300);
        if (!messageValidation.valid) {
            callback({ success: false, error: messageValidation.error });
            return;
        }

        // Tüm kullanıcılara bildirim gönder
        io.emit('notification', {
            title: 'Yönetici Duyurusu',
            message: messageValidation.value,
            type: 'announcement'
        });

        callback({ success: true });
        console.log('Duyuru gönderildi:', messageValidation.value);
    });

    // Takımlar arası mesaj gönder
    socket.on('send-team-message', async (data, callback) => {
        // GÜVENLİK: Kullanıcı kontrolü
        if (!socket.data.userId) {
            callback({ success: false, error: 'Önce giriş yapmalısınız!' });
            return;
        }

        // Rate limiting: 20 mesaj/dakika
        if (!rateLimiter.check(socket.id, 'send-team-message', 20, 60000)) {
            callback({ success: false, error: 'Çok hızlı mesaj gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: send-team-message -', socket.id);
            return;
        }

        const message = data.message || data; // Geriye dönük uyumluluk için
        const targetTeamId = data.targetTeamId || null;

        // GÜVENLİK: Input validation & XSS koruması
        const messageValidation = InputValidator.validateMessage(message, 500);
        if (!messageValidation.valid) {
            callback({ success: false, error: messageValidation.error });
            return;
        }

        try {
            // Kullanıcı bilgilerini al
            const userResult = await pool.query(
                'SELECT u.id, u.nickname, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = $1',
                [socket.data.userId]
            );

            if (userResult.rows.length === 0) {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
                return;
            }

            const user = userResult.rows[0];

            if (!user.team_id) {
                callback({ success: false, error: 'Takıma katılmalısınız!' });
                return;
            }

            // Takım rengi bilgisi
            const teamColorResult = await pool.query('SELECT color FROM teams WHERE id = $1', [user.team_id]);
            const teamColor = teamColorResult.rows.length > 0 ? teamColorResult.rows[0].color : '#3b82f6';

            // Hedef takım bilgisi
            let targetTeamName = null;
            if (targetTeamId) {
                // Admin'e özel mesaj
                if (targetTeamId === 'admin') {
                    targetTeamName = 'Admin';
                } else {
                    // Normal takıma özel mesaj
                    const targetTeamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [targetTeamId]);
                    if (targetTeamResult.rows.length === 0) {
                        callback({ success: false, error: 'Hedef takım bulunamadı!' });
                        return;
                    }
                    targetTeamName = targetTeamResult.rows[0].name;
                }
            }

            // Mesajı veritabanına kaydet
            const insertResult = await pool.query(
                'INSERT INTO team_messages (team_id, user_id, nickname, team_name, team_color, message, target_team_id, target_team_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [user.team_id, user.id, user.nickname, user.team_name, teamColor, messageValidation.value, targetTeamId, targetTeamName]
            );

            const newMessage = insertResult.rows[0];

            // Tüm kullanıcılara mesajı gönder
            io.emit('new-team-message', newMessage);

            // Admin'e özel mesaj ise admin socket'larına bildir
            if (targetTeamId === 'admin') {
                // Tüm admin socket'larına özel bildirim gönder
                io.sockets.sockets.forEach((adminSocket) => {
                    if (adminSocket.data.isAdmin) {
                        adminSocket.emit('new-admin-message', newMessage);
                    }
                });
            }

            callback({ success: true, message: newMessage });

            if (targetTeamId === 'admin') {
                console.log(`👑 ${user.nickname} (${user.team_name}) → ADMIN: ${messageValidation.value.substring(0, 50)}...`);
            } else if (targetTeamId) {
                console.log(`💬 ${user.nickname} (${user.team_name}) → ${targetTeamName}: ${messageValidation.value.substring(0, 50)}...`);
            } else {
                console.log(`💬 ${user.nickname} (${user.team_name}) → HERKESE: ${messageValidation.value.substring(0, 50)}...`);
            }
        } catch (err) {
            console.error('Mesaj gönderme hatası:', err);
            callback({ success: false, error: 'Mesaj gönderilemedi!' });
        }
    });

    // Takım dürtme (Poke) sistemi
    socket.on('poke-team', async (targetTeamId, callback) => {
        // GÜVENLİK: Kullanıcı kontrolü
        if (!socket.data.userId) {
            callback({ success: false, error: 'Önce giriş yapmalısınız!' });
            return;
        }

        try {
            // Kullanıcı bilgilerini al
            const userResult = await pool.query(
                'SELECT u.id, u.nickname, u.team_id, t.name as team_name, t.color as team_color FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = $1',
                [socket.data.userId]
            );

            if (userResult.rows.length === 0) {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
                return;
            }

            const user = userResult.rows[0];

            if (!user.team_id) {
                callback({ success: false, error: 'Takıma katılmalısınız!' });
                return;
            }

            // Kendi takımını dürtmeye çalışıyor mu?
            if (user.team_id === targetTeamId) {
                callback({ success: false, error: 'Kendi takımınızı dürtemezsiniz!' });
                return;
            }

            // Hedef takım var mı?
            const targetTeamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [targetTeamId]);
            if (targetTeamResult.rows.length === 0) {
                callback({ success: false, error: 'Hedef takım bulunamadı!' });
                return;
            }

            const targetTeamName = targetTeamResult.rows[0].name;

            // RATE LIMITING: Bir takım, aynı takımı 1 dakikada en fazla 1 kere dürtebilir
            const now = Date.now();
            const teamPokeMap = pokeRateLimiter.get(user.team_id) || new Map();
            const lastPokeTime = teamPokeMap.get(targetTeamId) || 0;
            const timeSinceLastPoke = now - lastPokeTime;

            if (timeSinceLastPoke < 60000) { // 60 saniye = 1 dakika
                const remainingSeconds = Math.ceil((60000 - timeSinceLastPoke) / 1000);
                callback({
                    success: false,
                    error: `Bu takımı ${remainingSeconds} saniye sonra tekrar dürtebilirsiniz!`
                });
                return;
            }

            // Rate limiting kaydını güncelle
            teamPokeMap.set(targetTeamId, now);
            pokeRateLimiter.set(user.team_id, teamPokeMap);

            // Hedef takımdaki tüm kullanıcılara dürtme bildirimi gönder
            io.sockets.sockets.forEach((userSocket) => {
                if (userSocket.data.userId) {
                    // Bu socket'in takımını kontrol et
                    pool.query('SELECT team_id FROM users WHERE id = $1', [userSocket.data.userId])
                        .then(result => {
                            if (result.rows.length > 0 && result.rows[0].team_id === targetTeamId) {
                                // Bu kullanıcı hedef takımda, dürtme bildirimi gönder
                                userSocket.emit('team-poke', {
                                    fromTeamId: user.team_id,
                                    fromTeamName: user.team_name,
                                    fromTeamColor: user.team_color
                                });
                            }
                        })
                        .catch(err => {
                            console.error('Poke broadcast hatası:', err);
                        });
                }
            });

            callback({ success: true });

            console.log(`👋 ${user.team_name} → ${targetTeamName} dürtüldü!`);
        } catch (err) {
            console.error('Dürtme hatası:', err);
            callback({ success: false, error: 'Dürtme gönderilemedi!' });
        }
    });

    // Takım mesajlarını yükle (pagination)
    socket.on('load-team-messages', async (data, callback) => {
        try {
            // Kullanıcının team_id'sini al
            const userResult = await pool.query('SELECT team_id FROM users WHERE id = $1', [socket.data.userId]);

            if (userResult.rows.length === 0 || !userResult.rows[0].team_id) {
                callback({ success: false, error: 'Takıma katılmalısınız!' });
                return;
            }

            const userTeamId = userResult.rows[0].team_id;
            const page = data?.page || 1;
            const limit = 50;
            const offset = (page - 1) * limit;
            const filterTeamId = data?.filterTeamId || null; // Filtre parametresi

            // Filtrelenmiş mesajları al
            const messages = await getFilteredTeamMessages(userTeamId, filterTeamId, limit, offset);
            const totalCount = await getFilteredTeamMessagesCount(userTeamId, filterTeamId);
            const totalPages = Math.ceil(totalCount / limit);

            callback({
                success: true,
                messages: messages,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalMessages: totalCount,
                    hasMore: page < totalPages
                }
            });
        } catch (err) {
            console.error('Mesaj yükleme hatası:', err);
            callback({ success: false, error: 'Mesajlar yüklenemedi!' });
        }
    });

    // Admin için herhangi bir takımın chat'ini yükle
    socket.on('admin-load-team-chat', async (teamId, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: admin-load-team-chat -', socket.id);
            return;
        }

        try {
            // Takım var mı kontrol et
            const teamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
            if (teamResult.rows.length === 0) {
                callback({ success: false, error: 'Takım bulunamadı!' });
                return;
            }

            const teamName = teamResult.rows[0].name;
            const limit = 100; // Admin için daha fazla mesaj göster
            const offset = 0;

            // Takımın görebildiği mesajları yükle (admin mesajları hariç)
            const messages = await getTeamMessages(teamId, limit, offset, true);
            const totalCount = await getTeamMessagesCount(teamId, true);

            callback({
                success: true,
                teamName: teamName,
                messages: messages,
                totalCount: totalCount
            });

            console.log(`👁️  Admin chat izleme: ${teamName} (${messages.length} mesaj - admin mesajları hariç)`);
        } catch (err) {
            console.error('Admin chat yükleme hatası:', err);
            callback({ success: false, error: 'Chat yüklenemedi!' });
        }
    });

    // Admin için tüm admin mesajlarını yükle
    socket.on('load-admin-messages', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: load-admin-messages -', socket.id);
            return;
        }

        try {
            // Admin mesajlarını getir (hem takımlardan gelen hem de admin'in gönderdiği)
            const result = await pool.query(`
                SELECT * FROM team_messages
                WHERE target_team_id = 'admin' OR team_id IS NULL
                ORDER BY created_at DESC
                LIMIT 100
            `);

            callback({
                success: true,
                messages: result.rows
            });

            console.log(`👑 Admin mesajları yüklendi: ${result.rows.length} mesaj`);
        } catch (err) {
            console.error('Admin mesajları yükleme hatası:', err);
            callback({ success: false, error: 'Mesajlar yüklenemedi!' });
        }
    });

    // Admin için tüm takımları listele
    socket.on('admin-get-teams', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: admin-get-teams -', socket.id);
            return;
        }

        try {
            const result = await pool.query(`
                SELECT id, name, color, score, created_at
                FROM teams
                ORDER BY name ASC
            `);

            callback({
                success: true,
                teams: result.rows
            });

            console.log(`📋 Admin için takımlar listesi yüklendi: ${result.rows.length} takım`);
        } catch (err) {
            console.error('Takımlar listesi yükleme hatası:', err);
            callback({ success: false, error: 'Takımlar yüklenemedi!' });
        }
    });

    // Admin'den takıma cevap gönder
    socket.on('admin-send-message', async (data, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: admin-send-message -', socket.id);
            return;
        }

        // Rate limiting: 30 mesaj/dakika
        if (!rateLimiter.check(socket.id, 'admin-send-message', 30, 60000)) {
            callback({ success: false, error: 'Çok hızlı mesaj gönderiyorsunuz!' });
            console.log('⚠️  Rate limit: admin-send-message -', socket.id);
            return;
        }

        const message = data.message;
        const targetTeamId = data.targetTeamId;

        // GÜVENLİK: Input validation & XSS koruması
        const messageValidation = InputValidator.validateMessage(message, 500);
        if (!messageValidation.valid) {
            callback({ success: false, error: messageValidation.error });
            return;
        }

        if (!targetTeamId) {
            callback({ success: false, error: 'Hedef takım belirtilmedi!' });
            return;
        }

        try {
            // Hedef takım bilgilerini al
            const teamResult = await pool.query('SELECT name FROM teams WHERE id = $1', [targetTeamId]);
            if (teamResult.rows.length === 0) {
                callback({ success: false, error: 'Hedef takım bulunamadı!' });
                return;
            }

            const targetTeamName = teamResult.rows[0].name;

            // Mesajı veritabanına kaydet (admin'den gönderiliyor, team_id ve user_id NULL)
            const insertResult = await pool.query(
                'INSERT INTO team_messages (team_id, user_id, nickname, team_name, team_color, message, target_team_id, target_team_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [null, null, 'Admin', 'Yönetim', '#fbbf24', messageValidation.value, targetTeamId, targetTeamName]
            );

            const newMessage = insertResult.rows[0];

            // Tüm kullanıcılara mesajı gönder
            io.emit('new-team-message', newMessage);

            callback({ success: true, message: newMessage });

            console.log(`👑 ADMIN → ${targetTeamName}: ${messageValidation.value.substring(0, 50)}...`);
        } catch (err) {
            console.error('Admin mesaj gönderme hatası:', err);
            callback({ success: false, error: 'Mesaj gönderilemedi!' });
        }
    });

    // Admin için oyun istatistiklerini getir
    socket.on('get-statistics', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: get-statistics -', socket.id);
            return;
        }

        try {
            // Genel İstatistikler
            const teamsResult = await pool.query('SELECT COUNT(*) FROM teams');
            const usersResult = await pool.query('SELECT COUNT(*) FROM users');
            const messagesResult = await pool.query('SELECT COUNT(*) FROM team_messages');
            const cluesResult = await pool.query('SELECT COUNT(*) FROM clues');

            const totalTeams = parseInt(teamsResult.rows[0].count);
            const totalUsers = parseInt(usersResult.rows[0].count);
            const totalMessages = parseInt(messagesResult.rows[0].count);
            const totalClues = parseInt(cluesResult.rows[0].count);

            // Takım başına mesaj sayısı
            const teamMessagesResult = await pool.query(`
                SELECT t.id, t.name, COUNT(tm.id) as message_count
                FROM teams t
                LEFT JOIN team_messages tm ON t.id = tm.team_id
                GROUP BY t.id, t.name
                ORDER BY message_count DESC
            `);

            // Takım başına ipucu sayısı
            const teamCluesResult = await pool.query(`
                SELECT t.id, t.name, COUNT(c.id) as clue_count
                FROM teams t
                LEFT JOIN clues c ON t.id = c.team_id
                GROUP BY t.id, t.name
                ORDER BY clue_count DESC
            `);

            // En aktif kullanıcılar (mesaj bazlı)
            const activeUsersResult = await pool.query(`
                SELECT u.nickname, u.team_id, t.name as team_name, COUNT(tm.id) as message_count
                FROM users u
                LEFT JOIN team_messages tm ON u.id = tm.user_id
                LEFT JOIN teams t ON u.team_id = t.id
                GROUP BY u.id, u.nickname, u.team_id, t.name
                ORDER BY message_count DESC
                LIMIT 10
            `);

            // Puan sıralaması
            const scoringResult = await pool.query(`
                SELECT id, name, score, avatar, color
                FROM teams
                ORDER BY score DESC
            `);

            // Tüm veriler
            const allTeams = await getAllTeams();
            const allUsers = await getAllUsers();

            callback({
                success: true,
                stats: {
                    overview: {
                        totalTeams: totalTeams,
                        totalUsers: totalUsers,
                        totalMessages: totalMessages,
                        totalClues: totalClues
                    },
                    messaging: {
                        byTeam: teamMessagesResult.rows,
                        avgPerTeam: totalTeams > 0 ? (totalMessages / totalTeams).toFixed(1) : 0
                    },
                    clues: {
                        byTeam: teamCluesResult.rows,
                        avgPerTeam: totalTeams > 0 ? (totalClues / totalTeams).toFixed(1) : 0
                    },
                    users: {
                        mostActive: activeUsersResult.rows
                    },
                    scoring: scoringResult.rows,
                    raw: {
                        teams: allTeams,
                        users: allUsers
                    }
                }
            });

            console.log('📊 İstatistikler yüklendi');
        } catch (err) {
            console.error('İstatistik yükleme hatası:', err);
            callback({ success: false, error: 'İstatistikler yüklenemedi!' });
        }
    });

    // Oyunu başlat (admin)
    socket.on('start-game', (data, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: start-game -', socket.id);
            return;
        }

        if (gameState.started) {
            callback({ success: false, error: 'Oyun zaten başlamış!' });
            return;
        }

        // GÜVENLİK: Input validation
        const minutesValidation = InputValidator.validateNumber(data.minutes, 1, 300);
        if (!minutesValidation.valid) {
            callback({ success: false, error: minutesValidation.error });
            return;
        }

        let phaseTitle = 'Oyun Başladı';
        if (data.title) {
            const titleValidation = InputValidator.validateMessage(data.title, 50);
            if (titleValidation.valid) {
                phaseTitle = titleValidation.value;
            }
        }

        gameState.started = true;
        gameState.countdown = minutesValidation.value * 60; // Dakikayı saniyeye çevir
        gameState.phaseTitle = phaseTitle;
        startCountdown();

        io.emit('game-started', {
            countdown: gameState.countdown,
            phaseTitle: gameState.phaseTitle
        });

        // Oyun başlama bildirimi gönder
        const phaseText = phaseTitle.toUpperCase();
        io.emit('notification', {
            title: '🎮 Oyun Başladı',
            message: `${phaseText} BAŞLADI! ${minutesValidation.value} DAKİKA SÜRENİZ VAR.`,
            type: 'announcement'
        });

        callback({ success: true });
        console.log(`Oyun başlatıldı! Başlık: "${gameState.phaseTitle}" - Süre: ${data.minutes} dakika`);
    });

    // Countdown'a süre ekle (admin)
    socket.on('add-time', (seconds, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: add-time -', socket.id);
            return;
        }

        if (!gameState.started) {
            callback({ success: false, error: 'Oyun başlamadı!' });
            return;
        }

        // GÜVENLİK: Input validation
        const secondsValidation = InputValidator.validateNumber(seconds, -3600, 3600);
        if (!secondsValidation.valid) {
            callback({ success: false, error: secondsValidation.error });
            return;
        }

        gameState.countdown += secondsValidation.value;
        io.emit('countdown-update', gameState.countdown);

        // Süre ekleme bildirimi gönder
        const minutes = Math.floor(secondsValidation.value / 60);
        io.emit('notification', {
            title: '⏱️ Süre Eklendi',
            message: `Oyuna ${minutes} dakika eklendi! Yeni toplam süre: ${Math.floor(gameState.countdown / 60)} dakika.`,
            type: 'announcement'
        });

        callback({ success: true });
        console.log(`${secondsValidation.value} saniye eklendi. Yeni süre: ${gameState.countdown}s`);
    });

    // Oyunu bitir (admin)
    socket.on('end-game', (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: end-game -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: add-credit -', socket.id);
            return;
        }

        // GÜVENLİK: Input validation & XSS koruması
        const nameValidation = InputValidator.validateMessage(name, 50);
        if (!nameValidation.valid) {
            callback({ success: false, error: nameValidation.error });
            return;
        }

        try {
            const trimmedName = nameValidation.value;

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: remove-credit -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: update-credit-content -', socket.id);
            return;
        }

        try {
            // GÜVENLİK: Input validation & XSS koruması
            const contentValidation = InputValidator.validateMessage(data.content || '', 2000);
            if (!contentValidation.valid) {
                callback({ success: false, error: contentValidation.error });
                return;
            }

            const result = await pool.query(
                'UPDATE credits SET content = $1 WHERE id = $2 RETURNING name',
                [contentValidation.value, data.creditId]
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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: create-badge -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: award-badge -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: remove-badge-from-team -', socket.id);
            return;
        }

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
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-badge -', socket.id);
            return;
        }

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

    // IP Loglarını getir (admin)
    socket.on('get-ip-logs', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: get-ip-logs -', socket.id);
            return;
        }

        try {
            const result = await pool.query(`
                SELECT
                    ip_address,
                    action,
                    COUNT(*) as count,
                    MAX(created_at) as last_activity
                FROM ip_activity
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY ip_address, action
                ORDER BY last_activity DESC
            `);

            callback({ success: true, logs: result.rows });
            console.log('IP logları getirildi:', result.rows.length, 'kayıt');
        } catch (err) {
            console.error('IP logları getirme hatası:', err);
            callback({ success: false, error: 'Loglar getirilemedi!' });
        }
    });

    // IP loglarını sıfırla (admin)
    socket.on('clear-ip-logs', async (data, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: clear-ip-logs -', socket.id);
            return;
        }

        try {
            let result;

            if (data.ipAddress && data.action) {
                // Belirli IP ve action için sil
                result = await pool.query(
                    'DELETE FROM ip_activity WHERE ip_address = $1 AND action = $2',
                    [data.ipAddress, data.action]
                );
                console.log(`IP log sıfırlandı: ${data.ipAddress} - ${data.action}`);
            } else if (data.ipAddress) {
                // Belirli IP için tüm logları sil
                result = await pool.query(
                    'DELETE FROM ip_activity WHERE ip_address = $1',
                    [data.ipAddress]
                );
                console.log(`IP'nin tüm logları sıfırlandı: ${data.ipAddress}`);
            } else {
                // Tüm logları sil
                result = await pool.query('DELETE FROM ip_activity');
                console.log('Tüm IP logları sıfırlandı');
            }

            callback({ success: true, deletedCount: result.rowCount });
        } catch (err) {
            console.error('IP log sıfırlama hatası:', err);
            callback({ success: false, error: 'Loglar sıfırlanamadı!' });
        }
    });

    // Kullanıcıları getir (takımlara göre gruplandırılmış)
    socket.on('get-users-by-team', async (callback) => {
        try {
            const users = await getUsersByTeam();
            callback(users);
        } catch (err) {
            console.error('Kullanıcılar getirme hatası:', err);
            callback([]);
        }
    });

    // Tüm kullanıcıları getir (admin)
    socket.on('get-all-users', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: get-all-users -', socket.id);
            return;
        }

        try {
            // Tüm kullanıcıları getir (en son kaydolanlar en üstte)
            const result = await pool.query(`
                SELECT
                    u.id,
                    u.nickname,
                    u.ip_address,
                    u.online,
                    u.created_at,
                    t.name as team_name,
                    t.id as team_id
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                ORDER BY u.created_at DESC
            `);

            callback({ success: true, users: result.rows });
        } catch (err) {
            console.error('Tüm kullanıcılar getirme hatası:', err);
            callback({ success: false, error: 'Kullanıcılar getirilemedi!' });
        }
    });

    // Kullanıcı sil (admin)
    socket.on('delete-user', async (userId, callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-user -', socket.id);
            return;
        }

        try {
            // Kullanıcıyı sil
            const result = await pool.query(
                'DELETE FROM users WHERE id = $1 RETURNING nickname, ip_address, socket_id',
                [userId]
            );

            if (result.rowCount > 0) {
                const deletedUser = result.rows[0];
                console.log(`✓ Kullanıcı silindi: ${deletedUser.nickname} (IP: ${deletedUser.ip_address})`);

                // Silinen kullanıcıya bildirim gönder (eğer online ise VE admin değilse)
                if (deletedUser.socket_id) {
                    const targetSocket = io.sockets.sockets.get(deletedUser.socket_id);
                    // Sadece admin olmayan kullanıcılara user-deleted eventi gönder
                    if (targetSocket && !targetSocket.data.isAdmin) {
                        io.to(deletedUser.socket_id).emit('user-deleted');
                    }
                }

                // Tüm kullanıcılara güncel listeyi gönder
                const users = await getUsersByTeam();
                io.emit('users-update', users);

                // Takım listesini güncelle (eğer kullanıcı bir takımdaysa, takım güncellensin)
                const teams = await getAllTeams();
                io.emit('teams-update', teams);

                callback({ success: true, user: deletedUser });
            } else {
                callback({ success: false, error: 'Kullanıcı bulunamadı!' });
            }
        } catch (err) {
            console.error('Kullanıcı silme hatası:', err);
            callback({ success: false, error: 'Kullanıcı silinemedi!' });
        }
    });

    // Tüm kullanıcıları sil (admin)
    socket.on('delete-all-users', async (callback) => {
        // GÜVENLİK: Admin kontrolü
        if (!socket.data.isAdmin) {
            callback({ success: false, error: 'Yetkisiz işlem!' });
            console.log('⚠️  Yetkisiz admin işlemi: delete-all-users -', socket.id);
            return;
        }

        try {
            // Tüm kullanıcıları sil
            const result = await pool.query('DELETE FROM users RETURNING id');

            if (result.rowCount > 0) {
                console.log(`✓ Tüm kullanıcılar silindi: ${result.rowCount} kayıt`);

                // Tüm kullanıcılara güncel listeyi gönder
                const users = await getUsersByTeam();
                io.emit('users-update', users);

                callback({ success: true, deletedCount: result.rowCount });
            } else {
                callback({ success: false, error: 'Silinecek kullanıcı yok!' });
            }
        } catch (err) {
            console.error('Tüm kullanıcılar silme hatası:', err);
            callback({ success: false, error: 'Kullanıcılar silinemedi!' });
        }
    });

    // Kullanıcı logout (çıkış)
    socket.on('logout-user', async (callback) => {
        try {
            const userId = socket.data.userId;

            // Kullanıcıyı veritabanında offline yap (sayfa yenilemeden çıkış yapıldığında)
            if (userId) {
                await pool.query('UPDATE users SET online = FALSE WHERE id = $1', [userId]);
                console.log('✓ Kullanıcı offline yapıldı:', userId);
            }

            // GÜVENLİK: Session'ı temizle (HTTP-only cookie)
            if (socket.request.session) {
                socket.request.session.destroy((err) => {
                    if (err) {
                        console.error('Session destroy error:', err);
                    }
                    socket.data.userId = null;
                    socket.data.isAdmin = false;
                    console.log('✓ Kullanıcı çıkış yaptı:', socket.id);
                    if (callback) callback({ success: true });
                });
            } else {
                // Session yoksa direkt temizle
                socket.data.userId = null;
                socket.data.isAdmin = false;
                console.log('✓ Kullanıcı çıkış yaptı (session yok):', socket.id);
                if (callback) callback({ success: true });
            }

            // Kullanıcı listesini güncelle
            const users = await getUsersByTeam();
            io.emit('users-update', users);
        } catch (err) {
            console.error('Logout hatası:', err);
            if (callback) callback({ success: false });
        }
    });

    // Bağlantı koptu
    socket.on('disconnect', async () => {
        // Disconnect olduğunda socket.io zaten bağlantıyı kesmişti, o yüzden mevcut sayı doğru
        const remainingClients = io.sockets.sockets.size;
        console.log('✓ Kullanıcı ayrıldı:', socket.id, '- Kalan:', remainingClients);

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
║  Admin Şifresi: **** (gizli)           ║
╚════════════════════════════════════════╝
            `);
            console.log('✓ Server ready and listening on', server.address());
            console.log('✓ Admin password loaded from environment variables');

            // Otomatik kullanıcı temizleme cron job'u (her 24 saatte bir)
            const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 saat
            setInterval(async () => {
                console.log('🕐 Otomatik kullanıcı temizliği başlatılıyor...');
                await userCleanup.cleanup();
            }, CLEANUP_INTERVAL);

            // İlk temizliği hemen çalıştır
            console.log('🧹 İlk kullanıcı temizliği başlatılıyor...');
            userCleanup.cleanup();
        });
    } catch (err) {
        console.error('Sunucu başlatılamadı:', err);
        process.exit(1);
    }
}

startServer();

// ========================================
// GRACEFUL SHUTDOWN - Deploy sırasında veri kaybını önle
// ========================================

let isShuttingDown = false;

// SIGTERM: Railway/Heroku deployment sinyali
process.on('SIGTERM', gracefulShutdown);

// SIGINT: Ctrl+C (local development)
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('⏳ Zaten kapatılıyor, lütfen bekleyin...');
        return;
    }

    isShuttingDown = true;
    console.log(`\n🛑 ${signal} sinyali alındı - Güvenli kapatılıyor...`);

    // 1. Yeni HTTP bağlantılarını reddet
    server.close(() => {
        console.log('✓ HTTP server kapatıldı (yeni bağlantılar reddediliyor)');
    });

    // 2. Tüm WebSocket bağlantılarını bilgilendir ve kapat
    console.log(`⏳ ${io.sockets.sockets.size} WebSocket bağlantısı kapatılıyor...`);
    io.sockets.sockets.forEach((socket) => {
        socket.emit('server-shutdown', { message: 'Sunucu güncelleniyor, lütfen sayfayı yenileyin.' });
        socket.disconnect(true);
    });
    console.log('✓ Tüm WebSocket bağlantıları kapatıldı');

    // 3. Aktif countdown'ları durdur
    if (gameState.countdownInterval) {
        clearInterval(gameState.countdownInterval);
        console.log('✓ Oyun countdown\'ı durduruldu');
    }

    // 4. Database pool'u temiz kapat
    try {
        await pool.end();
        console.log('✓ Database connection pool kapatıldı');
    } catch (err) {
        console.error('❌ Database pool kapatma hatası:', err);
    }

    // 5. Temiz çıkış
    console.log('✓ Güvenli kapatma tamamlandı!\n');
    process.exit(0);
}

// Yakalanmamış hata durumunda da graceful shutdown
process.on('uncaughtException', (err) => {
    console.error('❌ Yakalanmamış hata:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Yakalanmamış promise rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});