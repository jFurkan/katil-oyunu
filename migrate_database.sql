-- Migration Script: Tüm yeni özellikleri ekle
-- Bu dosyayı psql ile çalıştır: psql -U postgres -d katil_oyunu -f migrate_database.sql

-- Teams tablosuna yeni sütunlar ekle
ALTER TABLE teams ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) DEFAULT NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3b82f6';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS clue_limit INTEGER DEFAULT 10;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS clues_sent INTEGER DEFAULT 0;

-- Clues tablosuna status sütunu ekle
ALTER TABLE clues ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Game history tablosu oluştur
CREATE TABLE IF NOT EXISTS game_history (
    id SERIAL PRIMARY KEY,
    winner_team_id VARCHAR(50),
    winner_team_name VARCHAR(100),
    winner_score INTEGER,
    game_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_teams INTEGER DEFAULT 0,
    total_clues INTEGER DEFAULT 0
);

-- Settings tablosu oluştur
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Başarı mesajı
SELECT 'Migration tamamlandı!' as message;
