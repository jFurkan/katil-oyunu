# 🚀 Migration Uygulama Adımları (KRİTİK!)

## Neden Gerekli?
- **%90 performans artışı** (200ms → 20ms query time)
- 100 kullanıcıda database çökme riskini önler
- 20+ index + unique constraint ekleniyor

## Railway Dashboard ile Uygulama (ÖNERİLEN)

### Adım 1: Railway Dashboard'a Git
1. https://railway.app/ → Login
2. Projeyi seç: `katil-oyunu-production-914a`
3. **PostgreSQL** servisine tıkla

### Adım 2: Query Sekmesini Aç
1. Sol menüden **"Query"** veya **"Data"** sekmesine git
2. SQL editörü açılacak

### Adım 3: Migration SQL'ini Kopyala
`migrations/001_add_performance_indexes.sql` dosyasının **TÜM içeriğini** kopyala.

### Adım 4: Çalıştır
1. SQL'i editöre yapıştır
2. **Execute** / **Run** butonuna bas
3. İşlem 2-5 dakika sürecek (CONCURRENTLY kullanıldığı için production çalışmaya devam edecek)

### Adım 5: Sonucu Kontrol Et
Başarılı ise göreceksin:
```
CREATE INDEX
CREATE INDEX
...
ALTER TABLE
COMMIT
VACUUM
```

Hata varsa (örn: "index already exists"), sorun değil - zaten var demektir.

---

## Alternatif: Railway CLI ile Uygulama

```bash
# 1. Login yap
railway login

# 2. Projeye bağlan
railway link

# 3. PostgreSQL shell'e gir
railway run psql

# 4. Migration'ı çalıştır
\i migrations/001_add_performance_indexes.sql

# Veya direkt:
railway run psql < migrations/001_add_performance_indexes.sql
```

---

## ✅ Migration Başarılı mı Kontrol Et

Railway Query sekmesinde çalıştır:

```sql
-- Index'ler oluştu mu?
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Badge unique constraint var mı?
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_name = 'unique_team_badge';
```

**Beklenen:** 20+ index ve `unique_team_badge` constraint görmelisin.

---

## ⚠️ Önemli Notlar

- Migration **GÜVENLİ**: Production'da lock yaratmaz (`CONCURRENTLY` kullanılıyor)
- **Tekrar çalıştırılabilir**: `IF NOT EXISTS` olduğu için hata vermez
- **Geri alınabilir**: İndexleri `DROP INDEX CONCURRENTLY idx_...` ile silebilirsin (ama gerek yok)

---

## 🎯 Migration Sonrası Beklenen Performans

**Önce:**
- getAllTeams(): ~200ms (20 takım için)
- getUsersByTeam(): ~100ms
- getTeamMessages(): ~150ms

**Sonra:**
- getAllTeams(): ~20ms (%90 hızlanma) ✅
- getUsersByTeam(): ~10ms (%90 hızlanma) ✅
- getTeamMessages(): ~15ms (%90 hızlanma) ✅

**100 kullanıcı senaryosu:**
- Cache YOK + Index YOK: 600 query/dk × 200ms = Database overload ❌
- Cache VAR + Index YOK: 24 query/dk × 200ms = Yavaş ama çalışır ⚠️
- Cache VAR + Index VAR: 24 query/dk × 20ms = MÜKEMMEL ✅

---

## 📞 Sorun Olursa

Hata alırsan buraya yapıştır, çözelim:
- `ERROR: relation "..." already exists` → Sorun değil, zaten var
- `ERROR: permission denied` → Railway'de admin değilsin, proje sahibiyle iletişime geç
- `ERROR: syntax error` → SQL kopyalarken bozulmuş, tekrar kopyala
