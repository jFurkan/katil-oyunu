-- Kullanıcı tablolarına zaman damgası ekle (otomatik temizlik için)

-- users tablosuna created_at ekle (eğer yoksa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Mevcut kullanıcılara şimdiki zamanı ata (tek seferlik)
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;

-- Kullanıcı son aktivite zamanını takip et
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();
-- Mevcut kullanıcılar için last_activity = created_at (kayıt tarihi)
-- NOT: NOW() kullanmıyoruz çünkü eski kullanıcılar aktif görünürdü
UPDATE users SET last_activity = created_at WHERE last_activity IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);

-- Otomatik güncelleme trigger'ı (last_activity)
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_activity
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_last_activity();
