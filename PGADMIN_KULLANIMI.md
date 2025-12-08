# pgAdmin 4 ile Veritabanını Görüntüleme

## 1. Sunucu Bağlantısı Kurma

1. **pgAdmin 4'ü aç**

2. **Sol panelde "Servers" üzerine sağ tıkla** → **"Register" → "Server"**

3. **General sekmesi:**
   - Name: `Katil Oyunu DB` (istediğin ismi ver)

4. **Connection sekmesi:**
   - Host name/address: `localhost`
   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: `postgres`
   - Password: `123`
   - ✓ Save password (işaretle)

5. **Save'e tıkla**

## 2. Veritabanına Erişim

Sol panelde şu sırayla aç:
```
Servers
  └─ Katil Oyunu DB
      └─ Databases (18)
          └─ katil_oyunu
              └─ Schemas
                  └─ public
                      └─ Tables (3)
```

## 3. Tabloları Görüntüleme

### Tables klasöründe 3 tablo göreceksin:

- **teams** - Takımlar
- **clues** - İpuçları
- **credits** - Emeği geçenler

### Tablodaki verileri görmek için:

1. **Tabloya sağ tıkla** (örn: teams)
2. **"View/Edit Data" → "All Rows"** seçeneğini seç

Sağ tarafta tablodaki TÜM veriler görünür!

## 4. Manuel SQL Sorgusu Çalıştırma

Veritabanı adına sağ tıkla → "Query Tool" → SQL sorgularını yaz:

```sql
-- Tüm takımları gör
SELECT * FROM teams;

-- Takım sayısı
SELECT COUNT(*) as takım_sayısı FROM teams;

-- En yüksek puan
SELECT name, score FROM teams ORDER BY score DESC LIMIT 1;

-- Belirli bir takımın ipuçları
SELECT c.text, c.time
FROM clues c
JOIN teams t ON c.team_id = t.id
WHERE t.name = 'Takım Adı';

-- Toplam ipucu sayısı
SELECT COUNT(*) as toplam_ipucu FROM clues;
```

## 5. Canlı Veri Takibi

Oyun sırasında verileri görmek için:

1. Tabloya git (View/Edit Data → All Rows)
2. Üstteki araç çubuğunda **"Refresh" butonuna** (↻) tıkla
3. Her tıkladığında güncel veri gelir

## 6. Hızlı Bilgiler

**Tablo yapısını görmek için:**
- Tablo adına sağ tıkla → "Properties" → "Columns"

**Kaç satır var görmek için:**
- Tablo adına sağ tıkla → "View/Edit Data" → "First 100 Rows"
- Alt kısımda "Rows: X" yazar

**Veri silmek için:**
- Query Tool'da: `DELETE FROM teams WHERE id = 'team_123';`
- Veya satıra sağ tıkla → "Delete/Drop"
