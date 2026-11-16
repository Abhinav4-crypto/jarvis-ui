import React, { useState } from 'react';
import { AlertCircle, Check, Copy, Paperclip, RefreshCw, Volume2 } from 'lucide-react';
import type { ChatMessage } from '../../types/jarvis';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  onSpeak?: (text: string) => void;
}

export function ChatMessageBubble({
  message,
  onRegenerate,
  canRegenerate = false,
  onSpeak,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked fallback
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3.5 border transition-colors',
          isUser
            ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/12 border-amber-500/35 text-[#171411] dark:text-[#FAF6EE]'
            : message.isError
              ? 'bg-red-500/10 border-red-500/35 text-red-900 dark:text-red-200'
              : 'bg-white/90 dark:bg-[#131214]/95 border-amber-900/12 dark:border-amber-500/18 text-[#171411] dark:text-[#FAF6EE]',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-4 mb-1.5 text-xs text-stone-600 dark:text-stone-400">
          <span className="font-semibold text-amber-800 dark:text-amber-300">
            {isUser ? 'You' : 'JARVIS'}
          </span>
          <div className="flex items-center gap-2">
            {message.sourceNote && (
              <>
                <span className="truncate max-w-[190px]">{message.sourceNote}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="tabular-nums">{message.timestamp}</span>
          </div>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-black/5 dark:bg-black/30 px-2.5 py-1.5 text-xs"
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className="truncate max-w-[160px] font-medium">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.isError ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{message.content}</span>
            </div>
          ) : (
            <span>
              {message.content || (message.isStreaming ? 'Thinking...' : '')}
              {message.isStreaming && message.content ? ' ▍' : ''}
            </span>
          )}
        </div>

        <div className="mt-2.5 pt-2 border-t border-amber-900/10 dark:border-white/[0.06] flex items-center gap-3 text-xs text-stone-600 dark:text-stone-400">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {!isUser && !message.isError && onSpeak && message.content && (
            <button
              type="button"
              onClick={() => onSpeak(message.content)}
              className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Speak</span>
            </button>
          )}

          {!isUser && canRegenerate && onRegenerate && !message.isStreaming && (
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
