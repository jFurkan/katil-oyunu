# PostgreSQL Kurulum Rehberi

## 1. PostgreSQL Kurulumu

### Windows için:
1. [PostgreSQL resmi sitesinden](https://www.postgresql.org/download/windows/) indirin
2. Kurulum sırasında bir şifre belirleyin (bunu hatırlayın!)
3. Port: 5432 (varsayılan)

## 2. Veritabanı Oluşturma

### pgAdmin kullanarak:
1. pgAdmin'i açın
2. Servers > PostgreSQL > Databases'e sağ tıklayın
3. "Create > Database" seçin
4. Database adı: `katil_oyunu`
5. Save'e tıklayın

### Komut satırı kullanarak:
```bash
# PostgreSQL'e bağlan
psql -U postgres

# Veritabanı oluştur
CREATE DATABASE katil_oyunu;

# Çıkış
\q
```

## 3. .env Dosyasını Düzenleme

`.env` dosyasını açın ve PostgreSQL bilgilerinizi girin:

```env
ADMIN_PASSWORD=260678

# PostgreSQL Bağlantı Bilgileri
DB_HOST=localhost
DB_PORT=5432
DB_NAME=katil_oyunu
DB_USER=postgres
DB_PASSWORD=BURAYA_POSTGRESQL_ŞİFRENİZİ_YAZIN

PORT=3000
```

## 4. Sunucuyu Başlatma

```bash
npm start
```

Sunucu başladığında otomatik olarak tabloları oluşturacak:
- `teams` - Takım bilgileri
- `clues` - İpuçları
- `credits` - Emeği geçenler

## 5. Tablolar

### teams
- id (VARCHAR)
- name (VARCHAR) - UNIQUE
- password (VARCHAR)
- score (INTEGER)
- created_at (TIMESTAMP)

### clues
- id (SERIAL)
- team_id (VARCHAR) - teams tablosuna referans
- text (TEXT)
- time (VARCHAR)
- created_at (TIMESTAMP)

### credits
- id (VARCHAR)
- name (VARCHAR) - UNIQUE
- content (TEXT)
- created_at (TIMESTAMP)

## Sorun Giderme

### Bağlantı hatası alıyorsanız:
1. PostgreSQL servisinin çalıştığından emin olun
2. `.env` dosyasındaki şifrenin doğru olduğunu kontrol edin
3. Veritabanı adının doğru olduğunu kontrol edin

### Port zaten kullanımda hatası:
1. `.env` dosyasında `PORT` değerini değiştirin (örn: 3001)
2. Veya çalışan diğer uygulamayı kapatın

## Eski JSON Verilerini PostgreSQL'e Aktarma

Eğer `data.json` ve `credits.json` dosyalarınızda veri varsa, bunları manuel olarak PostgreSQL'e aktarabilirsiniz veya bir migration scripti yazabiliriz.
