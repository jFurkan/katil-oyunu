# Race Condition Test Senaryoları

100 kullanıcılı multiplayer oyun için kritik eşzamanlılık testleri.

## 🔴 KRİTİK SENARYO 1: Aynı Anda Takım Oluşturma

**Senaryo:** 2 kullanıcı aynı takım adıyla aynı anda takım oluşturmaya çalışır.

**Test Adımları:**
1. İki farklı browser/tab aç
2. Her ikisinde de farklı nickname ile giriş yap
3. Her ikisinde de "Yeni Takım Oluştur" formunu aç
4. Takım adı: "TestTeam123"
5. Şifre gir
6. **TAM AYNI ANDA** "Oluştur" butonuna bas (3-2-1-GO!)

**Beklenen Sonuç:**
- ✅ Bir tanesi başarılı, diğeri "Bu takım adı zaten kullanılıyor" hatası almalı
- ✅ Database'de sadece 1 takım oluşmalı
- ❌ Her iki kullanıcı da başarılı olamaz (data corruption!)

**Mevcut Koruma:**
- ✅ `teams.name` unique constraint var
- ✅ Transaction kullanılıyor (BEGIN/COMMIT)
- ⚠️ Race condition window'u küçük ama var

---

## 🔴 KRİTİK SENARYO 2: Aynı Nickname ile Kayıt

**Senaryo:** 2 kullanıcı aynı nickname ile aynı anda kayıt olmaya çalışır.

**Test Adımları:**
1. İki browser/tab aç
2. Ana sayfada nickname input'a: "TestUser999"
3. **TAM AYNI ANDA** "Oyuna Giriş Yap" butonuna bas

**Beklenen Sonuç:**
- ✅ Bir tanesi başarılı, diğeri hata almalı
- ✅ Database'de sadece 1 kullanıcı oluşmalı
- ❌ Duplicate nickname olmamalı

**Mevcut Koruma:**
```javascript
// server.js:971-974
const userCheckResult = await client.query(
    'SELECT id, online, socket_id FROM users WHERE LOWER(nickname) = LOWER($1) FOR UPDATE',
    [trimmedNick]
);
```
- ✅ `FOR UPDATE` lock kullanılıyor (GÜÇLÜ koruma)
- ✅ Transaction içinde
- ✅ Case-insensitive kontrol

---

## 🟡 ORTA SENARYO 3: Aynı Anda Takıma Katılma

**Senaryo:** 5 kullanıcı aynı takıma aynı anda katılmaya çalışır (limit: 4 kişi).

**Test Adımları:**
1. 5 browser/tab aç, 5 farklı kullanıcı olarak giriş yap
2. Hepsi "Takıma Giriş Yap" → Aynı takımı seç
3. **TAM AYNI ANDA** şifre gir ve "Giriş" bas

**Beklenen Sonuç:**
- ✅ İlk 4'ü başarılı, 5'inci "Takım dolu" hatası almalı
- ✅ Takımda tam 4 kişi olmalı
- ❌ 5 kişi kabul edilmemeli

**Mevcut Durum:**
```javascript
// server.js:1421-1427 - MAX_MEMBERS kontrolü yok!
```
- ❌ Takım member limiti kontrolü YOK
- ⚠️ Sınırsız kullanıcı katılabilir (BUG!)

**Düzeltme Gerekli:**
```javascript
// Takıma katılmadan önce ekle:
const memberCount = await client.query(
    'SELECT COUNT(*) FROM users WHERE team_id = $1',
    [teamId]
);
if (parseInt(memberCount.rows[0].count) >= 4) {
    await client.query('ROLLBACK');
    callback({ success: false, error: 'Takım dolu!' });
    return;
}
```

---

## 🟡 ORTA SENARYO 4: Aynı Badge'i Kazanma

**Senaryo:** 2 admin aynı badge'i aynı takıma aynı anda vermeye çalışır.

**Test Adımları:**
1. İki admin paneli aç
2. Aynı takım için aynı rozeti seç
3. **TAM AYNI ANDA** "Rozet Ver" butonuna bas

**Beklenen Sonuç:**
- ✅ Bir tanesi başarılı, diğeri "Bu rozet zaten verilmiş" hatası almalı
- ✅ `team_badges` tablosunda sadece 1 kayıt olmalı
- ❌ Duplicate badge kaydı olmamalı

**Mevcut Koruma:**
```javascript
// server.js:3198 - Unique constraint kontrolü var mı?
```
- ⚠️ `team_badges(team_id, badge_id)` unique constraint gerekli
- ⚠️ Transaction yok, race condition riski var

---

## 🟢 DÜŞÜK SENARYO 5: Aynı Anda Puan Güncelleme

**Senaryo:** 2 admin aynı takımın puanını aynı anda değiştirmeye çalışır.

**Test Adımları:**
1. İki admin paneli aç
2. Aynı takım için "+10" ve "+5" butonlarına **aynı anda** bas

**Beklenen Sonuç:**
- ✅ Her iki güncelleme de uygulanmalı (10 + 5 = 15 puan artmalı)
- ❌ Lost update olmamalı

**Mevcut Koruma:**
```javascript
// server.js:1588 - UPDATE teams SET score = ...
```
- ⚠️ Transaction yok
- ⚠️ Optimistic locking yok
- 🔧 `UPDATE teams SET score = score + $1` kullanılmalı (atomic)

---

## 🧪 TEST SONUÇLARI (Manuel)

| Senaryo | Tarih | Sonuç | Not |
|---------|-------|-------|-----|
| 1. Aynı takım adı | - | ❓ Henüz test edilmedi | |
| 2. Aynı nickname | - | ❓ Henüz test edilmedi | FOR UPDATE var, güvende olmalı |
| 3. Takım limiti | - | ❌ SORUN VAR | Limit kontrolü yok! |
| 4. Duplicate badge | - | ❓ Henüz test edilmedi | Unique constraint gerekli |
| 5. Puan güncellemesi | - | ❓ Henüz test edilmedi | Atomic UPDATE gerekli |

---

## 📋 HEMEN YAPILABİLECEKLER

### 1. Takım Member Limiti Ekle
```javascript
// server.js join-team event'inde (satır ~1421)
const memberCount = await client.query(
    'SELECT COUNT(*) FROM users WHERE team_id = $1',
    [teamId]
);
const MAX_MEMBERS = 4; // veya config'den al
if (parseInt(memberCount.rows[0].count) >= MAX_MEMBERS) {
    await client.query('ROLLBACK');
    callback({ success: false, error: 'Takım dolu! (Max 4 kişi)' });
    return;
}
```

### 2. Badge Unique Constraint
```sql
ALTER TABLE team_badges
ADD CONSTRAINT unique_team_badge
UNIQUE (team_id, badge_id);
```

### 3. Atomic Score Update
```javascript
// Değiştir: UPDATE teams SET score = $1
// Yeni: UPDATE teams SET score = score + $1
await pool.query(
    'UPDATE teams SET score = score + $1 WHERE id = $2 RETURNING score',
    [points, teamId]
);
```

---

## 🎯 ÖNCELİK SIRASI

1. **Takım member limiti** - KRİTİK (şu an sınırsız!)
2. **Badge unique constraint** - ORTA
3. **Atomic score update** - DÜŞÜK (küçük bug riski)

Manuel testleri yapmak için yukarıdaki adımları takip edin.
