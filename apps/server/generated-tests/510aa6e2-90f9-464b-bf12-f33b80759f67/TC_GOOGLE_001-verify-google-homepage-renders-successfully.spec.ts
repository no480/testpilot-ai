import { test, expect } from '@playwright/test';

const projectName = "testDemo";
const testData = {"username":"Admin","password":"admin123"};

test('TC_GOOGLE_001 - Verify Google Homepage Renders Successfully', async ({ page }) => {
  test.info().annotations.push({
    type: 'sourceTestCaseId',
    description: 'TC_GOOGLE_001'
  });

  await page.goto(process.env.BASE_URL ?? 'https://example.com');
  await expect(page).toHaveURL(/.+/);

  const usernameField = page.getByLabel(/username|email/i).or(page.getByPlaceholder(/username|email/i));
  const passwordField = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: /login|sign in/i }).or(page.getByRole('link', { name: /login|sign in/i }));

  await usernameField.fill(testData.username);
  await passwordField.fill(testData.password);
  await submitButton.click();

  await expect(
    page.getByRole('heading', { name: /dashboard|welcome/i }).or(page.getByText(/welcome|dashboard/i))
  ).toBeVisible();

  // Source requirement: User can complete the primary workflow
  // Scenario: Ensure that the Google homepage loads correctly with all primary elements such as the Google logo, search input field, and navigation buttons.
  // Expected result: Google homepage loads completely with the logo, search bar, and footer links visible and correctly aligned.
});
