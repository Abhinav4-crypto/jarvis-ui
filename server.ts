import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import type { GenerateContentResponse } from '@google/genai';
import { getRealSystemMetrics } from './server/systemService.ts';
import {
  browseFolder,
  checkFileSystemAccess,
  isAllowedLocalPath,
  openLocalFileInOS,
  previewLocalFile,
  searchLocalFiles,
  type RealFolderKey,
} from './server/fileService.ts';
import {
  addLocalMemory,
  buildSystemInstruction,
  checkOllamaHealth,
  clearLocalMemory,
  getGeminiClient,
  isGeminiConfigured,
  normalizeOllamaUrl,
  readLocalMemory,
  readPersistedSettings,
  runGoogleGroundedSearch,
  writePersistedSettings,
} from './server/aiService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // 1. Real Health & Service Status
  app.get('/api/status', async (req: Request, res: Response) => {
    const ollamaUrl = typeof req.query.ollamaUrl === 'string' ? req.query.ollamaUrl : undefined;
    const selectedModel =
      typeof req.query.ollamaModel === 'string' ? req.query.ollamaModel : '';

    const [ollama, fsAccess] = await Promise.all([
      checkOllamaHealth(ollamaUrl),
      checkFileSystemAccess(),
    ]);

    const geminiReady = isGeminiConfigured();
    const modelAvailable =
      !selectedModel ||
      ollama.models.some(
        (m) => m === selectedModel || m.startsWith(`${selectedModel}:`)
      );

    res.json({
      backend: { status: 'connected', port: PORT },
      ollama: {
        status: ollama.status,
        endpoint: ollama.endpoint,
        models: ollama.models,
        selectedModel,
        selectedModelInstalled: ollama.status === 'connected' ? modelAvailable : false,
        error: ollama.error,
      },
      gemini: {
        status: geminiReady ? 'connected' : 'not_configured',
        configured: geminiReady,
        model: 'gemini-4-hydrogen',
      },
      fileSystem: {
        status: fsAccess.available ? 'connected' : 'error',
        homeDir: fsAccess.homeDir,
        error: fsAccess.error,
      },
    });
  });

  // 2. Real Hardware & OS Monitoring via systeminformation
  app.get('/api/system', async (_req: Request, res: Response) => {
    try {
      const metrics = await getRealSystemMetrics();
      res.json(metrics);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to collect system metrics',
      });
    }
  });

  // 3. Real Local File System Access
  app.get('/api/files/browse', async (req: Request, res: Response) => {
    const folder = (typeof req.query.folder === 'string'
      ? req.query.folder
      : 'documents') as RealFolderKey;
    const customDir =
      typeof req.query.dir === 'string' && req.query.dir.trim()
        ? req.query.dir.trim()
        : undefined;
    const result = await browseFolder(folder, customDir);
    res.json(result);
  });

  app.get('/api/files/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const folder = (typeof req.query.folder === 'string'
      ? req.query.folder
      : 'all') as RealFolderKey | 'all';
    const searchContent = req.query.content === 'true';

    const result = await searchLocalFiles({
      query,
      folder,
      searchContent,
    });
    res.json(result);
  });

  app.get('/api/files/preview', async (req: Request, res: Response) => {
    const targetPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!targetPath) {
      res.status(400).json({ error: 'Missing path parameter' });
      return;
    }
    try {
      const preview = await previewLocalFile(targetPath);
      res.json(preview);
    } catch (err) {
      res.status(403).json({
        error: err instanceof Error ? err.message : 'Unable to preview file',
      });
    }
  });

  app.get('/api/files/raw', (req: Request, res: Response) => {
    const targetPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!targetPath || !isAllowedLocalPath(targetPath)) {
      res.status(403).json({ error: 'Path not permitted' });
      return;
    }
    res.sendFile(path.resolve(targetPath), (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  });

  app.post('/api/files/open', async (req: Request, res: Response) => {
    const targetPath = typeof req.body?.path === 'string' ? req.body.path : '';
    if (!targetPath) {
      res.status(400).json({ opened: false, error: 'Missing file path' });
      return;
    }
    const result = await openLocalFileInOS(targetPath);
    res.status(result.opened ? 200 : 400).json(result);
  });

  // 4. Local Memory Store
  app.get('/api/memory', async (_req: Request, res: Response) => {
    const items = await readLocalMemory();
    res.json({ items });
  });

  app.post('/api/memory', async (req: Request, res: Response) => {
    const note = typeof req.body?.note === 'string' ? req.body.note : '';
    const items = await addLocalMemory(note);
    res.json({ items });
  });

  app.delete('/api/memory', async (_req: Request, res: Response) => {
    await clearLocalMemory();
    res.json({ items: [] });
  });

  // 4b. Persistent Disk Settings Store (synced with Electron background daemon)
  app.get('/api/settings', async (_req: Request, res: Response) => {
    const settings = await readPersistedSettings();
    res.json({ settings });
  });

  app.post('/api/settings', async (req: Request, res: Response) => {
    if (req.body && typeof req.body === 'object') {
      await writePersistedSettings(req.body);
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ ok: false, error: 'Invalid settings payload' });
  });

  // 5. Real AI Chat (Ollama + Gemini with Streaming SSE)
  app.post('/api/chat', async (req: Request, res: Response) => {
    const {
      prompt,
      history = [],
      attachments = [],
      provider = 'hybrid',
      ollamaModel = 'llama3.2',
      ollamaEndpoint,
      language = 'hinglish',
      responseStyle = 'balanced',
      useLocalMemory = true,
      stream = true,
    } = req.body as {
      prompt?: string;
      history?: Array<{ role: 'user' | 'jarvis'; content: string }>;
      attachments?: Array<{ name: string; textSnippet?: string; previewUrl?: string }>;
      provider?: 'ollama' | 'gemini' | 'hybrid';
      ollamaModel?: string;
      ollamaEndpoint?: string;
      language?: string;
      responseStyle?: string;
      useLocalMemory?: boolean;
      stream?: boolean;
    };

    if (!prompt?.trim() && attachments.length === 0) {
      res.status(400).json({ error: 'Prompt cannot be empty.' });
      return;
    }

    const memoryNotes = useLocalMemory ? await readLocalMemory() : [];
    const systemInstruction = buildSystemInstruction({
      language,
      responseStyle,
      memoryNotes,
    });

    const attachmentContext = attachments
      .filter((a) => a.textSnippet)
      .map((a) => `\n\n[Attached File: ${a.name}]\n${a.textSnippet}`)
      .join('');

    const fullUserPrompt = `${prompt || ''}${attachmentContext}`.trim();

    // Determine active provider cleanly without inventing connections
    const ollamaUrl = normalizeOllamaUrl(ollamaEndpoint);
    let chosenBackend: 'ollama' | 'gemini' | null = null;
    let ollamaCheck = null;

    if (provider === 'ollama') {
      ollamaCheck = await checkOllamaHealth(ollamaUrl);
      if (ollamaCheck.status === 'connected') chosenBackend = 'ollama';
    } else if (provider === 'gemini') {
      if (isGeminiConfigured()) chosenBackend = 'gemini';
    } else {
      // Hybrid: prefer Ollama local model if running, else Gemini if configured
      ollamaCheck = await checkOllamaHealth(ollamaUrl);
      if (ollamaCheck.status === 'connected') {
        chosenBackend = 'ollama';
      } else if (isGeminiConfigured()) {
        chosenBackend = 'gemini';
      }
    }

    if (!chosenBackend) {
      res.status(503).json({
        error:
          provider === 'ollama'
            ? `Ollama is not running at ${ollamaUrl}. Start Ollama ("ollama serve") and pull "${ollamaModel}", or switch AI Mode to Gemini/Hybrid.`
            : provider === 'gemini'
              ? 'GEMINI_API_KEY is not configured on the backend server. Add it in AI Studio Secrets or .env.'
              : `Neither Ollama (${ollamaUrl}) nor GEMINI_API_KEY is currently available. Start Ollama locally or configure GEMINI_API_KEY.`,
      });
      return;
    }

    const sendSseEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    try {
      if (chosenBackend === 'ollama') {
        const ollamaMessages = [
          { role: 'system', content: systemInstruction },
          ...history.slice(-12).map((h) => ({
            role: h.role === 'jarvis' ? 'assistant' : 'user',
            content: h.content,
          })),
          { role: 'user', content: fullUserPrompt },
        ];

        const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: ollamaMessages,
            stream: Boolean(stream),
          }),
        });

        if (!ollamaRes.ok || !ollamaRes.body) {
          const errText = await ollamaRes.text();
          if (stream) {
            sendSseEvent({ error: `Ollama error (${ollamaRes.status}): ${errText}` });
            res.end();
          } else {
            res.status(502).json({ error: errText });
          }
          return;
        }

        if (!stream) {
          const data = (await ollamaRes.json()) as { message?: { content?: string } };
          res.json({
            replyText: data.message?.content || '',
            providerLabel: `Ollama · ${ollamaModel}`,
          });
          return;
        }

        sendSseEvent({ meta: { providerLabel: `Ollama · ${ollamaModel}` } });
        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line) as {
                message?: { content?: string };
                done?: boolean;
              };
              if (parsed.message?.content) {
                sendSseEvent({ delta: parsed.message.content });
              }
            } catch {
              // Ignore partial NDJSON line
            }
          }
        }
        sendSseEvent({ done: true });
        res.end();
        return;
      }

      // Gemini backend via @google/genai
      const ai = getGeminiClient();
      if (!ai) {
        throw new Error('GEMINI_API_KEY is missing.');
      }

      const geminiHistory = history.slice(-12).map((h) => ({
        role: h.role === 'jarvis' ? ('model' as const) : ('user' as const),
        parts: [{ text: h.content }],
      }));

      const imageParts = attachments
        .filter((a) => a.previewUrl && a.previewUrl.startsWith('data:image/'))
        .map((a) => {
          const [meta, base64] = (a.previewUrl || '').split(',');
          const mimeMatch = meta?.match(/data:([^;]+);base64/);
          return {
            inlineData: {
              mimeType: mimeMatch?.[1] || 'image/png',
              data: base64 || '',
            },
          };
        })
        .filter((p) => p.inlineData.data);

      if (!stream) {
        const result = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            ...geminiHistory,
            {
              role: 'user',
              parts: [...imageParts, { text: fullUserPrompt }],
            },
          ],
          config: { systemInstruction },
        });
        res.json({
          replyText: result.text || '',
          providerLabel: 'Gemini · gemini-4-hydrogen',
        });
        return;
      }

      sendSseEvent({ meta: { providerLabel: 'Gemini · gemini-4-hydrogen' } });
      const streamResp = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: [
          ...geminiHistory,
          {
            role: 'user',
            parts: [...imageParts, { text: fullUserPrompt }],
          },
        ],
        config: { systemInstruction },
      });

      for await (const chunk of streamResp) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          sendSseEvent({ delta: c.text });
        }
      }
      sendSseEvent({ done: true });
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI inference failed';
      if (stream) {
        sendSseEvent({ error: msg });
        res.end();
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  // 6. Real Screen & Image Vision Analysis
  app.post('/api/vision/analyze', async (req: Request, res: Response) => {
    const {
      prompt = 'Describe visible application windows, text, and interface elements on this screen.',
      imageDataUrl,
      provider = 'hybrid',
      ollamaModel = 'llava',
      ollamaEndpoint,
    } = req.body as {
      prompt?: string;
      imageDataUrl?: string;
      provider?: 'ollama' | 'gemini' | 'hybrid';
      ollamaModel?: string;
      ollamaEndpoint?: string;
    };

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      res.status(400).json({
        error: 'A captured screen or uploaded image data URL is required.',
      });
      return;
    }

    const [meta, base64Data] = imageDataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const ollamaUrl = normalizeOllamaUrl(ollamaEndpoint);

    // Prefer Gemini when available (gemini-4-hydrogen is natively multimodal) or Ollama vision models
    const geminiClient = provider !== 'ollama' ? getGeminiClient() : null;

    if (geminiClient && (provider === 'gemini' || provider === 'hybrid')) {
      try {
        const response: GenerateContentResponse =
          await geminiClient.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: `You are JARVIS Screen Vision. Inspect this screenshot or image carefully. Describe visible application windows, readable text, UI elements, errors, and answer the user's question clearly.\n\nUser request: ${prompt}`,
                },
              ],
            },
          });

        res.json({
          connected: true,
          providerLabel: 'Gemini Vision · gemini-4-hydrogen',
          analysisText: response.text || 'No analysis text returned.',
        });
        return;
      } catch (err) {
        if (provider === 'gemini') {
          res.status(502).json({
            connected: false,
            error: err instanceof Error ? err.message : 'Gemini vision failed',
          });
          return;
        }
      }
    }

    // Try Ollama vision model if selected or in hybrid fallback
    const ollamaHealth = await checkOllamaHealth(ollamaUrl);
    if (ollamaHealth.status === 'connected') {
      try {
        const oRes = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt: `Describe visible application windows, text, and UI elements in this image and answer: ${prompt}`,
            images: [base64Data],
            stream: false,
          }),
        });
        if (!oRes.ok) {
          const text = await oRes.text();
          res.status(502).json({
            connected: false,
            error: `Ollama vision error (${oRes.status}): ${text}. Ensure a vision-capable model like "llava" or "llama3.2-vision" is installed.`,
          });
          return;
        }
        const data = (await oRes.json()) as { response?: string };
        res.json({
          connected: true,
          providerLabel: `Ollama Vision · ${ollamaModel}`,
          analysisText: data.response || 'No analysis returned.',
        });
        return;
      } catch (err) {
        res.status(502).json({
          connected: false,
          error: err instanceof Error ? err.message : 'Ollama vision request failed',
        });
        return;
      }
    }

    res.status(503).json({
      connected: false,
      error:
        'No vision-capable AI backend is currently active. Configure GEMINI_API_KEY or run a vision-capable Ollama model (e.g. "ollama run llava").',
    });
  });

  // 7. Real Web Search Grounding
  app.post('/api/search', async (req: Request, res: Response) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      res.status(400).json({ connected: false, results: [], error: 'Search query is required.' });
      return;
    }
    const result = await runGoogleGroundedSearch(query);
    res.json(result);
  });

  // Mount Vite middleware in dev, or serve static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*splat', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Run npm run build first.');
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start JARVIS server:', err);
  process.exit(1);
});
