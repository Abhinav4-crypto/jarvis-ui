import React from 'react';
import { AlertCircle, CheckCircle2, CircleSlash, Radio, XCircle } from 'lucide-react';
import type { ConnectionState } from '../../types/jarvis';

interface StatusIndicatorProps {
  label: string;
  state: ConnectionState | 'ready' | 'active';
  detail?: string;
}

export function StatusIndicator({ label, state, detail }: StatusIndicatorProps) {
  const config = {
    connected: {
      text: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Connected',
    },
    ready: {
      text: 'text-amber-700 dark:text-amber-400',
      icon: <Radio className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Ready',
    },
    active: {
      text: 'text-amber-700 dark:text-amber-400',
      icon: <Radio className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Active',
    },
    not_configured: {
      text: 'text-amber-700 dark:text-amber-300',
      icon: <CircleSlash className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Not Configured',
    },
    disconnected: {
      text: 'text-stone-600 dark:text-stone-400',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Disconnected',
    },
    error: {
      text: 'text-red-600 dark:text-red-400',
      icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
      statusWord: 'Error',
    },
  }[state];

  return (
    <div className="inline-flex items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-1.5 font-medium ${config.text}`}>
        {config.icon}
        <span>{label}</span>
      </span>
      <span aria-hidden="true" className="text-stone-400 dark:text-stone-600">
        ·
      </span>
      <span className="text-stone-600 dark:text-stone-400">
        {detail || config.statusWord}
      </span>
    </div>
  );
}
