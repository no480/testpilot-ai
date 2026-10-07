export type HealingSuggestion = {
  id: string;
  testCaseId: string;
  originalLocator: string;
  candidateReplacement: string;
  reason: string;
  status: 'Suggested' | 'Applied' | 'Rejected';
  generatedAt: string;
};

export function generateHealingSuggestion(output: string, fallbackCaseId = 'TC001'): HealingSuggestion {
  const normalizedOutput = output.toLowerCase();
  const hasLoginChange = normalizedOutput.includes('login') && normalizedOutput.includes('sign in');

  if (hasLoginChange) {
    return {
      id: 'heal-suggestion',
      testCaseId: fallbackCaseId,
      originalLocator: "page.getByRole('button', { name: 'Login' })",
      candidateReplacement: "page.getByRole('button', { name: 'Sign in' })",
      reason: 'The failure suggests the UI label changed from Login to Sign in, so the locator needs to follow the new accessible name.',
      status: 'Suggested',
      generatedAt: new Date().toISOString()
    };
  }

  return {
    id: 'heal-suggestion',
    testCaseId: fallbackCaseId,
    originalLocator: "page.getByRole('button', { name: 'Login' })",
    candidateReplacement: "page.getByRole('button', { name: /login|sign in/i })",
    reason: 'The test is likely failing because of a selector mismatch; this repair preserves the original flow while making the locator more resilient.',
    status: 'Suggested',
    generatedAt: new Date().toISOString()
  };
}
