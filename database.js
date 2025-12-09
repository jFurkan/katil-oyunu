const { Pool } = require('pg');

// Railway DATABASE_URL kullan, yoksa local
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || '123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'katil_oyunu'}`,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // Teams tablosuna captain_nickname ekle (eğer yoksa)
        await pool.query(`
            ALTER TABLE teams
            ADD COLUMN IF NOT EXISTS captain_nickname TEXT
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

        console.log('✓ Database initialized');
    } catch (err) {
        console.error('Database init error:', err);
        throw err;
    }
}

module.exports = { pool, initDatabase };
