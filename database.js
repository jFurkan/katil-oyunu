const { Pool } = require('pg');

// Railway DATABASE_URL kullan, yoksa local
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || '123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'katil_oyunu'}`;

// SSL sadece production'da (Railway) kullan
const isProduction = process.env.NODE_ENV === 'production';
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
    connectionString,
    ssl: (isProduction && !isLocalhost) ? { rejectUnauthorized: false } : false,
    max: 20,  // Railway Hobby plan için optimize edilmiş (80-100 kullanıcı)
    idleTimeoutMillis: 30000,  // 30 saniye idle connection timeout
    connectionTimeoutMillis: 5000  // 5 saniye bağlantı timeout
});

// GÜVENLİK: Pool error handler - Yakalanmamış bağlantı hatalarını logla
pool.on('error', (err, client) => {
    console.error('❌ Unexpected database pool error:', err.message);
    console.error('   Client details:', {
        host: client?.host || 'unknown',
        database: client?.database || 'unknown',
        port: client?.port || 'unknown'
    });
    // Pool kendi kendini recover eder, process.exit YAPMA
});

async function initDatabase() {
    try {
        // Teams tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                score INTEGER DEFAULT 0,
                avatar TEXT DEFAULT '🕵️',
                color TEXT DEFAULT '#3b82f6',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Clues tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clues (
                id SERIAL PRIMARY KEY,
                team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                time TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // General clues tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS general_clues (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Badges tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS badges (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT DEFAULT '#fbbf24',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Team badges junction tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS team_badges (
                team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
                badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
                PRIMARY KEY (team_id, badge_id)
            )
        `);

        // Credits tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS credits (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Users tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nickname TEXT NOT NULL UNIQUE,
                team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
                is_captain BOOLEAN DEFAULT FALSE,
                socket_id TEXT,
                online BOOLEAN DEFAULT TRUE,
                ip_address VARCHAR(45),
                last_activity TIMESTAMP DEFAULT NOW(),
                profile_photo_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Migration: Eksik kolonları ekle (mevcut tablolar için)
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)
        `);

        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW()
        `);

        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS profile_photo_url TEXT
        `);

        // Teams tablosuna captain_nickname ekle (eğer yoksa)
        await pool.query(`
            ALTER TABLE teams
            ADD COLUMN IF NOT EXISTS captain_nickname TEXT
        `);

        // Team messages tablosu (takımlar arası chat)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS team_messages (
                id SERIAL PRIMARY KEY,
                team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                nickname TEXT NOT NULL,
                team_name TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Team messages index (pagination için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_team_messages_created_at
            ON team_messages(created_at DESC)
        `);

        // Migration: Özel mesajlar için target_team_id ekle
        await pool.query(`
            ALTER TABLE team_messages
            ADD COLUMN IF NOT EXISTS target_team_id TEXT
        `);

        await pool.query(`
            ALTER TABLE team_messages
            ADD COLUMN IF NOT EXISTS target_team_name TEXT
        `);

        // Migration: target_team_id foreign key constraint'ini kaldır (admin mesajları için)
        await pool.query(`
            ALTER TABLE team_messages
            DROP CONSTRAINT IF EXISTS team_messages_target_team_id_fkey
        `);

        // Migration: Takım rengi için team_color ekle
        await pool.query(`
            ALTER TABLE team_messages
            ADD COLUMN IF NOT EXISTS team_color TEXT DEFAULT '#3b82f6'
        `);

        // Migration: Mevcut mesajlara takım renklerini ekle
        await pool.query(`
            UPDATE team_messages tm
            SET team_color = COALESCE(
                (SELECT color FROM teams WHERE id = tm.team_id),
                '#3b82f6'
            )
            WHERE tm.team_color IS NULL OR tm.team_color = '#3b82f6'
        `);

        // Migration: Admin mesajları için team_id ve user_id NULL olabilir yap
        // Foreign key constraint'leri kaldır ve yeniden ekle (NULL destekleyecek şekilde)
        await pool.query(`
            ALTER TABLE team_messages
            DROP CONSTRAINT IF EXISTS team_messages_team_id_fkey
        `);

        await pool.query(`
            ALTER TABLE team_messages
            DROP CONSTRAINT IF EXISTS team_messages_user_id_fkey
        `);

        // team_id NULL olabilir, ama NULL değilse teams tablosunda olmalı
        await pool.query(`
            ALTER TABLE team_messages
            ADD CONSTRAINT team_messages_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
        `);

        // user_id NULL olabilir, ama NULL değilse users tablosunda olmalı
        await pool.query(`
            ALTER TABLE team_messages
            ADD CONSTRAINT team_messages_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        `);

        // IP Activity tracking tablosu (Bot farm koruması)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ip_activity (
                id SERIAL PRIMARY KEY,
                ip_address TEXT NOT NULL,
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // IP activity index (hızlı sorgu için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ip_activity_lookup
            ON ip_activity(ip_address, action, created_at DESC)
        `);

        // GÜVENLİK: Nickname case-insensitive unique index (John ve john aynı kabul edilsin)
        await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname_lower
            ON users (LOWER(nickname))
        `);

        // Characters tablosu (Karakter yönetimi)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                photo_url TEXT,
                description TEXT,
                age INTEGER,
                occupation TEXT,
                additional_info TEXT,
                visible_to_teams BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Migration: visible_to_teams kolonu ekle (mevcut tablolar için)
        await pool.query(`
            ALTER TABLE characters
            ADD COLUMN IF NOT EXISTS visible_to_teams BOOLEAN DEFAULT FALSE
        `);

        // Murder Board Items tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS murder_board_items (
                id TEXT PRIMARY KEY,
                team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
                character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
                character_name TEXT NOT NULL,
                photo_url TEXT,
                note TEXT,
                x INTEGER DEFAULT 0,
                y INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Murder Board Connections tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS murder_board_connections (
                id TEXT PRIMARY KEY,
                team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
                from_item_id TEXT REFERENCES murder_board_items(id) ON DELETE CASCADE,
                to_item_id TEXT REFERENCES murder_board_items(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Game Sessions tablosu (Oyun oturumları)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id TEXT PRIMARY KEY,
                started_at TIMESTAMP DEFAULT NOW(),
                ended_at TIMESTAMP,
                winner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
                total_teams INTEGER DEFAULT 0,
                total_players INTEGER DEFAULT 0,
                total_clues INTEGER DEFAULT 0,
                total_messages INTEGER DEFAULT 0,
                total_score_changes INTEGER DEFAULT 0,
                duration_minutes INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // total_score_changes sütunu yoksa ekle (migration)
        await pool.query(`
            ALTER TABLE game_sessions
            ADD COLUMN IF NOT EXISTS total_score_changes INTEGER DEFAULT 0
        `);

        // Game Events tablosu (Timeline için olaylar)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_events (
                id SERIAL PRIMARY KEY,
                session_id TEXT REFERENCES game_sessions(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
                team_name TEXT,
                user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                user_nickname TEXT,
                description TEXT NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Game events index (session ve zaman bazlı sorgular için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_game_events_session_time
            ON game_events(session_id, created_at DESC)
        `);

        // Phases tablosu (Her faz için kayıt)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS phases (
                id TEXT PRIMARY KEY,
                session_id TEXT REFERENCES game_sessions(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT NOW(),
                ended_at TIMESTAMP,
                duration_seconds INTEGER,
                duration_minutes INTEGER,
                total_clues INTEGER DEFAULT 0,
                total_messages INTEGER DEFAULT 0,
                total_score_changes INTEGER DEFAULT 0,
                leading_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
                leading_team_name TEXT,
                leading_team_score INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Phases index (session bazlı sorgular için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_phases_session_time
            ON phases(session_id, started_at DESC)
        `);

        // PERFORMANCE INDEXES: Add frequently queried columns

        // Clues index (team_id için hızlı JOIN)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_clues_team_id
            ON clues(team_id)
        `);

        // Users indexes (team_id ve socket_id sık sorgulanıyor)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_team_id
            ON users(team_id)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_socket_id
            ON users(socket_id)
        `);

        // Team messages index (team_id ile sık sorgulanıyor)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_team_messages_team_id
            ON team_messages(team_id)
        `);

        // Team messages target index (hedef takım sorguları için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_team_messages_target
            ON team_messages(target_team_id)
        `);

        // Murder board items index (team_id ile sık sorgulanıyor)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_murder_board_items_team
            ON murder_board_items(team_id)
        `);

        // Murder board connections indexes (JOIN sorguları için)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_murder_board_conn_team
            ON murder_board_connections(team_id)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_murder_board_conn_from
            ON murder_board_connections(from_item_id)
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_murder_board_conn_to
            ON murder_board_connections(to_item_id)
        `);

        // IP activity cleanup için timestamp index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ip_activity_created_at
            ON ip_activity(created_at)
        `);

        console.log('✓ Database initialized with performance indexes');
    } catch (err) {
        console.error('Database init error:', err);
        throw err;
    }
}

module.exports = { pool, initDatabase };
