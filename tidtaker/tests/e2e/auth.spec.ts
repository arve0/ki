import { test, expect, Page } from '@playwright/test';

const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const TEST_PASSWORD = 'testpass123';

test.describe('Registrering', () => {
  test('kan opprette ny bruker og bli videresendt til timer-side', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await expect(page.locator('h2')).toContainText('Opprett konto');

    await page.fill('#email', email);
    await page.fill('#password', TEST_PASSWORD);
    await page.fill('#passwordConfirm', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/timer');
    await expect(page.locator('h1')).toContainText('Tidtaker');
  });

  test('viser feil ved ulike passord', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#email', uniqueEmail());
    await page.fill('#password', TEST_PASSWORD);
    await page.fill('#passwordConfirm', 'annetpassord');
    await page.click('button[type="submit"]');

    await expect(page.locator('#error-msg')).toContainText('samsvarer ikke');
  });

  test('viser feil ved for kort passord', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#email', uniqueEmail());
    // Bypass browser minlength validation to test server-side
    await page.evaluate(() => {
      document.querySelectorAll('input[minlength]').forEach(el => el.removeAttribute('minlength'));
    });
    await page.fill('#password', 'kort');
    await page.fill('#passwordConfirm', 'kort');
    await page.click('button[type="submit"]');

    await expect(page.locator('#error-msg')).toContainText('minst 8 tegn');
  });
});

test.describe('Innlogging', () => {
  let email: string;

  test.beforeAll(async ({ browser }) => {
    email = uniqueEmail();
    const page = await browser.newPage();
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', TEST_PASSWORD);
    await page.fill('#passwordConfirm', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/timer');
    // Log out
    await page.click('button:has-text("Logg ut")');
    await page.waitForURL('/login');
    await page.close();
  });

  test('gyldig innlogging lykkes', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/timer');
    await expect(page.locator('h1')).toContainText('Tidtaker');
  });

  test('ugyldig innlogging viser feilmelding', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', 'feilpassord');
    await page.click('button[type="submit"]');

    await expect(page.locator('#error-msg')).toContainText('Ugyldig');
  });

  test('redirect til login når ikke autentisert', async ({ page }) => {
    await page.goto('/timer');
    await page.waitForURL('/login');
  });
});

// Helper: register and login, return page ready at /timer
async function loginAsNewUser(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto('/register');
  await page.fill('#email', email);
  await page.fill('#password', TEST_PASSWORD);
  await page.fill('#passwordConfirm', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/timer');
  return email;
}

export { loginAsNewUser, uniqueEmail, TEST_PASSWORD };
