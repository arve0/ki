import { test, expect, Page } from '@playwright/test';

const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const TEST_PASSWORD = 'testpass123';

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

async function createTimingQuick(page: Page, index: number) {
  await page.click('button:has-text("Start")');
  await expect(page.locator('#timer-section')).toContainText('Timer aktiv');

  const descInput = page.locator('#timer-section input[name="description"]');
  await descInput.fill(`Oppgave ${index}`);
  await page.waitForTimeout(600);

  await page.click('button:has-text("Stopp")');
  await expect(page.locator('#timer-section')).toContainText('Ingen aktiv timer');
  await page.waitForTimeout(200);
}

test.describe('Infinite scroll', () => {
  test('laster flere resultater ved scroll', async ({ page }) => {
    await loginAsNewUser(page);

    // Create 12 timings (more than one page of 10)
    for (let i = 1; i <= 12; i++) {
      await createTimingQuick(page, i);
    }

    // Reload to get fresh list
    await page.goto('/timer');

    // Initially should show 10 items
    const items = page.locator('#timings-list .bg-white');
    await expect(items).toHaveCount(10);

    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Should now have more items
    const allItems = page.locator('#timings-list .bg-white');
    const count = await allItems.count();
    expect(count).toBeGreaterThan(10);
  });
});
