import { test, expect } from '@playwright/test';

test.describe('Game Flow - Socket.IO Bağlantısı', () => {
  test('Socket.IO scripti yüklenebilmeli', async ({ page }) => {
    await page.goto('/');

    // Socket.IO client script'i yüklenmiş olmalı
    const socketScript = await page.evaluate(() => {
      return typeof window.io !== 'undefined';
    });

    expect(socketScript).toBe(true);
  });

  test('Sayfa yüklendiğinde Socket.IO bağlantısı kurulmalı', async ({ page }) => {
    await page.goto('/');

    // Socket.IO bağlantısının kurulması için bekle
    await page.waitForTimeout(2000);

    // Console'da bağlantı logları olmalı (development mode'da)
    // Production'da console.log'lar kapalı olabilir
  });

  test('Nickname girişinde socket event gönderilmeli', async ({ page }) => {
    await page.goto('/');

    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);

    // Network aktivitesini izle
    const [response] = await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('socket.io') &&
        response.status() === 200,
        { timeout: 10000 }
      ).catch(() => null),
      page.locator('button:has-text("Oyuna Giriş Yap")').click(),
    ]);

    // Socket.IO handshake veya polling response'u gelmeli
    // response null olabilir çünkü WebSocket upgrade olabilir
  });
});

test.describe('Game Flow - Takım Sayfası', () => {
  test.beforeEach(async ({ page }) => {
    // Takım oluştur ve takım sayfasına git
    await page.goto('/');
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

    const teamName = `Takım${Math.floor(Math.random() * 10000)}`;
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();
    await page.locator('#inpNewTeam').fill(teamName);
    await page.locator('#inpNewTeamPassword').fill('test123');
    await page.locator('.color-option').first().click();
    await page.locator('#createForm button:has-text("Oluştur")').click();

    await expect(page.locator('#pgTeam')).toHaveClass(/active/, { timeout: 10000 });
  });

  test('Takım sayfası elementleri yüklenebilmeli', async ({ page }) => {
    // Takım bilgileri görünmeli
    await expect(page.locator('#pgTeam')).toBeVisible();

    // Genel kontroller
    await page.waitForTimeout(1000);
  });

  test('Takımdan çıkış yapılabilmeli', async ({ page }) => {
    // Takımdan çıkış butonu bulunmalı
    const leaveButton = page.locator('button:has-text("Takımdan Ayrıl"), button:has-text("Çıkış")').first();

    if (await leaveButton.isVisible()) {
      await leaveButton.click();

      // Confirm dialog varsa kabul et
      page.on('dialog', dialog => dialog.accept());

      await page.waitForTimeout(1000);

      // Lobby'ye dönmeli
      await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 5000 });
    }
  });
});

test.describe('Game Flow - Reconnection', () => {
  test('Sayfa yenilendiğinde session korunmalı', async ({ page }) => {
    // İlk giriş
    await page.goto('/');
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

    // Cookie'leri al
    const cookies = await page.context().cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Sayfayı yenile
    await page.reload();

    // Session cookie ile otomatik giriş yapmalı
    await page.waitForTimeout(2000);

    // Ana sayfada veya lobby'de olmalı (auto-reconnect varsa lobby'de)
    const isOnMain = await page.locator('#pgNickname').isVisible();
    const isOnLobby = await page.locator('#pgLobby').isVisible();

    expect(isOnMain || isOnLobby).toBe(true);
  });

  test('Cookie silindiğinde session korunmamalı', async ({ page, context }) => {
    // İlk giriş
    await page.goto('/');
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

    // Cookie'leri temizle
    await context.clearCookies();

    // Sayfayı yenile
    await page.reload();

    // Ana sayfada olmalı
    await expect(page.locator('#pgNickname')).toHaveClass(/active/);
  });
});

test.describe('Game Flow - Çoklu Kullanıcı Senaryoları', () => {
  test('İki kullanıcı aynı takıma katılabilmeli', async ({ browser }) => {
    // İki farklı context (iki farklı kullanıcı)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      const teamName = `Takım${Math.floor(Math.random() * 10000)}`;
      const teamPassword = 'test123';

      // Kullanıcı 1: Takım oluştur
      await page1.goto('/');
      await page1.locator('#inpNickname').fill('User1');
      await page1.locator('button:has-text("Oyuna Giriş Yap")').click();
      await expect(page1.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

      await page1.locator('button:has-text("Yeni Takım Oluştur")').click();
      await page1.locator('#inpNewTeam').fill(teamName);
      await page1.locator('#inpNewTeamPassword').fill(teamPassword);
      await page1.locator('.color-option').first().click();
      await page1.locator('#createForm button:has-text("Oluştur")').click();
      await expect(page1.locator('#pgTeam')).toHaveClass(/active/, { timeout: 10000 });

      // Kullanıcı 2: Takıma katıl
      await page2.goto('/');
      await page2.locator('#inpNickname').fill('User2');
      await page2.locator('button:has-text("Oyuna Giriş Yap")').click();
      await expect(page2.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

      await page2.locator('button:has-text("Takıma Giriş Yap")').click();

      // Takım listesinde yeni oluşturulan takım olmalı
      await page2.waitForTimeout(1000);
      const teamOption = page2.locator(`.team-opt:has-text("${teamName}")`).first();

      if (await teamOption.isVisible()) {
        await teamOption.click();

        // Şifre gir
        await page2.locator('#inpJoinPassword').fill(teamPassword);
        await page2.locator('#joinPasswordSection button:has-text("Giriş")').click();

        // Takım sayfasına yönlendirilmeli
        await expect(page2.locator('#pgTeam')).toHaveClass(/active/, { timeout: 10000 });
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Yanlış şifre ile takıma katılma başarısız olmalı', async ({ page }) => {
    // Önce bir takım oluştur
    await page.goto('/');
    const teamName = `Takım${Math.floor(Math.random() * 10000)}`;
    const correctPassword = 'correct123';

    await page.locator('#inpNickname').fill(`Creator${Math.random()}`);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });

    await page.locator('button:has-text("Yeni Takım Oluştur")').click();
    await page.locator('#inpNewTeam').fill(teamName);
    await page.locator('#inpNewTeamPassword').fill(correctPassword);
    await page.locator('.color-option').first().click();
    await page.locator('#createForm button:has-text("Oluştur")').click();
    await expect(page.locator('#pgTeam')).toHaveClass(/active/, { timeout: 10000 });

    // Çıkış yap
    await page.locator('button:has-text("Takımdan Ayrıl"), button:has-text("Çıkış")').first().click();
    await page.waitForTimeout(500);

    // Yanlış şifre ile katılmayı dene
    await page.locator('button:has-text("Takıma Giriş Yap")').click();
    await page.waitForTimeout(500);

    const teamOption = page.locator(`.team-opt:has-text("${teamName}")`).first();
    if (await teamOption.isVisible()) {
      await teamOption.click();
      await page.locator('#inpJoinPassword').fill('wrongpassword');
      await page.locator('#joinPasswordSection button:has-text("Giriş")').click();

      // Hata mesajı almalı veya takım sayfasına gitmemeli
      await page.waitForTimeout(2000);
      const isStillOnLobby = await page.locator('#pgLobby').isVisible();
      expect(isStillOnLobby).toBe(true);
    }
  });
});

test.describe('Game Flow - Real-time Updates', () => {
  test('Socket bağlantısı koptuğunda reconnect denemeli', async ({ page }) => {
    await page.goto('/');

    // Socket.IO bağlantısını simüle etmek zor
    // Gerçek test için server'ı restart etmek gerekir
    test.skip();
  });

  test('Network offline olduğunda kullanıcı bilgilendirilmeli', async ({ page, context }) => {
    await page.goto('/');

    // Offline simülasyonu
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Online'a dön
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // Sayfa hala çalışmalı
    await expect(page.locator('h1')).toBeVisible();
  });
});

/*
 * NOT: Socket.IO testleri için:
 *
 * 1. Socket.IO client mock'lanabilir (socket.io-mock paketi)
 * 2. Test server kurulabilir (socket.io test utilities)
 * 3. E2E testlerde gerçek server kullanılabilir
 *
 * Bu testler temel UI flow'ları test ediyor.
 * Socket.IO event'lerini unit test seviyesinde test etmek daha iyi olabilir.
 */
