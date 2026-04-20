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

async function createTiming(page: Page, description: string, tags: string[] = []) {
  await page.click('button:has-text("Start")');
  await expect(page.locator('#timer-section')).toContainText('Timer aktiv');

  if (description) {
    const descInput = page.locator('#timer-section input[name="description"]');
    await descInput.pressSequentially(description, { delay: 10 });
    // Wait for HTMX to save (debounced at 500ms + roundtrip)
    await page.waitForResponse(resp => resp.url().includes('/edit-description'), { timeout: 5000 });
  }

  for (const tag of tags) {
    const tagInput = page.locator('#timer-section input[name="tag"]');
    await tagInput.fill(tag);
    await page.locator('#timer-section button:has-text("+")').click();
    await page.waitForTimeout(300);
  }

  await page.click('button:has-text("Stopp")');
  await expect(page.locator('#timer-section')).toContainText('Ingen aktiv timer');
  await page.waitForTimeout(300);
}

test.describe('Søk', () => {
  test('kan søke på beskrivelse', async ({ page }) => {
    await loginAsNewUser(page);

    await createTiming(page, 'Frontend arbeid', ['koding']);
    await createTiming(page, 'Backend møte', ['møte']);

    // Search for "Frontend"
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Frontend');
    await page.waitForTimeout(500);

    // Should find the frontend timing
    await expect(page.locator('#timings-list')).toContainText('Frontend arbeid');
    // Should NOT show backend
    await expect(page.locator('#timings-list')).not.toContainText('Backend møte');
  });

  test('kan søke på tagger', async ({ page }) => {
    await loginAsNewUser(page);

    await createTiming(page, 'Kodeoppgave', ['utvikling']);
    await createTiming(page, 'Standup', ['møte']);

    // Search for tag
    const searchInput = page.locator('#search-input');
    await searchInput.fill('møte');
    await page.waitForTimeout(500);

    await expect(page.locator('#timings-list')).toContainText('Standup');
    await expect(page.locator('#timings-list')).not.toContainText('Kodeoppgave');
  });

  test('AND-søk med flere ord', async ({ page }) => {
    await loginAsNewUser(page);

    await createTiming(page, 'Sprint planlegging', ['møte']);
    await createTiming(page, 'Sprint utvikling', ['koding']);
    await createTiming(page, 'Annet møte', ['møte']);

    // Search for "Sprint møte" (AND)
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Sprint møte');
    await page.waitForTimeout(500);

    // Only "Sprint planlegging" has both Sprint in description AND møte in tags
    await expect(page.locator('#timings-list')).toContainText('Sprint planlegging');
    await expect(page.locator('#timings-list')).not.toContainText('Sprint utvikling');
    await expect(page.locator('#timings-list')).not.toContainText('Annet møte');
  });
});

test.describe('Sortering', () => {
  test('kan sortere på beskrivelse', async ({ page }) => {
    await loginAsNewUser(page);

    await createTiming(page, 'Alfa oppgave');
    await createTiming(page, 'Zulu oppgave');

    // Change sort to description A-Å
    await page.locator('select[name="sort"]').selectOption('description');
    await page.waitForTimeout(500);

    const items = page.locator('#timings-list .bg-white');
    const firstText = await items.first().textContent();
    const lastText = await items.last().textContent();

    expect(firstText).toContain('Alfa');
    expect(lastText).toContain('Zulu');
  });
});
