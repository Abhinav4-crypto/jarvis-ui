import type { LanguagePreference } from '../types/jarvis';

const HINGLISH_ACKNOWLEDGEMENTS = [
  'Ji, boliye! Main sun raha hoon.',
  'Yes sir, boliye.',
  'Haan ji, kya help chahiye?',
  'Ji, main sun raha hoon.',
  'Boliye, kya kaam hai?',
];

const ENGLISH_ACKNOWLEDGEMENTS = [
  'Yes, I am listening.',
  'Go ahead, how can I help?',
  'Ready for your command.',
];

const HINDI_ACKNOWLEDGEMENTS = [
  'जी, बोलिए! मैं सुन रहा हूँ।',
  'हाँ जी, बताइए क्या मदद चाहिए?',
  'जी, मैं सुन रहा हूँ।',
];

let lastAckIndex = -1;

export function pickNextAcknowledgement(language: LanguagePreference): string {
  const pool =
    language === 'english'
      ? ENGLISH_ACKNOWLEDGEMENTS
      : language === 'hindi'
        ? HINDI_ACKNOWLEDGEMENTS
        : HINGLISH_ACKNOWLEDGEMENTS;

  let nextIdx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && nextIdx === lastAckIndex) {
    nextIdx = (nextIdx + 1) % pool.length;
  }
  lastAckIndex = nextIdx;
  return pool[nextIdx];
}

export function getRecognitionLangCode(language: LanguagePreference): string {
  switch (language) {
    case 'hindi':
      return 'hi-IN';
    case 'english':
      return 'en-US';
    case 'hinglish':
    case 'auto':
    default:
      // en-IN captures mixed English + Romanized Hinglish accurately in Web Speech API
      return 'en-IN';
  }
}

export function getSynthesisLangCode(language: LanguagePreference): string {
  switch (language) {
    case 'hindi':
      return 'hi-IN';
    case 'english':
      return 'en-US';
    case 'hinglish':
    case 'auto':
    default:
      return 'en-IN';
  }
}

export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isConversationEndPhrase(text: string): boolean {
  const norm = text.toLowerCase().trim();
  const stopWords = [
    'thank you',
    'thanks',
    'shukriya',
    'dhanyawad',
    'bye',
    'goodbye',
    'bas',
    'band karo',
    'stop listening',
    'exit',
    'ok bye',
  ];
  return stopWords.some((phrase) => norm === phrase || norm.endsWith(` ${phrase}`));
}
