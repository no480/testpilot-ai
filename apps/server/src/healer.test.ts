import assert from 'node:assert/strict';
import test from 'node:test';

import { generateHealingSuggestion } from './healer.js';

test('generateHealingSuggestion finds the Login to Sign in locator change', () => {
  const suggestion = generateHealingSuggestion("locator.click: Timeout 10000ms exceeded. getByRole('button', { name: 'Login' }) => observed name: 'Sign in'", 'TC003');

  assert.equal(suggestion.testCaseId, 'TC003');
  assert.match(suggestion.candidateReplacement, /Sign in/);
  assert.match(suggestion.reason, /changed|selector/i);
});
