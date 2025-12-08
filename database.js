const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL bağlantı havuzu
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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

        console.log('✓ Veritabanı tabloları hazır');
    } catch (err) {
        console.error('Veritabanı başlatma hatası:', err);
        throw err;
    }
}

module.exports = { pool, initDatabase };
