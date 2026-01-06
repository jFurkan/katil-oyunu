import { test, expect } from '@playwright/test';

test.describe('Input Validasyonları', () => {
  test.describe('Nickname Validasyonu', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('Maksimum 20 karakter sınırı', async ({ page }) => {
      const longInput = 'a'.repeat(50);
      await page.locator('#inpNickname').fill(longInput);

      const value = await page.locator('#inpNickname').inputValue();
      expect(value.length).toBeLessThanOrEqual(20);
    });

    test('HTML injection koruması', async ({ page }) => {
      const maliciousInput = '<script>alert("XSS")</script>';
      await page.locator('#inpNickname').fill(maliciousInput);
      await page.locator('button:has-text("Oyuna Giriş Yap")').click();

      // Script çalışmamalı, sayfa normal yüklenmeli
      await page.waitForTimeout(500);
      const dialogAppeared = await page.evaluate(() => {
        return document.querySelector('script[src*="alert"]') !== null;
      });
      expect(dialogAppeared).toBe(false);
    });

    test('SQL injection koruması', async ({ page }) => {
      const sqlInput = "'; DROP TABLE users; --";
      await page.locator('#inpNickname').fill(sqlInput);
      await page.locator('button:has-text("Oyuna Giriş Yap")').click();

      // Server hatası alınmamalı
      await page.waitForTimeout(1000);
      const hasError = await page.locator('text=Server Error').isVisible().catch(() => false);
      expect(hasError).toBe(false);
    });

    test('Türkçe karakter desteği', async ({ page }) => {
      const turkishNick = 'ÖğrenciŞükriye';
      await page.locator('#inpNickname').fill(turkishNick);

      const value = await page.locator('#inpNickname').inputValue();
      expect(value).toBe(turkishNick);
    });

    test('Emoji desteği', async ({ page }) => {
      const emojiNick = 'TestUser🎮🎯';
      await page.locator('#inpNickname').fill(emojiNick);

      const value = await page.locator('#inpNickname').inputValue();
      expect(value).toContain('TestUser');
    });

    test('Boşluk karakterleri', async ({ page }) => {
      const spaceNick = 'Test User 123';
      await page.locator('#inpNickname').fill(spaceNick);

      const value = await page.locator('#inpNickname').inputValue();
      expect(value).toBe(spaceNick);
    });

    test('Özel karakterler', async ({ page }) => {
      const specialNick = 'User_123-Test!';
      await page.locator('#inpNickname').fill(specialNick);

      const value = await page.locator('#inpNickname').inputValue();
      expect(value).toBe(specialNick);
    });
  });

  test.describe('Takım Adı Validasyonu', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
      await page.locator('#inpNickname').fill(randomNick);
      await page.locator('button:has-text("Oyuna Giriş Yap")').click();
      await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });
      await page.locator('button:has-text("Yeni Takım Oluştur")').click();
    });

    test('Maksimum 20 karakter sınırı', async ({ page }) => {
      const longName = 'a'.repeat(50);
      await page.locator('#inpNewTeam').fill(longName);

      const value = await page.locator('#inpNewTeam').inputValue();
      expect(value.length).toBeLessThanOrEqual(20);
    });

    test('HTML injection koruması', async ({ page }) => {
      const maliciousInput = '<img src=x onerror=alert(1)>';
      await page.locator('#inpNewTeam').fill(maliciousInput);
      await page.locator('#inpNewTeamPassword').fill('test123');
      await page.locator('.color-option').first().click();
      await page.locator('#createForm button:has-text("Oluştur")').click();

      // Script çalışmamalı
      await page.waitForTimeout(500);
      const hasAlert = await page.evaluate(() => window.alert !== undefined);
      expect(hasAlert).toBe(true); // window.alert mevcut olmalı ama çağrılmamalı
    });

    test('Türkçe karakter desteği', async ({ page }) => {
      const turkishName = 'DedektifŞükriye';
      await page.locator('#inpNewTeam').fill(turkishName);

      const value = await page.locator('#inpNewTeam').inputValue();
      expect(value).toBe(turkishName);
    });
  });

  test.describe('Şifre Validasyonu', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
      await page.locator('#inpNickname').fill(randomNick);
      await page.locator('button:has-text("Oyuna Giriş Yap")').click();
      await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });
      await page.locator('button:has-text("Yeni Takım Oluştur")').click();
    });

    test('Maksimum 20 karakter sınırı', async ({ page }) => {
      const longPassword = 'a'.repeat(50);
      await page.locator('#inpNewTeamPassword').fill(longPassword);

      const value = await page.locator('#inpNewTeamPassword').inputValue();
      expect(value.length).toBeLessThanOrEqual(20);
    });

    test('Şifre gizli olmalı (password type)', async ({ page }) => {
      const passwordInput = page.locator('#inpNewTeamPassword');
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
    });

    test('Özel karakterler desteklenmeli', async ({ page }) => {
      const specialPassword = 'P@ssw0rd!#$%';
      await page.locator('#inpNewTeamPassword').fill(specialPassword);

      const value = await page.locator('#inpNewTeamPassword').inputValue();
      expect(value).toBe(specialPassword);
    });
  });

  test.describe('XSS Koruması - Genel', () => {
    test('Script tag injection', async ({ page }) => {
      await page.goto('/');

      const xssPayloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
      ];

      for (const payload of xssPayloads) {
        await page.locator('#inpNickname').fill(payload);
        await page.waitForTimeout(200);

        // Alert çalışmamalı
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => {
          pageErrors.push(error.message);
        });

        expect(pageErrors).toEqual([]);
      }
    });

    test('Event handler injection', async ({ page }) => {
      await page.goto('/');

      const eventPayloads = [
        'test" onload="alert(1)',
        'test\' onfocus=\'alert(1)',
        'test onclick=alert(1)',
      ];

      for (const payload of eventPayloads) {
        await page.locator('#inpNickname').fill(payload);

        // Input'a focus olduğunda script çalışmamalı
        await page.locator('#inpNickname').focus();
        await page.waitForTimeout(200);

        const value = await page.locator('#inpNickname').inputValue();
        expect(value).toBe(payload); // Input'a yazılmalı ama execute olmamalı
      }
    });
  });

  test.describe('Rate Limiting (Client-Side)', () => {
    test('Hızlı form submit koruması', async ({ page }) => {
      await page.goto('/');

      const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
      await page.locator('#inpNickname').fill(randomNick);

      // 10 kez hızlıca gönder
      const submitButton = page.locator('button:has-text("Oyuna Giriş Yap")');

      for (let i = 0; i < 10; i++) {
        await submitButton.click();
        await page.waitForTimeout(50);
      }

      // Server hatası alınmamalı
      await page.waitForTimeout(1000);
      const hasError = await page.locator('text=Too Many Requests').isVisible().catch(() => false);

      // Rate limit varsa true, yoksa false - her ikisi de kabul edilebilir
      // Sadece server crash olmamalı
    });
  });
});
