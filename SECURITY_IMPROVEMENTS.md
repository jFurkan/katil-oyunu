# 🔒 Güvenlik İyileştirme Önerileri

## 1. KRİTİK (Hemen Yapılmalı)

### 1.1 Admin Login Rate Limit
**Sorun:** Admin login'de brute-force koruması yok
```javascript
// server.js - admin-login event'inden önce
const adminLoginAttempts = new Map();

socket.on('admin-login', (password, callback) => {
    const ip = botProtection.getClientIP(socket);
    const attempts = adminLoginAttempts.get(ip) || { count: 0, resetAt: Date.now() };

    // 15 dakikada max 5 deneme
    if (attempts.count >= 5 && Date.now() < attempts.resetAt) {
        callback({ success: false, error: 'Çok fazla deneme! 15 dakika bekleyin.' });
        return;
    }

    if (password === ADMIN_PASSWORD) {
        adminLoginAttempts.delete(ip);
        // ... login success
    } else {
        attempts.count++;
        attempts.resetAt = Date.now() + 15 * 60 * 1000;
        adminLoginAttempts.set(ip, attempts);
        callback({ success: false, error: 'Yanlış şifre!' });
    }
});
```

### 1.2 Redis Session Store (Production)
**Sorun:** MemoryStore production için uygun değil

**Railway'de Redis Ekleme:**
```bash
# Railway dashboard
1. New → Database → Add Redis
2. REDIS_URL otomatik eklenir
```

**server.js değişikliği:**
```javascript
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Redis client oluştur
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.connect().catch(console.error);

const sessionMiddleware = session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    // ... diğer ayarlar
});
```

**package.json:**
```bash
npm install redis connect-redis
```

### 1.3 CORS Policy Sıkılaştırma
**Sorun:** `origin: '*'` production'da tehlikeli

**server.js:**
```javascript
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ||
    (process.env.NODE_ENV === 'production'
        ? 'https://your-domain.up.railway.app'
        : '*');
```

**Railway Environment Variables:**
```
ALLOWED_ORIGIN=https://your-domain.up.railway.app
```

---

## 2. ÖNEMLİ (Yakında Yapılmalı)

### 2.1 HTTPS Enforcement
**Railway otomatik HTTPS sağlıyor ama yine de:**
```javascript
// server.js - production'da HTTP'yi reddet
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}
```

### 2.2 Ekstra Security Headers
```javascript
app.use(helmet({
    contentSecurityPolicy: { /* mevcut */ },
    hsts: { /* mevcut */ },

    // YENİ EKLE:
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
        features: {
            camera: ["'none'"],
            microphone: ["'none'"],
            geolocation: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Socket.IO için gerekebilir
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

### 2.3 Database Connection Pooling
**Mevcut:**
```javascript
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});
```

**İyileştirilmiş:**
```javascript
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,                    // max connection
    idleTimeoutMillis: 30000,   // idle timeout
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

---

## 3. İYİ OLUR (Opsiyonel)

### 3.1 Request Logging
```javascript
const morgan = require('morgan');

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined')); // Production logging
} else {
    app.use(morgan('dev')); // Dev logging
}
```

### 3.2 Environment Variable Validation
```javascript
// server.js başında
const requiredEnvVars = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
});
```

### 3.3 Graceful Shutdown
```javascript
// server.js sonunda
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        pool.end(() => {
            console.log('Database pool closed');
            process.exit(0);
        });
    });
});
```

---

## 4. Railway Deployment Checklist

### Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=(otomatik)
REDIS_URL=(Redis ekledikten sonra otomatik)
SESSION_SECRET=(güçlü random string)
ADMIN_PASSWORD=(güçlü şifre)
ALLOWED_ORIGIN=https://your-app.up.railway.app
```

### Railway Settings
- ✅ Auto-deploy: Enabled (GitHub push'ta otomatik)
- ✅ Health checks: Enabled
- ✅ Custom domain: İsteğe bağlı
- ✅ Railway Postgres: Kullanılıyor
- 🔄 Railway Redis: Eklenecek

---

## 5. Güvenlik Tarama Komutları

```bash
# npm paketlerini tara
npm audit

# Otomatik düzelt (minor)
npm audit fix

# Manual review gerektirenler
npm audit --audit-level=moderate

# Outdated paketler
npm outdated

# Tüm dependency'leri güncelle
npm update
```

---

## 6. Penetrasyon Testi Önerileri

### Test Edilmesi Gerekenler:
1. ✅ SQL Injection (parametreli sorgular kullanılıyor)
2. ✅ XSS (escape-html + CSP kullanılıyor)
3. ⚠️ Admin brute-force (rate limit ekle)
4. ✅ CSRF (sameSite: strict)
5. ✅ Session fixation (regenerate kullanılıyor)
6. ⚠️ Socket.IO message injection (validation var ama test et)
7. ✅ Rate limiting bypass (trust proxy ayarlandı)
8. ⚠️ Database connection exhaustion (pool sınırı var mı?)

### Test Araçları:
```bash
# OWASP ZAP
zap.sh -quickurl https://your-app.up.railway.app

# Nikto web scanner
nikto -h https://your-app.up.railway.app

# SSL/TLS testi
testssl.sh your-app.up.railway.app
```

---

## ✅ Öncelik Sırası

1. **HEMEN:**
   - Admin login rate limit ekle
   - CORS policy sıkılaştır

2. **BU HAFTA:**
   - Redis session store ekle
   - Ekstra security headers

3. **BU AY:**
   - Penetrasyon testi yap
   - npm audit çalıştır ve güncelle

4. **İLERİDE:**
   - Request logging ekle
   - Graceful shutdown implement et
