const { Pool } = require('pg');

// PostgreSQL bağlantı havuzu
// Railway DATABASE_URL kullanıyorsa onu kullan, yoksa manuel config
console.log('🔍 ENV Variables check:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTS' : 'MISSING');
console.log('PGHOST:', process.env.PGHOST || 'MISSING');
console.log('DB_HOST:', process.env.DB_HOST || 'MISSING');

const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : new Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'katil_oyunu',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
    console.log('✓ PostgreSQL veritabanına bağlandı');
});

pool.on('error', (err) => {
    console.error('PostgreSQL bağlantı hatası:', err);
});

// Tabloları oluştur
async function initDatabase() {
    try {
        // Teams tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                score INTEGER DEFAULT 0,
                avatar VARCHAR(255) DEFAULT NULL,
                color VARCHAR(7) DEFAULT '#3b82f6',
                clue_limit INTEGER DEFAULT 10,
                clues_sent INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Clues tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clues (
                id SERIAL PRIMARY KEY,
                team_id VARCHAR(50) REFERENCES teams(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                time VARCHAR(10) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Credits tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS credits (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                content TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Game history tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_history (
                id SERIAL PRIMARY KEY,
                winner_team_id VARCHAR(50),
                winner_team_name VARCHAR(100),
                winner_score INTEGER,
                game_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_teams INTEGER DEFAULT 0,
                total_clues INTEGER DEFAULT 0
            )
        `);

        // Settings tablosu
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // General clues tablosu (Yönetici ipuçları)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS general_clues (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                time VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Badges tablosu (Rozetler)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS badges (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                icon VARCHAR(10) NOT NULL,
                description TEXT,
                color VARCHAR(7) DEFAULT '#FFD700',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Team badges tablosu (Takım-Rozet ilişkisi)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS team_badges (
                id SERIAL PRIMARY KEY,
                team_id VARCHAR(50) REFERENCES teams(id) ON DELETE CASCADE,
                badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(team_id, badge_id)
            )
        `);

        console.log('✓ Veritabanı tabloları hazır');
    } catch (err) {
        console.error('Veritabanı başlatma hatası:', err);
        throw err;
    }
}

module.exports = { pool, initDatabase };
