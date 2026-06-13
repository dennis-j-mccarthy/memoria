"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ *
 * Minimal typings for the Web Speech API's SpeechRecognition. The DOM
 * lib doesn't ship these, and the constructor is still vendor-prefixed
 * in WebKit, so we declare just the surface we touch.
 * ------------------------------------------------------------------ */
interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}
interface RecognitionEvent extends Event {
  resultIndex: number;
  results: RecognitionResultList;
}
interface RecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface StartOptions {
  /** BCP-47 lang hint, e.g. "en", "la". Falls back to "en-US". */
  lang?: string;
  /** Fired on every interim/final hypothesis with the full transcript so far. */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Fired once recognition stops (silence, error, or manual stop). */
  onEnd?: () => void;
}

/**
 * Thin wrapper over the Web Speech API's SpeechRecognition for *recitation*
 * — the mirror image of {@link useSpeech}. The reader speaks a line and we
 * stream back the transcript so the caller can light up matched words. A
 * single recognition session runs at a time; `start()` aborts any prior one.
 * Degrades gracefully: `supported` is false where the API is unavailable.
 */
export function useRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const optsRef = useRef<StartOptions>({});

  useEffect(() => {
    const ok = getCtor() !== null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability check
    setSupported(ok);
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback((opts: StartOptions = {}) => {
    const Ctor = getCtor();
    if (!Ctor) return;

    // Abort anything already in flight before starting fresh.
    recRef.current?.abort();
    optsRef.current = opts;
    setError(null);

    const rec = new Ctor();
    rec.lang = opts.lang && opts.lang !== "en" ? opts.lang : "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);

    rec.onresult = (e: RecognitionEvent) => {
      // Concatenate every hypothesis so far into one running transcript.
      let text = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i += 1) {
        const result = e.results[i];
        text += result[0].transcript + " ";
        if (result.isFinal) isFinal = true;
      }
      optsRef.current.onTranscript?.(text.trim(), isFinal);
    };

    rec.onerror = (e: RecognitionErrorEvent) => {
      // "no-speech"/"aborted" are routine; surface the rest for the UI.
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error);
      }
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      optsRef.current.onEnd?.();
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() throws if called while already running; ignore.
    }
  }, []);

  return { supported, listening, error, start, stop };
}
