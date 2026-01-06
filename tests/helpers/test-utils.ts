import { Page } from '@playwright/test';

/**
 * Test utility fonksiyonları
 */

/**
 * Rastgele nickname oluşturur
 */
export function generateRandomNickname(): string {
  return `TestUser${Math.floor(Math.random() * 100000)}`;
}

/**
 * Rastgele takım adı oluşturur
 */
export function generateRandomTeamName(): string {
  return `Takım${Math.floor(Math.random() * 100000)}`;
}

/**
 * Kullanıcı olarak giriş yapar
 */
export async function loginAsUser(page: Page, nickname?: string): Promise<string> {
  const nick = nickname || generateRandomNickname();

  await page.goto('/');
  await page.locator('#inpNickname').fill(nick);
  await page.locator('button:has-text("Oyuna Giriş Yap")').click();
  await page.waitForSelector('#pgLobby.active', { timeout: 10000 });

  return nick;
}

/**
 * Yeni takım oluşturur
 */
export async function createTeam(
  page: Page,
  teamName?: string,
  password?: string
): Promise<{ teamName: string; password: string }> {
  const name = teamName || generateRandomTeamName();
  const pass = password || 'test123';

  await page.locator('button:has-text("Yeni Takım Oluştur")').click();
  await page.locator('#inpNewTeam').fill(name);
  await page.locator('#inpNewTeamPassword').fill(pass);
  await page.locator('.color-option').first().click();
  await page.locator('#createForm button:has-text("Oluştur")').click();
  await page.waitForSelector('#pgTeam.active', { timeout: 10000 });

  return { teamName: name, password: pass };
}

/**
 * Takıma katılır
 */
export async function joinTeam(page: Page, teamName: string, password: string): Promise<void> {
  await page.locator('button:has-text("Takıma Giriş Yap")').click();
  await page.waitForTimeout(500);

  const teamOption = page.locator(`.team-opt:has-text("${teamName}")`).first();
  await teamOption.waitFor({ state: 'visible', timeout: 5000 });
  await teamOption.click();

  await page.locator('#inpJoinPassword').fill(password);
  await page.locator('#joinPasswordSection button:has-text("Giriş")').click();
  await page.waitForSelector('#pgTeam.active', { timeout: 10000 });
}

/**
 * Toast mesajının görünmesini bekler
 */
export async function waitForToast(page: Page, message: string, timeout = 5000): Promise<boolean> {
  try {
    await page.locator(`.toast:has-text("${message}")`).waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Console error'ları toplar
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Network isteklerini izler
 */
export function monitorNetworkRequests(page: Page) {
  const requests: Array<{ url: string; method: string; status?: number }> = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
    });
  });

  page.on('response', (response) => {
    const req = requests.find((r) => r.url === response.url());
    if (req) {
      req.status = response.status();
    }
  });

  return requests;
}

/**
 * Socket.IO bağlantısını bekler
 */
export async function waitForSocketConnection(page: Page, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        return typeof (window as any).socket !== 'undefined' && (window as any).socket.connected;
      },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Admin olarak giriş yapar (Test ortamı için)
 */
export async function loginAsAdmin(page: Page, adminPassword?: string): Promise<void> {
  const password = adminPassword || process.env.TEST_ADMIN_PASSWORD || '260678';

  await page.goto('/');
  await page.locator('button:has-text("Yönetici Paneline Git")').click();

  // Admin login formu dinamik olarak yüklenebilir
  await page.waitForTimeout(1000);

  // Admin şifre input'unu bul (ID veya selector dinamik olabilir)
  // Bu kısım gerçek implementation'a göre güncellenebilir
  // Şu an skip edilebilir
}

/**
 * XSS payloadlarını test eder
 */
export const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  '<iframe src="javascript:alert(1)">',
  '<body onload=alert(1)>',
  '<input onfocus=alert(1) autofocus>',
  '<select onfocus=alert(1) autofocus>',
  '<textarea onfocus=alert(1) autofocus>',
  '<keygen onfocus=alert(1) autofocus>',
  '<video><source onerror="alert(1)">',
  '<audio src=x onerror=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<marquee onstart=alert(1)>',
];

/**
 * SQL Injection payloadlarını test eder
 */
export const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT NULL--",
  "admin'--",
  "' OR 1=1--",
  "' OR 'a'='a",
  "') OR ('1'='1",
];

/**
 * Ekran görüntüsü alır (debug için)
 */
export async function takeDebugScreenshot(page: Page, name: string): Promise<void> {
  if (process.env.DEBUG_SCREENSHOTS === 'true') {
    await page.screenshot({ path: `test-results/debug-${name}-${Date.now()}.png`, fullPage: true });
  }
}
