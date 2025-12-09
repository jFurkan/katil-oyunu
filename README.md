# Katil Kim? 🔍

Gerçek zamanlı çok oyunculu dedektif oyunu.

## Render.com'da Ücretsiz Yayınlama

### Adım 1: GitHub'a Yükle
1. GitHub.com'da yeni repo oluştur (örn: `katil-oyunu`)
2. Bu dosyaları repo'ya yükle

### Adım 2: Render.com'da Deploy Et
1. [render.com](https://render.com) adresine git
2. GitHub ile giriş yap
3. "New" > "Web Service" tıkla
4. GitHub repo'nu seç
5. Ayarlar:
   - **Name:** katil-oyunu (veya istediğin isim)
   - **Region:** Frankfurt (EU Central)
   - **Branch:** main
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

6. Environment Variables (ZORUNLU):
   - `ADMIN_PASSWORD` = güçlü bir şifre belirle (örn: rastgele 12+ karakter)

7. "Create Web Service" tıkla

### Adım 3: Bekle
- Deploy 2-3 dakika sürer
- Tamamlanınca URL alırsın: `https://katil-oyunu.onrender.com`

## Önemli Notlar

⚠️ **Ücretsiz plan sınırlamaları:**
- 15 dakika işlem yoksa uyku moduna geçer
- İlk açılışta 30-50 saniye bekleyebilir
- Ayda 750 saat çalışma limiti

💡 **Uyanık tutmak için:**
- UptimeRobot.com'da ücretsiz hesap aç
- Her 14 dakikada bir site URL'ine ping at

## Yerel Çalıştırma

```bash
npm install
npm start
```

Tarayıcıda: http://localhost:3000

## Admin Şifresi

⚠️ **GÜVENLİK:** Varsayılan şifre yoktur! Render/Railway'de Environment Variable ile ayarlamalısın:

```
ADMIN_PASSWORD = güçlü_şifreni_buraya_yaz
```

**Güçlü şifre önerileri:**
- En az 12 karakter
- Büyük/küçük harf, sayı ve özel karakter karışımı
- Örnek: `X7k#mP9$qL2@v` (bunu kullanma, kendin üret!)
Fix: Module not found patch added
