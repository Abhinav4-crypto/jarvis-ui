import React from 'react';
import { Mic, MicOff, Paperclip, Send, Search } from 'lucide-react';
import { Button } from './Button';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  mode?: 'prompt' | 'search';
  showMic?: boolean;
  isListening?: boolean;
  onToggleMic?: () => void;
  showAttachment?: boolean;
  onAttach?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask JARVIS anything...',
  submitLabel = 'Send',
  mode = 'prompt',
  showMic = false,
  isListening = false,
  onToggleMic,
  showAttachment = false,
  onAttach,
  disabled = false,
  className = '',
}: SearchBarProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className={[
        'flex items-center gap-2 rounded-2xl border p-2 transition-all duration-200',
        'bg-white/90 border-amber-900/15 focus-within:border-amber-500/60 focus-within:shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)]',
        'dark:bg-[#121113]/90 dark:border-amber-500/22 dark:focus-within:border-amber-400/60',
        className,
      ].join(' ')}
    >
      {mode === 'search' && (
        <Search className="w-4 h-4 ml-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
      )}

      {showAttachment && onAttach && (
        <button
          type="button"
          onClick={onAttach}
          title="Attach file"
          aria-label="Attach file"
          className="p-2.5 rounded-xl text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 bg-transparent px-2.5 py-2 text-sm sm:text-[15px] text-[#171411] dark:text-[#FAF6EE] placeholder:text-stone-500 dark:placeholder:text-stone-500 focus:outline-none"
      />

      {showMic && onToggleMic && (
        <button
          type="button"
          onClick={onToggleMic}
          title={isListening ? 'Stop voice input' : 'Start voice input'}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          className={[
            'p-2.5 rounded-xl transition-all cursor-pointer shrink-0',
            isListening
              ? 'bg-amber-500 text-[#0A0908] shadow-[0_0_16px_rgba(245,158,11,0.65)]'
              : 'text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-500/10',
          ].join(' ')}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={disabled}
        icon={mode === 'search' ? <Search className="w-4 h-4" /> : <Send className="w-4 h-4" />}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
