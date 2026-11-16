import React, { useMemo, useState } from 'react';
import {
  Eye,
  FolderSearch,
  Globe,
  History,
  MessageSquare,
  Mic,
  Settings,
  Trash2,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import type { ActivityLogItem } from '../types/jarvis';
import { Button } from '../components/ui/Button';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';

type CategoryFilter = 'all' | ActivityLogItem['category'];

const FILTERS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All Activity' },
  { id: 'chat', label: 'Conversations' },
  { id: 'files', label: 'File Searches' },
  { id: 'voice', label: 'Voice' },
  { id: 'search', label: 'Web Searches' },
  { id: 'vision', label: 'Vision' },
];

export function ActivityHistoryPage() {
  const { activityLog, clearActivityHistory, openConfirmDialog } = useJarvis();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return activityLog.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !item.title.toLowerCase().includes(q) &&
          !item.detail.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [activityLog, filter, query]);

  const iconFor = (cat: ActivityLogItem['category']) => {
    switch (cat) {
      case 'chat':
        return MessageSquare;
      case 'voice':
        return Mic;
      case 'files':
        return FolderSearch;
      case 'vision':
        return Eye;
      case 'search':
        return Globe;
      default:
        return Settings;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-page-enter pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
            Activity History
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
            Timeline of conversations, file inspections, voice transcripts, web searches, and vision captures.
          </p>
        </div>

        <Button
          variant="danger"
          disabled={activityLog.length === 0}
          icon={<Trash2 className="w-4 h-4" />}
          onClick={() =>
            openConfirmDialog({
              title: 'Clear Activity History',
              description:
                'Are you sure you want to permanently erase all recorded activity history entries from this workspace?',
              confirmLabel: 'Clear History',
              onConfirm: clearActivityHistory,
            })
          }
        >
          Clear History
        </Button>
      </div>

      {/* Search + Category Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <SearchBar
          mode="search"
          value={query}
          onChange={setQuery}
          onSubmit={() => {}}
          placeholder="Filter activity by title or detail..."
          submitLabel="Filter"
          className="flex-1"
        />

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-amber-950/5 dark:bg-white/[0.04] border border-amber-900/10 dark:border-amber-500/15">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                filter === f.id
                  ? 'bg-amber-500 text-[#0A0908] font-semibold'
                  : 'text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-300',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <GlassCard padding="md">
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <History className="w-10 h-10 text-amber-500/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
              No matching activity entries
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Interact with Chat, Voice, Files, Vision, or Web Search to populate your activity log.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-amber-900/10 dark:divide-white/[0.06]">
            {filtered.map((item) => {
              const Icon = iconFor(item.category);
              return (
                <div
                  key={item.id}
                  className="py-3.5 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/12 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#171411] dark:text-[#FAF6EE]">
                        {item.title}
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5 break-words">
                        <span className="capitalize font-medium text-amber-700 dark:text-amber-400">
                          {item.category}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.detail}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400 shrink-0">
                    {item.timestamp}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
