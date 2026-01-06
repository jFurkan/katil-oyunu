import { test, expect } from '@playwright/test';

test.describe('Lobby - Takım Oluşturma ve Katılma', () => {
  test.beforeEach(async ({ page }) => {
    // Her testten önce giriş yap
    await page.goto('/');
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();

    // Lobby sayfasına geçilmesini bekle
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });
  });

  test('Lobby menüsü görünmeli', async ({ page }) => {
    await expect(page.locator('button:has-text("Yeni Takım Oluştur")')).toBeVisible();
    await expect(page.locator('button:has-text("Takıma Giriş Yap")')).toBeVisible();
    await expect(page.locator('button:has-text("Skor Tablosu")')).toBeVisible();
    await expect(page.locator('button:has-text("Bildirimler")')).toBeVisible();
  });

  test('Çıkış butonu çalışmalı', async ({ page }) => {
    await page.locator('button:has-text("Çıkış Yap")').click();

    // Ana sayfaya dönmeli
    await expect(page.locator('#pgNickname')).toHaveClass(/active/);
  });

  test('Yeni takım oluşturma formu açılmalı', async ({ page }) => {
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();

    const createForm = page.locator('#createForm');
    await expect(createForm).toBeVisible();
    await expect(createForm.locator('h3')).toContainText('Yeni Takım');

    // Form elemanları görünmeli
    await expect(page.locator('#inpNewTeam')).toBeVisible();
    await expect(page.locator('#inpNewTeamPassword')).toBeVisible();
    await expect(page.locator('.color-option').first()).toBeVisible();
  });

  test('Renk seçimi yapılabilmeli', async ({ page }) => {
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();

    const firstColor = page.locator('.color-option').first();
    await firstColor.click();

    // Seçili olarak işaretlenmeli
    await expect(firstColor).toHaveClass(/selected/);
  });

  test('Geçerli bilgilerle takım oluşturulabilmeli', async ({ page }) => {
    const teamName = `Takım${Math.floor(Math.random() * 10000)}`;
    const teamPassword = 'test123';

    await page.locator('button:has-text("Yeni Takım Oluştur")').click();

    await page.locator('#inpNewTeam').fill(teamName);
    await page.locator('#inpNewTeamPassword').fill(teamPassword);

    // Renk seç
    await page.locator('.color-option').first().click();

    // Formu gönder
    await page.locator('#createForm button:has-text("Oluştur")').click();

    // Takım sayfasına yönlendirilmeli
    await expect(page.locator('#pgTeam')).toHaveClass(/active/, { timeout: 10000 });
  });

  test('Takım oluşturma formu iptal edilebilmeli', async ({ page }) => {
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();
    await page.locator('#createForm button:has-text("İptal")').click();

    // Form kapanmalı
    await expect(page.locator('#createForm')).toBeHidden();
  });

  test('Takıma katılma formu açılmalı', async ({ page }) => {
    await page.locator('button:has-text("Takıma Giriş Yap")').click();

    const joinForm = page.locator('#joinForm');
    await expect(joinForm).toBeVisible();
    await expect(joinForm.locator('h3')).toContainText('Takım Seç');
  });

  test('Takıma katılma formu iptal edilebilmeli', async ({ page }) => {
    await page.locator('button:has-text("Takıma Giriş Yap")').click();
    await page.locator('#joinForm button:has-text("İptal")').click();

    // Form kapanmalı
    await expect(page.locator('#joinForm')).toBeHidden();
  });

  test('Skor tablosu açılabilmeli', async ({ page }) => {
    await page.locator('button:has-text("Skor Tablosu")').click();

    await expect(page.locator('#pgScoreboard')).toHaveClass(/active/);
  });

  test('Bildirimler sayfası açılabilmeli', async ({ page }) => {
    await page.locator('button:has-text("Bildirimler")').click();

    await expect(page.locator('#pgNotifications')).toHaveClass(/active/);
  });

  test('Ana sayfaya dön butonu çalışmalı', async ({ page }) => {
    await page.locator('button:has-text("Ana Sayfaya Dön")').click();

    await expect(page.locator('#pgNickname')).toHaveClass(/active/);
  });
});

test.describe('Lobby - Form Validasyonları', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;
    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });
  });

  test('Takım adı maksimum 20 karakter olmalı', async ({ page }) => {
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();

    const longName = 'BuÇokUzunBirTakımAdıOlacak12345';
    await page.locator('#inpNewTeam').fill(longName);

    const value = await page.locator('#inpNewTeam').inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });

  test('Takım şifresi maksimum 20 karakter olmalı', async ({ page }) => {
    await page.locator('button:has-text("Yeni Takım Oluştur")').click();

    const longPassword = 'BuÇokUzunBirŞifreOlacak12345678';
    await page.locator('#inpNewTeamPassword').fill(longPassword);

    const value = await page.locator('#inpNewTeamPassword').inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });
});
