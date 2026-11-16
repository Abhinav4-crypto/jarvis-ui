import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface MemoryItem {
  id: string;
  note: string;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.jarvis-data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export function normalizeOllamaUrl(rawUrl?: string): string {
  const candidate = (rawUrl || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'http://127.0.0.1:11434';
    }
    return parsed.origin;
  } catch {
    return 'http://127.0.0.1:11434';
  }
}

export async function checkOllamaHealth(ollamaUrl?: string): Promise<{
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
  models: string[];
  error?: string;
}> {
  const endpoint = normalizeOllamaUrl(ollamaUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        status: 'error',
        endpoint,
        models: [],
        error: `Ollama returned HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const models = (data.models || [])
      .map((m) => m.name || m.model || '')
      .filter(Boolean);
    return {
      status: 'connected',
      endpoint,
      models,
    };
  } catch (err) {
    return {
      status: 'disconnected',
      endpoint,
      models: [],
      error:
        err instanceof Error && err.name === 'AbortError'
          ? `Ollama connection timed out at ${endpoint}`
          : `Ollama is not running or unreachable at ${endpoint}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function readLocalMemory(): Promise<MemoryItem[]> {
  try {
    const raw = await fs.readFile(MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemoryItem[]) : [];
  } catch {
    return [];
  }
}

export async function addLocalMemory(note: string): Promise<MemoryItem[]> {
  const trimmed = note.trim();
  if (!trimmed) return readLocalMemory();
  await fs.mkdir(DATA_DIR, { recursive: true });
  const existing = await readLocalMemory();
  const next: MemoryItem[] = [
    {
      id: `mem-${Date.now()}`,
      note: trimmed,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 60);
  await fs.writeFile(MEMORY_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function clearLocalMemory(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEMORY_FILE, '[]', 'utf8');
}

export async function readPersistedSettings(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function writePersistedSettings(settings: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

export function buildSystemInstruction(options: {
  language?: string;
  responseStyle?: string;
  memoryNotes: MemoryItem[];
}): string {
  const styleGuide =
    options.responseStyle === 'concise'
      ? 'Keep replies crisp, direct, and easy to speak aloud.'
      : options.responseStyle === 'detailed'
        ? 'Provide thorough, well-structured explanations.'
        : 'Keep replies clear, conversational, and practical.';

  let langGuide: string;
  switch (options.language) {
    case 'hindi':
    case 'hi-IN':
      langGuide =
        'Reply in natural, conversational Hindi (Devanagari script). Keep technical words like CPU, RAM, Chrome, VS Code, file, folder in English without forcing awkward literal translations.';
      break;
    case 'english':
    case 'en-US':
      langGuide =
        'Reply in clear, friendly, natural English.';
      break;
    case 'auto':
      langGuide =
        'Detect the user language automatically: if the user speaks or writes in Hinglish/Hindi, reply in natural conversational Hinglish (Roman script like "Ji, main check kar raha hoon"); if they speak pure English, reply in friendly English; if they write Devanagari Hindi, reply in natural Hindi.';
      break;
    case 'hinglish':
    default:
      langGuide =
        'Always reply in natural, friendly Hinglish (Hindi spoken naturally using English/Roman letters, e.g., "Ji, main check kar raha hoon.", "Aapke laptop ki RAM usage abhi 48% hai.", "Is file ko open kar doon?"). Do NOT use overly formal Shuddh Hindi and do NOT translate common technical terms like RAM, CPU, Chrome, VS Code, file, folder, download, or internet into Hindi.';
      break;
  }

  const memoryBlock =
    options.memoryNotes.length > 0
      ? `\n\nSaved local user memory:\n${options.memoryNotes
          .slice(0, 12)
          .map((m) => `- ${m.note}`)
          .join('\n')}`
      : '';

  return `You are JARVIS, a personal Windows desktop AI companion running on the user's computer. ${styleGuide} ${langGuide} Avoid heavy markdown formatting so your response sounds natural if spoken aloud. Never invent fake hardware readings or pretend you ran a command you did not run.${memoryBlock}`;
}

export async function runGoogleGroundedSearch(query: string): Promise<{
  connected: boolean;
  summary?: string;
  results: Array<{ title: string; url: string; description: string }>;
  error?: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      connected: false,
      results: [],
      error:
        'Live Web Search grounding requires GEMINI_API_KEY on the backend server. Configure it in .env or AI Studio Secrets, or open the query directly in your browser.',
    };
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Search the web and provide a factual, well-organized summary with key takeaways for: "${query}"`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const seenUrls = new Set<string>();
    const results: Array<{ title: string; url: string; description: string }> = [];

    for (const chunk of chunks) {
      const web = (chunk as { web?: { uri?: string; title?: string } }).web;
      if (web?.uri && !seenUrls.has(web.uri)) {
        seenUrls.add(web.uri);
        let hostLabel = web.uri;
        try {
          hostLabel = new URL(web.uri).hostname;
        } catch {
          // Keep raw URI
        }
        results.push({
          title: web.title || hostLabel,
          url: web.uri,
          description: `Verified source from ${hostLabel} referenced in live Google Search grounding.`,
        });
      }
    }

    return {
      connected: true,
      summary: response.text || '',
      results,
    };
  } catch (err) {
    return {
      connected: false,
      results: [],
      error:
        err instanceof Error
          ? err.message
          : 'Google Search grounding request failed.',
    };
  }
}
