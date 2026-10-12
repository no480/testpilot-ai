import fs from 'node:fs';
import path from 'node:path';

export const resolveServerDir = () => {
  const cwd = process.cwd();
  if (path.basename(cwd) === 'server') {
    return cwd;
  }

  return path.resolve(cwd, 'apps/server');
};

const STORAGE_PATH = path.join(resolveServerDir(), 'data', 'projects.json');
const SETTINGS_PATH = path.join(resolveServerDir(), 'data', 'settings.json');

export type AIConfig = {
  provider: 'gemini' | 'openai';
  model: string;
  baseUrl: string;
  availableModels?: string[];
  isValid?: boolean;
};

export function ensureStorage() {
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
}

export function loadProjects(): unknown[] {
  ensureStorage();

  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: unknown[]) {
  ensureStorage();
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(projects, null, 2), 'utf8');
}

export function loadSettings(): AIConfig {
  ensureStorage();

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      provider: parsed?.provider === 'openai' ? 'openai' : 'gemini',
      model: typeof parsed?.model === 'string' && parsed.model.trim() ? parsed.model : 'gemini-2.0-flash',
      baseUrl: typeof parsed?.baseUrl === 'string' ? parsed.baseUrl.trim() : '',
      availableModels: Array.isArray(parsed?.availableModels)
        ? parsed.availableModels.filter((item: unknown): item is string => typeof item === 'string')
        : [],
      isValid: Boolean(parsed?.isValid)
    };
  } catch {
    return { provider: 'gemini', model: 'gemini-2.0-flash', baseUrl: '', availableModels: [], isValid: false };
  }
}

export function saveSettings(settings: AIConfig) {
  ensureStorage();

  // API keys are intentionally never written to disk. Only non-secret
  // preferences (provider, model, base URL, cached model list) are stored.
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
    provider: settings.provider === 'openai' ? 'openai' : 'gemini',
    model: settings.model ?? 'gemini-2.0-flash',
    baseUrl: typeof settings.baseUrl === 'string' ? settings.baseUrl.trim() : '',
    availableModels: settings.availableModels ?? [],
    isValid: Boolean(settings.isValid)
  }, null, 2), 'utf8');
}

export const getStoragePath = () => STORAGE_PATH;
export const getSettingsPath = () => SETTINGS_PATH;
