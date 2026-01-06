import { test, expect } from '@playwright/test';

test.describe('Nickname Giriş Sayfası', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Ana sayfa yüklenmeli ve başlık görünmeli', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Katil');
    await expect(page.locator('.subtitle')).toContainText('Şüphe, gerçeğin gölgesidir...');
  });

  test('Nickname input ve giriş butonu görünmeli', async ({ page }) => {
    const nicknameInput = page.locator('#inpNickname');
    await expect(nicknameInput).toBeVisible();
    await expect(nicknameInput).toHaveAttribute('placeholder', 'Nick giriniz...');
    await expect(nicknameInput).toHaveAttribute('maxlength', '20');

    const submitButton = page.locator('button:has-text("Oyuna Giriş Yap")');
    await expect(submitButton).toBeVisible();
  });

  test('Admin paneli butonu görünmeli', async ({ page }) => {
    const adminButton = page.locator('button:has-text("Yönetici Paneline Git")');
    await expect(adminButton).toBeVisible();
  });

  test('Geçerli nickname ile giriş yapılabilmeli', async ({ page }) => {
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;

    await page.locator('#inpNickname').fill(randomNick);
    await page.locator('button:has-text("Oyuna Giriş Yap")').click();

    // Lobby sayfasına yönlendirilmeli
    await expect(page.locator('#pgLobby')).toHaveClass(/active/);
    await expect(page.locator('#currentUserNick')).toContainText(randomNick);
  });

  test('Enter tuşu ile giriş yapılabilmeli', async ({ page }) => {
    const randomNick = `TestUser${Math.floor(Math.random() * 10000)}`;

    const input = page.locator('#inpNickname');
    await input.fill(randomNick);
    await input.press('Enter');

    // Lobby sayfasına yönlendirilmeli
    await expect(page.locator('#pgLobby')).toHaveClass(/active/, { timeout: 10000 });
  });

  test('Boş nickname ile giriş yapılamamalı', async ({ page }) => {
    // Toast mesajları için dinleyici
    page.on('dialog', dialog => dialog.accept());

    await page.locator('button:has-text("Oyuna Giriş Yap")').click();

    // Hala ana sayfada olmalı
    await expect(page.locator('#pgNickname')).toHaveClass(/active/);
  });

  test('20 karakterden uzun nickname kesilebilmeli', async ({ page }) => {
    const longNick = 'aBuÇokUzunBirNicknameOlacak12345';
    await page.locator('#inpNickname').fill(longNick);

    const value = await page.locator('#inpNickname').inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
  });

  test('Emeği geçenler bölümü görünmeli', async ({ page }) => {
    const creditsSection = page.locator('.credits');
    await expect(creditsSection).toBeVisible();
    await expect(creditsSection.locator('h3')).toContainText('Emeği Geçenler');
  });
});
