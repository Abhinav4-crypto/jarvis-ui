import React from 'react';
import { FileCode2, FileImage, FileText, Film, Folder } from 'lucide-react';
import type { LocalFileItem } from '../../types/jarvis';

interface FileCardProps {
  file: LocalFileItem;
  selected: boolean;
  onSelect: () => void;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileCard({ file, selected, onSelect }: FileCardProps) {
  const Icon = file.isDirectory
    ? Folder
    : file.typeCategory === 'image'
      ? FileImage
      : file.typeCategory === 'code'
        ? FileCode2
        : file.typeCategory === 'media'
          ? Film
          : FileText;

  const modifiedDate = new Date(file.modifiedAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        'group rounded-xl border p-3.5 transition-all duration-150 cursor-pointer flex items-start gap-3',
        selected
          ? 'bg-amber-500/12 border-amber-500/55 shadow-[0_0_20px_-8px_rgba(245,158,11,0.4)]'
          : 'bg-white/75 dark:bg-[#121113]/75 border-amber-900/12 dark:border-amber-500/15 hover:border-amber-500/40',
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE] truncate">
          {file.name}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 mt-0.5 truncate">
          <span>{file.isDirectory ? 'Folder' : file.extension || 'File'}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {file.isDirectory ? 'Directory' : formatBytes(file.sizeBytes)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{modifiedDate}</span>
        </div>
        {file.matchSnippet && (
          <p className="mt-1.5 text-[11px] text-amber-800 dark:text-amber-300/90 line-clamp-2 font-mono">
            ...{file.matchSnippet}...
          </p>
        )}
      </div>
    </div>
  );
}
