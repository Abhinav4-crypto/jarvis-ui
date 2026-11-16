import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

export type RealFolderKey =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'pictures'
  | 'videos'
  | 'home';

export interface DiskFileEntry {
  id: string;
  name: string;
  fullPath: string;
  folder: RealFolderKey;
  typeCategory: 'document' | 'image' | 'code' | 'media' | 'folder' | 'other';
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  isDirectory: boolean;
  matchSnippet?: string;
}

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.css',
  '.html',
  '.csv',
  '.log',
  '.yml',
  '.yaml',
  '.xml',
  '.env',
  '.ini',
  '.sql',
  '.sh',
  '.bat',
  '.ps1',
]);

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
]);

const MEDIA_EXTENSIONS = new Set([
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
]);

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.json',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.sql',
  '.sh',
  '.ps1',
  '.c',
  '.cpp',
  '.rs',
  '.go',
  '.java',
]);

export function getFolderPath(folder: RealFolderKey): string {
  const home = os.homedir();
  switch (folder) {
    case 'desktop':
      return path.join(home, 'Desktop');
    case 'documents':
      return path.join(home, 'Documents');
    case 'downloads':
      return path.join(home, 'Downloads');
    case 'pictures':
      return path.join(home, 'Pictures');
    case 'videos':
      return path.join(home, 'Videos');
    case 'home':
    default:
      return home;
  }
}

export function isAllowedLocalPath(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  const home = path.resolve(os.homedir());
  return resolved === home || resolved.startsWith(home + path.sep);
}

function classifyExtension(
  ext: string,
  isDirectory: boolean
): DiskFileEntry['typeCategory'] {
  if (isDirectory) return 'folder';
  const lower = ext.toLowerCase();
  if (IMAGE_EXTENSIONS.has(lower)) return 'image';
  if (MEDIA_EXTENSIONS.has(lower)) return 'media';
  if (CODE_EXTENSIONS.has(lower)) return 'code';
  if (TEXT_EXTENSIONS.has(lower) || ['.pdf', '.doc', '.docx', '.xlsx', '.pptx'].includes(lower)) {
    return 'document';
  }
  return 'other';
}

export async function checkFileSystemAccess(): Promise<{
  available: boolean;
  homeDir: string;
  error?: string;
}> {
  const homeDir = os.homedir();
  try {
    await fs.access(homeDir, fsConstants.R_OK);
    return { available: true, homeDir };
  } catch (err) {
    return {
      available: false,
      homeDir,
      error: err instanceof Error ? err.message : 'Home directory unreadable',
    };
  }
}

export async function browseFolder(
  folder: RealFolderKey,
  customDir?: string
): Promise<{
  directory: string;
  exists: boolean;
  items: DiskFileEntry[];
  error?: string;
}> {
  const targetDir = customDir ? path.resolve(customDir) : getFolderPath(folder);

  if (!isAllowedLocalPath(targetDir)) {
    return {
      directory: targetDir,
      exists: false,
      items: [],
      error: 'Access restricted to user home directories for Windows permission safety.',
    };
  }

  try {
    const dirEntries = await fs.readdir(targetDir, { withFileTypes: true });
    const items: DiskFileEntry[] = [];

    for (const entry of dirEntries.slice(0, 250)) {
      // Skip hidden system junctions / dot-files unless small
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(targetDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        const isDir = entry.isDirectory();
        const ext = isDir ? '' : path.extname(entry.name);
        items.push({
          id: Buffer.from(fullPath).toString('base64url'),
          name: entry.name,
          fullPath,
          folder,
          typeCategory: classifyExtension(ext, isDir),
          extension: ext.toLowerCase(),
          sizeBytes: isDir ? 0 : stat.size,
          modifiedAt: stat.mtime.toISOString(),
          isDirectory: isDir,
        });
      } catch {
        // Gracefully skip Windows protected system junctions (EPERM/EACCES)
      }
    }

    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
    });

    return { directory: targetDir, exists: true, items };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    return {
      directory: targetDir,
      exists: code !== 'ENOENT',
      items: [],
      error:
        code === 'ENOENT'
          ? `Folder does not exist on this system: ${targetDir}`
          : code === 'EACCES' || code === 'EPERM'
            ? `Permission denied for ${targetDir}`
            : err instanceof Error
              ? err.message
              : 'Unable to read directory',
    };
  }
}

export async function searchLocalFiles(options: {
  query: string;
  folder: RealFolderKey | 'all';
  searchContent: boolean;
  maxResults?: number;
}): Promise<{ items: DiskFileEntry[]; searchedFolders: string[] }> {
  const needle = options.query.trim().toLowerCase();
  const maxResults = options.maxResults ?? 60;
  const roots: RealFolderKey[] =
    options.folder === 'all'
      ? ['desktop', 'documents', 'downloads']
      : [options.folder];

  const results: DiskFileEntry[] = [];
  const searchedFolders: string[] = [];

  async function walk(dir: string, folderKey: RealFolderKey, depth: number) {
    if (depth > 3 || results.length >= maxResults) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'AppData'
      ) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!needle || entry.name.toLowerCase().includes(needle)) {
          try {
            const stat = await fs.stat(fullPath);
            results.push({
              id: Buffer.from(fullPath).toString('base64url'),
              name: entry.name,
              fullPath,
              folder: folderKey,
              typeCategory: 'folder',
              extension: '',
              sizeBytes: 0,
              modifiedAt: stat.mtime.toISOString(),
              isDirectory: true,
            });
          } catch {
            // Skip protected folder
          }
        }
        await walk(fullPath, folderKey, depth + 1);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const nameMatch = !needle || entry.name.toLowerCase().includes(needle);
        let matchSnippet: string | undefined;

        if (!nameMatch && options.searchContent && needle && TEXT_EXTENSIONS.has(ext)) {
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= 250_000) {
              const raw = await fs.readFile(fullPath, 'utf8');
              const idx = raw.toLowerCase().indexOf(needle);
              if (idx !== -1) {
                const start = Math.max(0, idx - 45);
                const end = Math.min(raw.length, idx + needle.length + 75);
                matchSnippet = raw.slice(start, end).replace(/\s+/g, ' ').trim();
              }
            }
          } catch {
            // Ignore unreadable text file
          }
        }

        if (nameMatch || matchSnippet) {
          try {
            const stat = await fs.stat(fullPath);
            results.push({
              id: Buffer.from(fullPath).toString('base64url'),
              name: entry.name,
              fullPath,
              folder: folderKey,
              typeCategory: classifyExtension(ext, false),
              extension: ext,
              sizeBytes: stat.size,
              modifiedAt: stat.mtime.toISOString(),
              isDirectory: false,
              matchSnippet,
            });
          } catch {
            // Skip inaccessible file
          }
        }
      }
    }
  }

  for (const key of roots) {
    const dirPath = getFolderPath(key);
    searchedFolders.push(dirPath);
    await walk(dirPath, key, 0);
  }

  return { items: results, searchedFolders };
}

export async function previewLocalFile(targetPath: string): Promise<{
  fullPath: string;
  name: string;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
  previewKind: 'text' | 'image' | 'unsupported';
  textContent?: string;
  truncated?: boolean;
  error?: string;
}> {
  const resolved = path.resolve(targetPath);
  if (!isAllowedLocalPath(resolved)) {
    throw new Error('Access outside user home directory is not permitted.');
  }

  const stat = await fs.stat(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const name = path.basename(resolved);

  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      fullPath: resolved,
      name,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: ext,
      previewKind: 'image',
    };
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    const MAX_BYTES = 65_536;
    const raw = await fs.readFile(resolved, 'utf8');
    const truncated = raw.length > MAX_BYTES;
    return {
      fullPath: resolved,
      name,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      extension: ext,
      previewKind: 'text',
      textContent: truncated ? raw.slice(0, MAX_BYTES) : raw,
      truncated,
    };
  }

  return {
    fullPath: resolved,
    name,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    extension: ext,
    previewKind: 'unsupported',
  };
}

export async function openLocalFileInOS(targetPath: string): Promise<{
  opened: boolean;
  error?: string;
}> {
  const resolved = path.resolve(targetPath);
  if (!isAllowedLocalPath(resolved)) {
    return {
      opened: false,
      error: 'Access outside user home directory is not permitted.',
    };
  }

  try {
    await fs.access(resolved, fsConstants.R_OK);
  } catch {
    return { opened: false, error: 'File does not exist or is inaccessible.' };
  }

  return new Promise((resolve) => {
    const plat = process.platform;
    if (plat === 'win32') {
      execFile('explorer.exe', [resolved], (err) => {
        // explorer.exe often exits with code 1 even when opening succeeds
        resolve({ opened: true, error: err ? undefined : undefined });
      });
    } else if (plat === 'darwin') {
      execFile('open', [resolved], (err) => {
        resolve({ opened: !err, error: err?.message });
      });
    } else {
      execFile('xdg-open', [resolved], (err) => {
        resolve({ opened: !err, error: err?.message });
      });
    }
  });
}
