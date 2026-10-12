import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isPrivateAddress,
  normalizeProvider,
  redactSecrets,
  resolveApiKey,
  validateBaseUrlShape
} from './aiProviders.js';

test('normalizeProvider only accepts openai explicitly and defaults to gemini', () => {
  assert.equal(normalizeProvider('openai'), 'openai');
  assert.equal(normalizeProvider('OpenAI'), 'gemini');
  assert.equal(normalizeProvider('anthropic'), 'gemini');
  assert.equal(normalizeProvider(undefined), 'gemini');
});

test('isPrivateAddress blocks loopback, private, link-local, metadata and mapped ranges', () => {
  const blocked = [
    '127.0.0.1',
    '10.0.0.5',
    '172.16.10.10',
    '172.17.0.1', // Docker bridge networks live in RFC1918 space
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.0.10'
  ];

  for (const ip of blocked) {
    assert.equal(isPrivateAddress(ip), true, `expected ${ip} to be blocked`);
  }

  const allowed = ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'];
  for (const ip of allowed) {
    assert.equal(isPrivateAddress(ip), false, `expected ${ip} to be allowed`);
  }
});

test('validateBaseUrlShape defaults empty input to the official OpenAI API', () => {
  const result = validateBaseUrlShape('');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.url, 'https://api.openai.com/v1');
});

test('validateBaseUrlShape accepts public https endpoints and normalizes trailing slashes', () => {
  const result = validateBaseUrlShape('https://openrouter.ai/api/v1/');
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.url, 'https://openrouter.ai/api/v1');
});

test('validateBaseUrlShape rejects unsupported protocols, credentials and private hosts', () => {
  const rejected = [
    'file:///etc/passwd',
    'ftp://api.openai.com',
    'http://user:pass@example.com/v1',
    'http://127.0.0.1:11434/v1',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.8/v1',
    'http://[::1]/v1',
    'not a url'
  ];

  for (const candidate of rejected) {
    const result = validateBaseUrlShape(candidate);
    assert.equal(result.ok, false, `expected ${candidate} to be rejected`);
  }
});

test('resolveApiKey prefers the request key and only falls back to the Gemini env default', () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'env-secret-value';

  try {
    assert.equal(resolveApiKey('gemini', ' request-key '), 'request-key');
    assert.equal(resolveApiKey('gemini', ''), 'env-secret-value');
    assert.equal(resolveApiKey('openai', ''), '');
  } finally {
    if (previous === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previous;
    }
  }
});

test('redactSecrets removes key values, key query parameters and bearer tokens', () => {
  const message = 'request to /models?key=AIzaFakeKey123 failed; also leaked AIzaFakeKey123 directly and Bearer sk-abc123token';
  const redacted = redactSecrets(message, ['AIzaFakeKey123']);

  assert.ok(!redacted.includes('AIzaFakeKey123'));
  assert.ok(!redacted.includes('sk-abc123token'));
  assert.ok(redacted.includes('[redacted]'));
});
