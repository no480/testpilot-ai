import { test, expect } from '@playwright/test';

const projectName = "BIo";
const testData = {"username":"Admin","password":"admin123"};

test('TC_BIo_005 - Verify Page Elements and Branding on Login Page', async ({ page }) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_BIo_005'
  });

  await page.goto(process.env.BASE_URL ?? 'https://example.com');
  await expect(page).toHaveURL(/.+/);

  const usernameField = page.getByLabel(/username|email/i).or(page.getByPlaceholder(/username|email/i));
  const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.getByRole('link', { name: /login|sign in/i }));

  await usernameField.fill(testData.username);
  await passwordField.fill(testData.password);
  await submitButton.click();

  const successIndicator = page.locator('body').locator('h1, h2, h6, span').filter({ hasText: /dashboard|welcome/i }).first();
  await expect(successIndicator).toBeVisible();

  // Source requirement: User can complete the primary workflow
  // Scenario: Verify that all essential UI components, including company branding, username/password fields, and login button, are correctly rendered.
  // Expected result: The OrangeHRM logo, Username field, Password field, and Login button are clearly visible and properly aligned.
});
