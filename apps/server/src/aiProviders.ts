import dns from 'node:dns/promises';
import net from 'node:net';

export type AIProvider = 'gemini' | 'openai';

export type ChatCompletionOptions = {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  prompt: string;
  jsonMode?: boolean;
};

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];

const REQUEST_TIMEOUT_MS = 60_000;

export function normalizeProvider(value: unknown): AIProvider {
  return value === 'openai' ? 'openai' : 'gemini';
}

export function normalizeModel(value: unknown, provider: AIProvider): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) {
    return trimmed;
  }

  return provider === 'gemini' ? DEFAULT_GEMINI_MODEL : '';
}

export function resolveApiKey(provider: AIProvider, requestKey: unknown): string {
  const browserKey = typeof requestKey === 'string' ? requestKey.trim() : '';
  if (browserKey) {
    return browserKey;
  }

  if (provider === 'gemini') {
    return (process.env.GEMINI_API_KEY ?? '').trim();
  }

  return '';
}

export function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let output = message;

  for (const secret of secrets) {
    const value = typeof secret === 'string' ? secret.trim() : '';
    if (value.length >= 8) {
      output = output.split(value).join('[redacted]');
    }
  }

  output = output.replace(/([?&]key=)[^&\s"']+/gi, '$1[redacted]');
  output = output.replace(/(Bearer\s+)[0-9A-Za-z._-]+/gi, '$1[redacted]');

  return output;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const address = ip.toLowerCase().split('%')[0];

  if (net.isIPv4(address)) {
    return isPrivateIpv4(address);
  }

  if (net.isIPv6(address)) {
    if (address === '::' || address === '::1') return true;
    if (/^fe[89ab]/.test(address)) return true; // link-local fe80::/10
    if (/^f[cd]/.test(address)) return true; // unique local fc00::/7
    if (address.startsWith('ff')) return true; // multicast
    if (address.startsWith('::ffff:')) {
      const mapped = address.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) {
        return isPrivateIpv4(mapped);
      }
    }
    return false;
  }

  return true; // unrecognized address family: fail closed
}

export type UrlValidation = { ok: true; url: string } | { ok: false; error: string };

export function validateBaseUrlShape(raw: unknown): UrlValidation {
  const candidate = (typeof raw === 'string' && raw.trim()) || DEFAULT_OPENAI_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'Base URL must be a valid URL, for example https://api.openai.com/v1' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Base URL must use http:// or https://.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Base URL must not contain embedded credentials.' };
  }

  // Node's URL keeps IPv6 brackets in hostname (e.g. "[::1]"); strip them for the IP check.
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateAddress(host)) {
    return { ok: false, error: 'Base URL must not point to a private or internal network address.' };
  }

  const normalized = parsed.toString().replace(/\/+$/, '');
  return { ok: true, url: normalized };
}

export async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error('Base URL must not point to a private or internal network address.');
    }
    return;
  }

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve the host name "${hostname}".`);
  }

  if (!records.length) {
    throw new Error(`Could not resolve the host name "${hostname}".`);
  }

  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('Base URL must not point to a private or internal network address.');
  }
}

export async function resolveOpenAiBaseUrl(raw: unknown): Promise<string> {
  const shaped = validateBaseUrlShape(raw);
  if (!shaped.ok) {
    throw new Error(shaped.error);
  }

  await assertPublicHost(new URL(shaped.url).hostname);
  return shaped.url;
}

function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidate = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return candidate.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim() ?? '';
}

function extractOpenAIError(bodyText: string, status: number): string {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    const message = parsed?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // fall through to raw text
  }

  const trimmed = bodyText.trim();
  if (trimmed) {
    return trimmed.slice(0, 400);
  }

  return `The OpenAI-compatible API returned status ${status}.`;
}

async function chatWithGemini(options: ChatCompletionOptions): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(options.apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: options.prompt }] }],
      generationConfig: {
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
        temperature: 0.4
      }
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || `Gemini returned status ${response.status}.`);
  }

  const data = await response.json();
  const content = extractGeminiText(data);
  if (!content) {
    throw new Error('Gemini returned an empty response.');
  }

  return content;
}

async function postOpenAICompatible(baseUrl: string, apiKey: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

async function chatWithOpenAICompatible(options: ChatCompletionOptions): Promise<string> {
  const baseUrl = await resolveOpenAiBaseUrl(options.baseUrl);

  const requestBody: Record<string, unknown> = {
    model: options.model,
    messages: [{ role: 'user', content: options.prompt }],
    temperature: 0.4,
    ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {})
  };

  let response = await postOpenAICompatible(baseUrl, options.apiKey, requestBody);

  if (!response.ok && options.jsonMode && response.status === 400) {
    const errorText = await response.text();
    if (/response_format/i.test(errorText)) {
      // Some OpenAI-compatible services do not support JSON mode; retry without it.
      const { response_format: _ignored, ...fallbackBody } = requestBody;
      response = await postOpenAICompatible(baseUrl, options.apiKey, fallbackBody);
    } else {
      throw new Error(extractOpenAIError(errorText, 400));
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(extractOpenAIError(errorText, response.status));
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    throw new Error('The OpenAI-compatible API returned an empty response.');
  }

  return content;
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  return options.provider === 'openai'
    ? await chatWithOpenAICompatible(options)
    : await chatWithGemini(options);
}

export async function listModels(provider: AIProvider, apiKey: string, baseUrl?: unknown): Promise<string[]> {
  if (provider === 'openai') {
    const resolvedBase = await resolveOpenAiBaseUrl(baseUrl);
    const response = await fetch(`${resolvedBase}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(extractOpenAIError(errorText, response.status));
    }

    const data = await response.json() as { data?: Array<{ id?: string }> };
    const models = Array.from(new Set(
      (data.data ?? [])
        .map((entry) => (typeof entry.id === 'string' ? entry.id.trim() : ''))
        .filter((id): id is string => Boolean(id))
    )).sort();

    if (models.length === 0) {
      throw new Error('The API responded but no model IDs were returned.');
    }

    return models;
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Gemini returned status ${response.status}.`);
  }

  const data = await response.json() as { models?: Array<{ name?: string }> };
  const models = Array.from(new Set(
    (data.models ?? [])
      .map((model) => model.name ?? '')
      .map((name) => name.replace(/^models\//, '').trim())
      .filter((name): name is string => Boolean(name))
  )).sort();

  if (models.length === 0) {
    throw new Error('Gemini returned no models for this API key.');
  }

  return models;
}
