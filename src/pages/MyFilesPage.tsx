import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  Video,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { jarvisBridge } from '../services/jarvisBridge';
import type {
  FilePreviewData,
  FileTypeFilter,
  FolderCategory,
  LocalFileItem,
} from '../types/jarvis';
import { Button } from '../components/ui/Button';
import { FileCard, formatBytes } from '../components/ui/FileCard';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';

const FOLDERS: Array<{ id: FolderCategory; label: string; icon: typeof Folder }> = [
  { id: 'desktop', label: 'Desktop', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'pictures', label: 'Pictures', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'all', label: 'Search All (Desktop/Docs/DL)', icon: FolderOpen },
];

const TYPE_FILTERS: Array<{ id: FileTypeFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'document', label: 'Documents' },
  { id: 'code', label: 'Code' },
  { id: 'image', label: 'Images' },
  { id: 'media', label: 'Media' },
  { id: 'folder', label: 'Folders' },
];

export function MyFilesPage() {
  const { openChatWithPrompt, sendChatMessage, logActivity } = useJarvis();

  const [activeFolder, setActiveFolder] = useState<FolderCategory>('documents');
  const [currentDir, setCurrentDir] = useState<string>('');
  const [items, setItems] = useState<LocalFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchContents, setSearchContents] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');

  const [selectedFile, setSelectedFile] = useState<LocalFileItem | null>(null);
  const [preview, setPreview] = useState<FilePreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  const loadFolder = useCallback(
    async (folder: FolderCategory, customDir?: string) => {
      if (folder === 'all') {
        setIsSearchMode(true);
        setLoading(true);
        setDirError(null);
        try {
          const res = await jarvisBridge.searchOsFiles(
            searchQuery,
            'all',
            searchContents
          );
          setItems(res.items);
          setCurrentDir(res.searchedFolders.join(' · '));
        } catch (err) {
          setDirError(
            err instanceof Error ? err.message : 'Unable to scan local folders.'
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      setIsSearchMode(false);
      setLoading(true);
      setDirError(null);
      try {
        const res = await jarvisBridge.browseOsFolder(folder, customDir);
        setCurrentDir(res.directory);
        setItems(res.items);
        if (res.error) setDirError(res.error);
      } catch (err) {
        setDirError(
          err instanceof Error ? err.message : 'Unable to browse local folder.'
        );
      } finally {
        setLoading(false);
      }
    },
    [searchContents, searchQuery]
  );

  useEffect(() => {
    loadFolder('documents');
  }, [loadFolder]);

  const handleSelectFolder = (folder: FolderCategory) => {
    setActiveFolder(folder);
    setSelectedFile(null);
    setPreview(null);
    loadFolder(folder);
  };

  const handleRunSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      loadFolder(activeFolder);
      return;
    }
    setIsSearchMode(true);
    setLoading(true);
    setDirError(null);
    try {
      const res = await jarvisBridge.searchOsFiles(q, activeFolder, searchContents);
      setItems(res.items);
      logActivity(
        'files',
        `Local file search: ${q}`,
        `${res.items.length} match(es) in ${activeFolder}`
      );
    } catch (err) {
      setDirError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: LocalFileItem) => {
    setOpenStatus(null);
    if (item.isDirectory) {
      setActiveFolder(item.folder === 'home' ? 'documents' : item.folder);
      loadFolder(
        item.folder === 'home' ? 'documents' : item.folder,
        item.fullPath
      );
      return;
    }
    setSelectedFile(item);
    setPreviewLoading(true);
    try {
      const data = await jarvisBridge.previewOsFile(item.fullPath);
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenInOS = async (file: LocalFileItem) => {
    setOpenStatus(null);
    const res = await jarvisBridge.openOsFile(file.fullPath);
    if (!res.opened) {
      setOpenStatus(res.error || 'Could not open file on OS.');
    } else {
      setOpenStatus(`Opened "${file.name}" in default application.`);
    }
  };

  const handleAskJarvis = async (file: LocalFileItem) => {
    const snippet = preview?.textContent
      ? `\n\nDocument content:\n${preview.textContent.slice(0, 3000)}`
      : '';
    const prompt = `Help me understand and answer questions about this local file: "${file.name}" (${file.fullPath}, ${formatBytes(file.sizeBytes)}).${snippet}`;
    openChatWithPrompt(prompt, [
      {
        id: `os-file-${file.id}`,
        name: file.name,
        type: file.extension || 'file',
        size: file.sizeBytes,
        textSnippet: preview?.textContent?.slice(0, 3500),
      },
    ]);
    await sendChatMessage(prompt, [
      {
        id: `os-file-${file.id}`,
        name: file.name,
        type: file.extension || 'file',
        size: file.sizeBytes,
        textSnippet: preview?.textContent?.slice(0, 3500),
      },
    ]);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter === 'all') return true;
      return item.typeCategory === typeFilter;
    });
  }, [items, typeFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-page-enter pb-20">
      {/* Header & Current OS Path */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
            My Local Files
          </h1>
          <p className="text-xs font-mono text-stone-600 dark:text-stone-400 truncate mt-0.5">
            {currentDir || 'Reading local user directories...'}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => loadFolder(activeFolder, isSearchMode ? undefined : currentDir)}
        >
          Refresh
        </Button>
      </div>

      {/* Search & Content Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <SearchBar
          mode="search"
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={handleRunSearch}
          placeholder="Search files by name or text contents..."
          submitLabel="Search Files"
          className="flex-1"
        />

        <label className="inline-flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 px-3 py-2 rounded-xl border border-amber-900/12 dark:border-amber-500/18 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={searchContents}
            onChange={(e) => setSearchContents(e.target.checked)}
            className="accent-amber-500"
          />
          <span>Search inside text/code files</span>
        </label>
      </div>

      {/* File Type Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl w-fit bg-amber-950/5 dark:bg-white/[0.04] border border-amber-900/10 dark:border-amber-500/15">
        {TYPE_FILTERS.map((tf) => (
          <button
            key={tf.id}
            type="button"
            onClick={() => setTypeFilter(tf.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
              typeFilter === tf.id
                ? 'bg-amber-500 text-[#0A0908] font-semibold'
                : 'text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-300',
            ].join(' ')}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {dirError && (
        <GlassCard padding="sm" className="text-xs text-amber-800 dark:text-amber-300">
          {dirError}
        </GlassCard>
      )}

      {/* 3-Column Browser: Folders | Disk Files | Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <GlassCard padding="sm" className="lg:col-span-3 space-y-1">
          <h2 className="px-2.5 py-2 font-display text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            User Directories
          </h2>
          {FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleSelectFolder(folder.id)}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left',
                  isActive
                    ? 'bg-amber-500/16 text-amber-900 dark:text-amber-300 border border-amber-500/35'
                    : 'text-stone-700 dark:text-stone-300 border border-transparent hover:bg-amber-950/5 dark:hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{folder.label}</span>
              </button>
            );
          })}
        </GlassCard>

        <GlassCard padding="md" className="lg:col-span-4 flex flex-col min-h-[380px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
              {isSearchMode ? 'Search Results' : 'Directory Contents'}
            </h2>
            <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
              {filteredItems.length} items
            </span>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-stone-500 dark:text-stone-400">
              Reading local disk...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <FolderOpen className="w-9 h-9 text-amber-500/50 mb-2.5" />
              <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
                No files found here
              </p>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 max-w-xs">
                Switch folders on the left or try a broader search query.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
              {filteredItems.map((item) => (
                <FileCard
                  key={item.id}
                  file={item}
                  selected={selectedFile?.id === item.id}
                  onSelect={() => handleSelectItem(item)}
                />
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard padding="md" className="lg:col-span-5 flex flex-col justify-between gap-4 min-h-[380px]">
          {!selectedFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <FileText className="w-10 h-10 text-amber-500/45 mb-3" />
              <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
                Document Preview
              </p>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 max-w-xs">
                Click any file to preview it directly from disk without copying, open it natively, or ask JARVIS about its contents.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="border-b border-amber-900/10 dark:border-white/[0.06] pb-3">
                  <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE] truncate">
                    {selectedFile.name}
                  </h2>
                  <p className="text-[11px] font-mono text-stone-600 dark:text-stone-400 mt-0.5 break-all">
                    {selectedFile.fullPath}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
                    {formatBytes(selectedFile.sizeBytes)} · Modified{' '}
                    {new Date(selectedFile.modifiedAt).toLocaleString()}
                  </p>
                </div>

                {previewLoading ? (
                  <p className="text-xs text-stone-500 py-8 text-center">
                    Loading preview from disk...
                  </p>
                ) : preview?.previewKind === 'image' ? (
                  <div className="rounded-xl overflow-hidden border border-amber-500/20 bg-black/40 max-h-72 flex items-center justify-center">
                    <img
                      src={`/api/files/raw?path=${encodeURIComponent(selectedFile.fullPath)}`}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="max-h-72 w-auto object-contain"
                    />
                  </div>
                ) : preview?.previewKind === 'text' ? (
                  <pre className="rounded-xl border border-amber-900/12 dark:border-amber-500/15 bg-stone-950/5 dark:bg-black/45 p-3.5 text-xs font-mono leading-relaxed text-[#171411] dark:text-amber-100/90 overflow-auto max-h-72 whitespace-pre-wrap">
                    {preview.textContent}
                  </pre>
                ) : (
                  <div className="rounded-xl border border-amber-900/10 dark:border-white/[0.06] p-6 text-center text-xs text-stone-600 dark:text-stone-400">
                    Binary format ({selectedFile.extension || 'unknown'}). Click "Open File" to launch it in your default Windows application.
                  </div>
                )}

                {openStatus && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {openStatus}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-amber-900/10 dark:border-white/[0.06] flex flex-wrap justify-end gap-2.5">
                <Button
                  variant="secondary"
                  icon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => handleOpenInOS(selectedFile)}
                >
                  Open File
                </Button>
                <Button
                  variant="primary"
                  icon={<MessageSquare className="w-4 h-4" />}
                  onClick={() => handleAskJarvis(selectedFile)}
                >
                  Ask JARVIS about this file
                </Button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
