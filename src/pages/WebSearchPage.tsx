import React, { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Globe,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { jarvisBridge } from '../services/jarvisBridge';
import type { LiveSearchResult, SearchCategory } from '../types/jarvis';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';

const CATEGORIES: Array<{ id: SearchCategory; label: string }> = [
  { id: 'all', label: 'All Web' },
  { id: 'docs', label: 'Documentation' },
  { id: 'code', label: 'Code & Repos' },
  { id: 'news', label: 'News' },
  { id: 'academic', label: 'Academic' },
  { id: 'video', label: 'Videos' },
];

export function WebSearchPage() {
  const { searches, recordSearch, toggleSaveSearch, removeSearchEntry } = useJarvis();
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<LiveSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleRunSearch = async (customQuery?: string) => {
    const target = (customQuery ?? query).trim();
    if (!target) return;

    setQuery(target);
    setActiveQuery(target);
    recordSearch(target, category);
    setSearching(true);
    setSearchError(null);
    setSummary(null);
    setLiveResults([]);

    const scopedQuery =
      category === 'docs'
        ? `${target} official documentation`
        : category === 'code'
          ? `${target} github stackoverflow`
          : category === 'news'
            ? `${target} latest news`
            : category === 'academic'
              ? `${target} research paper`
              : category === 'video'
                ? `${target} youtube tutorial`
                : target;

    const res = await jarvisBridge.runWebSearch(scopedQuery);
    setSearching(false);

    if (res.connected) {
      setSummary(res.summary || null);
      setLiveResults(res.results);
    } else {
      setSearchError(
        res.error ||
          'Live grounded search is unavailable. You can open this query directly in your browser below.'
      );
    }
  };

  const savedSearches = searches.filter((s) => s.saved);
  const recentSearches = searches.slice(0, 8);
  const googleUrl = activeQuery
    ? jarvisBridge.buildGoogleSearchUrl(activeQuery, category)
    : '';

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-page-enter pb-20">
      <GlassCard glow padding="lg" className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#171411] dark:text-[#FAF6EE]">
            Web Search
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1">
            Live Google Search grounding powered by your backend, returning verified web source links and direct browser launch.
          </p>
        </div>

        <SearchBar
          mode="search"
          value={query}
          onChange={setQuery}
          onSubmit={() => handleRunSearch()}
          placeholder="Search the web, documentation, repositories, or current events..."
          submitLabel={searching ? 'Searching...' : 'Search'}
          disabled={searching}
        />

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={[
                'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
                category === cat.id
                  ? 'bg-amber-500 text-[#0A0908] font-semibold shadow-[0_0_16px_-4px_rgba(245,158,11,0.6)]'
                  : 'border border-amber-900/12 dark:border-amber-500/18 text-stone-700 dark:text-stone-300 hover:border-amber-500/40',
              ].join(' ')}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          {!activeQuery ? (
            <GlassCard padding="lg" className="text-center py-14">
              <Globe className="w-10 h-10 text-amber-500/55 mx-auto mb-3" />
              <h2 className="font-display text-lg font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Ready to Search the Web
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
                Enter any query above to fetch live Google Search grounded results and verified web links.
              </p>
            </GlassCard>
          ) : searching ? (
            <GlassCard padding="lg" className="text-center py-12 text-sm text-amber-700 dark:text-amber-300">
              Querying live web search provider for "{activeQuery}"...
            </GlassCard>
          ) : (
            <>
              {searchError && (
                <GlassCard padding="md" className="space-y-3 border-amber-500/30">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {searchError}
                  </p>
                  {googleUrl && (
                    <a
                      href={googleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-[#0A0908] text-xs font-semibold"
                    >
                      <span>Open "{activeQuery}" on Google</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </GlassCard>
              )}

              {summary && (
                <GlassCard padding="md" className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Grounded Search Summary</span>
                    </span>
                    {googleUrl && (
                      <a
                        href={googleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                      >
                        <span>Open in Browser</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed text-[#171411] dark:text-[#FAF6EE] whitespace-pre-wrap">
                    {summary}
                  </div>
                </GlassCard>
              )}

              {liveResults.map((res, idx) => (
                <GlassCard key={`${res.url}-${idx}`} padding="md" className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                        {res.title}
                      </h2>
                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                        {res.description}
                      </p>
                    </div>
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-[#0A0908] text-xs font-semibold hover:brightness-110 transition-all whitespace-nowrap shrink-0"
                    >
                      <span>Open in Browser</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                    {res.url}
                  </p>
                </GlassCard>
              ))}
            </>
          )}
        </div>

        <div className="lg:col-span-4 space-y-5">
          <GlassCard padding="md" className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Recent Searches
              </h2>
            </div>

            {recentSearches.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
                Your recent web searches will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {recentSearches.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-amber-900/10 dark:border-white/[0.06] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleRunSearch(item.query)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE] truncate hover:text-amber-600 dark:hover:text-amber-300">
                        {item.query}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 capitalize">
                        {item.category} · {item.timestamp}
                      </p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleSaveSearch(item.id)}
                        title={item.saved ? 'Remove bookmark' : 'Save search'}
                        aria-label={item.saved ? 'Remove bookmark' : 'Save search'}
                        className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      >
                        {item.saved ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSearchEntry(item.id)}
                        aria-label="Delete search entry"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard padding="md" className="space-y-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Saved Searches
              </h2>
            </div>

            {savedSearches.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-4">
                Bookmark any query from Recent Searches to pin it here.
              </p>
            ) : (
              <div className="space-y-2">
                {savedSearches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRunSearch(item.query)}
                    className="w-full text-left rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 hover:border-amber-500/50 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-medium text-[#171411] dark:text-[#FAF6EE] truncate">
                      {item.query}
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 capitalize">
                      {item.category}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
