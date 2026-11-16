import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useJarvis } from '../context/JarvisContext';
import { useSpeechInput } from '../hooks/useSpeechInput';
import type { ChatAttachment } from '../types/jarvis';
import { getRecognitionLangCode } from '../utils/hinglishVoice';
import { Button } from '../components/ui/Button';
import { ChatMessageBubble } from '../components/ui/ChatMessageBubble';
import { GlassCard } from '../components/ui/GlassCard';
import { SearchBar } from '../components/ui/SearchBar';
import { StatusIndicator } from '../components/ui/StatusIndicator';

const SUGGESTED_PROMPTS = [
  'Analyze my current laptop system status and explain what to optimize',
  'Mera daily coding workflow aur productivity plan Hinglish me banao',
  'Explain how Ollama local models and Gemini hybrid routing work',
  'Write a PowerShell script to organize my Downloads folder safely',
];

export function AiChatPage() {
  const {
    chats,
    activeChatId,
    setActiveChatId,
    createNewChat,
    deleteChatSession,
    sendChatMessage,
    regenerateLastPrompt,
    isSendingChat,
    settings,
    systemHealth,
    memoryNotes,
    addMemoryNote,
    openConfirmDialog,
    pendingChatPrefill,
    consumePendingChatPrefill,
    speakVoiceText,
    suspendVoiceForTest,
    resumeVoiceAfterTest,
  } = useJarvis();

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const speech = useSpeechInput({
    language: getRecognitionLangCode(settings.voice.language),
    onTranscript: (text, isFinal) => {
      setInput(text);
      if (isFinal) resumeVoiceAfterTest();
    },
  });

  useEffect(() => {
    if (pendingChatPrefill) {
      const prefill = consumePendingChatPrefill();
      if (prefill) {
        setInput(prefill.prompt);
        if (prefill.attachments?.length) {
          setAttachments(prefill.attachments);
        }
      }
    }
  }, [pendingChatPrefill, consumePendingChatPrefill]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isSendingChat]);

  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const next: ChatAttachment[] = [];
    for (const file of Array.from(fileList)) {
      let previewUrl: string | undefined;
      let textSnippet: string | undefined;
      if (file.type.startsWith('image/')) {
        previewUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.readAsDataURL(file);
        });
      } else if (file.size < 120_000) {
        textSnippet = await file.text().catch(() => undefined);
      }
      next.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type || 'file',
        size: file.size,
        previewUrl,
        textSnippet: textSnippet?.slice(0, 4000),
      });
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isSendingChat) return;
    if (speech.isListening) {
      speech.stop();
      resumeVoiceAfterTest();
    }
    const toSend = input;
    const filesToSend = attachments;
    setInput('');
    setAttachments([]);
    await sendChatMessage(toSend, filesToSend, activeChatId);
  };

  const handleSpeak = (text: string) => {
    speakVoiceText(text);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryDraft.trim()) return;
    await addMemoryNote(memoryDraft.trim());
    setMemoryDraft('');
  };

  const aiConnectionState =
    settings.aiModels.activeProvider === 'ollama'
      ? systemHealth.ollamaStatus
      : settings.aiModels.activeProvider === 'gemini'
        ? systemHealth.geminiStatus
        : systemHealth.ollamaStatus === 'connected' ||
            systemHealth.geminiStatus === 'connected'
          ? 'connected'
          : 'not_configured';

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8.5rem)] min-h-[540px] grid grid-cols-1 lg:grid-cols-12 gap-5 animate-page-enter">
      {/* Chat History Sidebar */}
      <GlassCard padding="sm" className="lg:col-span-3 flex flex-col min-h-[220px] lg:min-h-0">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-amber-900/10 dark:border-amber-500/15">
          <h2 className="font-display text-sm font-semibold text-[#171411] dark:text-[#FAF6EE]">
            Conversations
          </h2>
          <Button
            variant="primary"
            size="sm"
            icon={<MessageSquarePlus className="w-3.5 h-3.5" />}
            onClick={() => createNewChat()}
          >
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-3 space-y-1.5">
          {chats.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 px-2 py-6 text-center">
              Your conversation history will appear here.
            </p>
          ) : (
            chats.map((session) => {
              const isSelected = session.id === activeChat?.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setActiveChatId(session.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveChatId(session.id);
                    }
                  }}
                  className={[
                    'group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-amber-500/14 border-amber-500/40 text-[#171411] dark:text-[#FAF6EE]'
                      : 'border-transparent hover:bg-amber-950/5 dark:hover:bg-white/[0.04] text-stone-700 dark:text-stone-300',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{session.title}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 tabular-nums">
                      {session.messages.length} msgs · {session.updatedAt}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${session.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openConfirmDialog({
                        title: 'Delete Conversation',
                        description: `Remove "${session.title}" from your conversation history?`,
                        confirmLabel: 'Delete',
                        onConfirm: () => deleteChatSession(session.id),
                      });
                    }}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 opacity-75 group-hover:opacity-100 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>

      {/* Main Conversation Area */}
      <GlassCard padding="none" className="lg:col-span-9 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-amber-900/10 dark:border-amber-500/15 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-base font-semibold text-[#171411] dark:text-[#FAF6EE]">
              {activeChat ? activeChat.title : 'New Companion Session'}
            </h1>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Mode: {settings.aiModels.activeProvider.toUpperCase()} · Language:{' '}
              {settings.voice.language === 'auto'
                ? 'Auto Detect'
                : settings.voice.language.charAt(0).toUpperCase() +
                  settings.voice.language.slice(1)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<Brain className="w-3.5 h-3.5 text-amber-500" />}
              onClick={() => setShowMemoryDrawer((prev) => !prev)}
            >
              Memory ({memoryNotes.length})
            </Button>
            <StatusIndicator
              label="AI Engine"
              state={aiConnectionState}
              detail={
                systemHealth.ollamaStatus === 'connected'
                  ? `Ollama (${settings.aiModels.ollamaModel})`
                  : systemHealth.geminiStatus === 'connected'
                    ? 'Gemini Ready'
                    : undefined
              }
            />
          </div>
        </div>

        {/* Collapsible Local Memory Drawer */}
        {showMemoryDrawer && (
          <div className="px-5 py-3 border-b border-amber-900/10 dark:border-amber-500/15 bg-amber-500/[0.04] space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Local Persistent Memory (.jarvis-data/memory.json)
              </p>
              <button
                type="button"
                onClick={() => setShowMemoryDrawer(false)}
                className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleAddMemory} className="flex gap-2">
              <input
                type="text"
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                placeholder="Save a personal fact or preference for JARVIS to remember..."
                className="flex-1 rounded-xl border border-amber-900/15 dark:border-amber-500/20 bg-white dark:bg-[#141316] px-3 py-1.5 text-xs text-[#171411] dark:text-[#FAF6EE]"
              />
              <Button type="submit" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Save Note
              </Button>
            </form>
            {memoryNotes.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {memoryNotes.map((m) => (
                  <span
                    key={m.id}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-amber-500/25 bg-white/60 dark:bg-black/30 text-stone-700 dark:text-stone-300"
                  >
                    {m.note}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Stream or Empty Welcome Screen */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[#0A0908] shadow-[0_0_30px_-6px_rgba(245,158,11,0.6)] mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#171411] dark:text-[#FAF6EE]">
                Talk with JARVIS
              </h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Real streaming AI responses powered by your local Ollama models or Gemini API, with persistent local memory and English/Hindi support.
              </p>

              <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="p-3.5 rounded-xl border border-amber-900/12 dark:border-amber-500/20 bg-white/60 dark:bg-white/[0.03] hover:border-amber-500/45 hover:bg-amber-500/8 text-xs leading-relaxed text-[#171411] dark:text-[#EAE2D3] transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeChat.messages.map((msg, index) => (
                <ChatMessageBubble
                  key={msg.id}
                  message={msg}
                  onSpeak={handleSpeak}
                  canRegenerate={
                    msg.role === 'jarvis' && index === activeChat.messages.length - 1
                  }
                  onRegenerate={() => regenerateLastPrompt(activeChat.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Pending attachments tray */}
        {attachments.length > 0 && (
          <div className="px-5 py-2 border-t border-amber-900/10 dark:border-amber-500/12 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-[#171411] dark:text-[#FAF6EE]"
              >
                <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                <span className="truncate max-w-[160px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((item) => item.id !== att.id))
                  }
                  aria-label={`Remove ${att.name}`}
                  className="text-stone-500 hover:text-red-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-amber-900/10 dark:border-amber-500/15">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleAttachFiles}
          />
          <SearchBar
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            placeholder="Message JARVIS..."
            submitLabel={isSendingChat ? 'Streaming...' : 'Send'}
            showMic
            isListening={speech.isListening}
            onToggleMic={() => {
              if (speech.isListening) {
                speech.stop();
                resumeVoiceAfterTest();
              } else {
                suspendVoiceForTest();
                const ok = speech.start();
                if (!ok) resumeVoiceAfterTest();
              }
            }}
            showAttachment
            onAttach={() => fileInputRef.current?.click()}
            disabled={isSendingChat}
          />
        </div>
      </GlassCard>
    </div>
  );
}
