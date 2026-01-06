# Playwright Test Dokümantasyonu

Bu klasör, Katil Kim oyunu için Playwright E2E testlerini içerir.

## Test Dosyaları

- **nickname.spec.ts** - Kullanıcı nickname giriş testleri
- **lobby.spec.ts** - Takım oluşturma ve katılma testleri
- **admin.spec.ts** - Admin paneli testleri (WIP)
- **validation.spec.ts** - Input validasyon ve güvenlik testleri
- **game-flow.spec.ts** - Socket.IO ve game flow testleri

## Testleri Çalıştırma

### Ön Koşullar

1. Playwright'ı kurun (zaten package.json'da var):
```bash
npm install
```

2. Playwright browser'ları kurun (ilk kez):
```bash
npx playwright install
```

3. Server'ı başlatın:
```bash
npm run dev
```

### Test Komutları

```bash
# Tüm testleri çalıştır (headless mode)
npm test

# Testleri UI mode'da çalıştır (önerilen)
npm run test:ui

# Testleri browser görünür şekilde çalıştır
npm run test:headed

# Debug mode (step-by-step)
npm run test:debug

# Test raporunu görüntüle
npm run test:report

# Test kaydedici (yeni test yazmak için)
npm run test:codegen
```

### Belirli Testleri Çalıştırma

```bash
# Sadece nickname testleri
npx playwright test nickname

# Sadece validation testleri
npx playwright test validation

# Belirli bir test dosyası
npx playwright test tests/lobby.spec.ts

# Belirli bir test case
npx playwright test -g "Geçerli nickname ile giriş"
```

## Konfigürasyon

Test konfigürasyonu `playwright.config.ts` dosyasındadır.

### Önemli Ayarlar

- **baseURL**: Varsayılan `http://localhost:3000`
  - Değiştirmek için: `BASE_URL=http://localhost:8080 npm test`

- **timeout**: Her test için 30 saniye

- **workers**: Socket.IO race condition'larını önlemek için 1

- **retries**: CI'da 2, local'de 0

### Production Testleri

Production URL'de test etmek için:

```bash
BASE_URL=https://katil-oyunu-production-914a.up.railway.app npm test
```

## Test Yazma Rehberi

### Helper Fonksiyonları

`helpers/test-utils.ts` dosyasında yardımcı fonksiyonlar var:

```typescript
import { loginAsUser, createTeam, joinTeam } from './helpers/test-utils';

test('örnek test', async ({ page }) => {
  // Kullanıcı olarak giriş yap
  const nickname = await loginAsUser(page);

  // Takım oluştur
  const { teamName, password } = await createTeam(page);

  // Test kodları...
});
```

### XSS ve SQL Injection Testleri

```typescript
import { XSS_PAYLOADS, SQL_INJECTION_PAYLOADS } from './helpers/test-utils';

test('XSS koruması', async ({ page }) => {
  for (const payload of XSS_PAYLOADS) {
    await page.locator('#input').fill(payload);
    // Assertion...
  }
});
```

## Test Coverage

Şu anki coverage:

- ✅ Nickname giriş (8 test)
- ✅ Lobby navigasyonu (10 test)
- ✅ Takım oluşturma (6 test)
- ✅ Takım katılma (2 test)
- ✅ Input validasyon (15+ test)
- ✅ XSS/SQL injection koruması (5 test)
- ⚠️ Admin paneli (skeleton only)
- ⚠️ Socket.IO events (basic tests)
- ⚠️ Game flow (WIP)

## Bilinen Sorunlar

1. **Admin testleri**: Admin login dinamik form olduğu için testler skip edilmiş
2. **Socket.IO mock**: Socket.IO event'lerini mock'lamak için ek kütüphane gerekebilir
3. **Multi-user scenarios**: Bazı testler iki browser context kullanıyor, daha yavaş çalışabilir

## CI/CD Entegrasyonu

GitHub Actions için örnek workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run dev &
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Debug İpuçları

### Test Fail Olduğunda

1. **Screenshot**: `test-results/` klasöründe otomatik screenshot alınır
2. **Video**: Fail olan testlerin videosu kaydedilir
3. **Trace**: `npx playwright show-trace trace.zip` ile adım adım bakabilirsin

### Network İsteklerini İzleme

```typescript
import { monitorNetworkRequests } from './helpers/test-utils';

test('örnek', async ({ page }) => {
  const requests = monitorNetworkRequests(page);
  // Test...
  console.log(requests); // Tüm network istekleri
});
```

### Console Error'larını Yakalama

```typescript
import { collectConsoleErrors } from './helpers/test-utils';

test('örnek', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  // Test...
  expect(errors).toHaveLength(0); // Console'da error olmamalı
});
```

## Best Practices

1. **Test izolasyonu**: Her test bağımsız olmalı
2. **Rastgele data**: Her test için unique nickname/takım adı kullan
3. **Cleanup**: Test sonrası veri temizliği (şimdilik manual)
4. **Timeout**: Socket.IO için yeterli bekleme süresi ekle
5. **Assertions**: Pozitif ve negatif senaryoları test et

## Katkıda Bulunma

Yeni test eklerken:

1. Anlamlı test isimleri kullan
2. `test.describe` ile gruplayın
3. Helper fonksiyonları kullan
4. Edge case'leri düşün
5. Dokümante et

## Sorular & Sorunlar

Test ile ilgili sorun yaşarsanız:

1. `npm run test:debug` ile debug mode'da çalıştırın
2. `playwright.config.ts`'deki ayarları kontrol edin
3. Server'ın çalıştığından emin olun
4. Browser'ların kurulu olduğunu kontrol edin: `npx playwright install`
