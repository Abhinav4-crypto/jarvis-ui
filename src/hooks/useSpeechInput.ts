import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

function getSpeechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function useSpeechInput(options: {
  language?: string;
  continuous?: boolean;
  onTranscript: (text: string, isFinal: boolean) => void;
}) {
  const { language = 'en-IN', continuous = false, onTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported = Boolean(getSpeechConstructor());

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore already stopped
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const SpeechRec = getSpeechConstructor();
    if (!SpeechRec) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return false;
    }

    setError(null);
    try {
      const rec = new SpeechRec();
      rec.lang = language;
      rec.continuous = continuous;
      rec.interimResults = true;

      rec.onresult = (event) => {
        let combined = '';
        let hasFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          combined += res[0].transcript;
          if (res.isFinal) hasFinal = true;
        }
        if (combined.trim()) {
          onTranscriptRef.current(combined.trim(), hasFinal);
        }
      };

      rec.onerror = (evt) => {
        if (evt.error !== 'aborted') {
          setError(`Microphone input error: ${evt.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      return true;
    } catch {
      setError('Could not start microphone recognition. Check browser permissions.');
      setIsListening(false);
      return false;
    }
  }, [continuous, language]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  return { isSupported, isListening, error, start, stop };
}
