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

export type OpenAIConfig = {
  apiKey: string;
  model: string;
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

export function loadSettings(): OpenAIConfig {
  ensureStorage();

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      apiKey: typeof parsed?.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed?.model === 'string' && parsed.model.trim() ? parsed.model : 'gemini-2.0-flash',
      availableModels: Array.isArray(parsed?.availableModels)
        ? parsed.availableModels.filter((item: unknown): item is string => typeof item === 'string')
        : [],
      isValid: Boolean(parsed?.isValid)
    };
  } catch {
    return { apiKey: '', model: 'gemini-2.0-flash', availableModels: [], isValid: false };
  }
}

export function saveSettings(settings: OpenAIConfig) {
  ensureStorage();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify({
    apiKey: settings.apiKey ?? '',
    model: settings.model ?? 'gemini-2.0-flash',
    availableModels: settings.availableModels ?? [],
    isValid: Boolean(settings.isValid)
  }, null, 2), 'utf8');
}

export const getStoragePath = () => STORAGE_PATH;
export const getSettingsPath = () => SETTINGS_PATH;
