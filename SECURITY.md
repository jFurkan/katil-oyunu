# Güvenlik Raporu - Katil Kim? Oyunu

## 🛡️ Uygulanan Güvenlik Katmanları

### 1. **XSS (Cross-Site Scripting) Koruması**
- ✅ `htmlEscape()` fonksiyonu ile tüm kullanıcı girdileri escape edilir
- ✅ Takım adları, nicknames, ipuçları, bildirimler sanitize edilir
- ✅ CSP (Content Security Policy) header'ları aktif

### 2. **SQL Injection Koruması**
- ✅ Tüm veritabanı sorguları parameterized queries kullanır
- ✅ PostgreSQL $1, $2, $3 parametreleri
- ✅ String concatenation yok

### 3. **DDoS ve Rate Limiting**
- ✅ Express rate limiter (IP bazlı)
  - Genel: 100 request/dakika
  - Auth: 10 deneme/15 dakika
- ✅ WebSocket bağlantı limiti (default: 1000)
- ✅ Body size limitleri (100kb)
- ✅ **Socket.IO Event Rate Limiting (Spam Koruması)**
  - register-user: 5 deneme/dakika
  - create-team: 3 takım/dakika
  - add-clue: 10 ipucu/dakika
  - send-general-clue: 20/dakika (admin)
  - send-announcement: 10/dakika (admin)
  - Otomatik cleanup (her dakika)
  - Socket disconnect'te otomatik temizlik
- ✅ **Bot Farm Koruması (IP bazlı)**
  - register-user: Max 3 kullanıcı/24 saat (aynı IP)
  - create-team: Max 2 takım/24 saat (aynı IP)
  - PostgreSQL tablosu ile tracking (ip_activity)
  - Otomatik cleanup (7 gün sonra eski kayıtlar silinir)
  - X-Forwarded-For header desteği (proxy/CDN arkasında)

### 4. **HTTP Güvenlik Header'ları (Helmet)**
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ CSP (Content Security Policy)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy

### 5. **WebSocket Güvenliği**
- ✅ Origin kontrolü (production)
- ✅ Bağlantı sayısı limiti
- ✅ CORS kısıtlamaları

### 6. **Input Validation**
- ✅ Tüm form alanlarında maxlength
- ✅ Server-side validation
- ✅ Type checking

### 7. **Session & Cookie Güvenliği** ✨ YENİ
- ✅ **HTTP-only cookies**: JavaScript'ten erişilemez (XSS koruması)
- ✅ **Secure flag**: Sadece HTTPS üzerinden iletilir (production)
- ✅ **SameSite=strict**: CSRF saldırılarını engeller
- ✅ **Session expiration**: 7 günlük otomatik süre sonu
- ✅ **Session-based authentication**: localStorage yerine HTTP-only session
- ✅ **Admin session persistence**: Sayfa yenilendiğinde admin oturumu devam eder
- ✅ **Secure logout**: Session tamamen temizlenir
- ✅ **Session Fixation koruması**: Login/register'da session.regenerate() ✨ YENİ
- ✅ **Admin action confirmations**: Kritik işlemler için onay mekanizması ✨ YENİ

## 🔒 Environment Variables

Production ortamında mutlaka ayarlanmalı:

```bash
NODE_ENV=production
ALLOWED_ORIGIN=https://your-domain.com
ADMIN_PASSWORD=secure_random_password
SESSION_SECRET=your_random_64_character_secret_key  # ✨ YENİ - Cookie şifreleme
MAX_CONNECTIONS=500
DATABASE_URL=postgresql://...
```

⚠️ **ÖNEMLİ:** `SESSION_SECRET` mutlaka production'da değiştirilmeli ve 64+ karakter rastgele olmalı!

## 📊 Güvenlik Kontrol Listesi

- [x] XSS koruması
- [x] SQL injection koruması
- [x] Rate limiting
- [x] Body size limits
- [x] CORS yapılandırması
- [x] Helmet security headers
- [x] WebSocket origin kontrolü
- [x] Input validation
- [x] HTTPS/HSTS
- [x] Parameterized queries
- [x] HTTP-only session cookies ✨ YENİ
- [x] Secure & SameSite cookie flags ✨ YENİ
- [x] Session-based authentication ✨ YENİ
- [x] Admin session persistence ✨ YENİ
- [x] Session Fixation koruması ✨ YENİ
- [x] Admin action confirmations ✨ YENİ

## 🚨 Önerilen İyileştirmeler

### Kısa Vadede
1. **Cloudflare/CDN**: Layer 3/4/7 DDoS koruması
2. **WAF (Web Application Firewall)**: Cloudflare ücretsiz plan
3. **Dependency Scanning**: GitHub Dependabot aktif et
4. **Monitoring**: Sentry/LogDNA ile hata izleme

### Orta Vadede
1. **CSRF Token**: State-changing POST/PUT/DELETE için
2. **2FA**: Admin paneli için iki faktörlü doğrulama
3. **Audit Logs**: Admin işlemlerini logla
4. **Backup**: Otomatik veritabanı yedekleme

### Uzun Vadede
1. **Penetration Testing**: Yıllık güvenlik testi
2. **OWASP ZAP**: Otomatik güvenlik taramaları
3. **Bug Bounty**: Güvenlik açığı ödül programı

## 🔄 Güvenlik Güncellemeleri

### Haftalık
- `npm audit` çalıştır
- Dependency güncellemelerini kontrol et

### Aylık
- Güvenlik loglarını incele
- Rate limit metriklerini analiz et
- Sistem kaynaklarını (CPU, memory, connections) izle

### Yıllık
- Tüm dependencies'i güncelle
- Penetration test yaptır
- Güvenlik politikalarını gözden geçir

## 📞 Güvenlik Bildirimi

Güvenlik açığı tespit ederseniz lütfen:
- **GitHub Issues**: https://github.com/jFurkan/katil-oyunu/issues
- **Sorumlu bildirim**: Önce private olarak bildirin

## 📚 Kaynaklar

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [Socket.IO Security](https://socket.io/docs/v4/security/)

---

## 🎯 Son Güvenlik İyileştirmeleri (2025-12-10)

### Düzeltilen Güvenlik Sorunları

#### ❌ SORUN 1: localStorage'da userId Saklanıyordu
**Risk:** XSS saldırısı ile userId çalınabilir, kullanıcı kimliğine bürünülebilirdi.

**✅ Çözüm:**
- userId artık sadece HTTP-only session cookie'de saklanıyor
- Client tarafında hiç saklanmıyor
- XSS ile erişilemez

#### ❌ SORUN 2: Admin Durumu Kalıcı Değildi
**Risk:** Sayfa yenilendiğinde admin tekrar şifre girmek zorundaydı.

**✅ Çözüm:**
- Admin durumu HTTP-only session'a kaydediliyor
- Sayfa yenilendiğinde oturum devam ediyor
- Session süresi dolana kadar (7 gün) geçerli

#### ❌ SORUN 3: SESSION_SECRET Her Restart'ta Değişiyordu
**Risk:** Sunucu yeniden başlatıldığında tüm oturumlar geçersiz oluyordu.

**✅ Çözüm:**
- SESSION_SECRET artık .env dosyasında sabit
- .env.example dosyasına örnek eklendi
- Production'da mutlaka değiştirilmesi gerektiği belirtildi

#### ❌ SORUN 4: Session Fixation Açığı (KRİTİK)
**Risk:** Saldırgan önceden çaldığı session cookie ile login/admin olabilirdi.

**✅ Çözüm:**
- `register-user` işleminde `session.regenerate()` eklendi
- `admin-login` işleminde `session.regenerate()` eklendi
- Her başarılı authentication'da yeni session ID üretiliyor
- Eski session ID'ler geçersiz hale geliyor

#### ⚠️ SORUN 5: Admin İşlemlerinde Onay Eksikliği
**Risk:** Admin paneli açık bırakılırsa kaza sonucu işlem yapılabilirdi.

**✅ Çözüm:**
- Takım silme: Confirmation var ✓
- Kullanıcı silme: Confirmation var ✓
- Büyük puan değişiklikleri (±50+): Confirmation eklendi ✓
- Küçük puan değişiklikleri (±5, ±10): Direkt yapılıyor (UX için)

---

**Son Güncelleme:** 2025-12-10
**Versiyon:** 2.2.0 (Session Fixation & Admin Confirmation)
