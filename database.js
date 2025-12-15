const { Pool } = require('pg');

// Railway DATABASE_URL kullan, yoksa local
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || '123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'katil_oyunu'}`;

// SSL sadece production'da (Railway) kullan
const isProduction = process.env.NODE_ENV === 'production';
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
    connectionString,
    ssl: (isProduction && !isLocalhost) ? { rejectUnauthorized: false } : false
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

        console.log('✓ Database initialized');
    } catch (err) {
        console.error('Database init error:', err);
        throw err;
    }
}

module.exports = { pool, initDatabase };
