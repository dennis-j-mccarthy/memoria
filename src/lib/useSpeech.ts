"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechItem {
  key: string;
  text: string;
  /** BCP-47 lang hint, e.g. "en", "la". Falls back to "en". */
  lang?: string;
  /** Pre-generated narration clip. Played when present; falls back to TTS. */
  src?: string;
}

/**
 * Plays prayer narration. Prefers the pre-generated neural-voice clip
 * (`item.src`) and falls back to the browser's SpeechSynthesis when a clip is
 * missing or can't load — so it always speaks, just less beautifully.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const cancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Audio playback works everywhere; synthesis is the fallback.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability check
    setSupported(typeof window !== "undefined");
    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const buildUtterance = (item: SpeechItem) => {
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang && item.lang !== "en" ? item.lang : "en-US";
    u.rate = 0.9;
    u.pitch = 1;
    return u;
  };

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setActiveKey(null);
    setPlayingAll(false);
  }, []);

  /** Speak via synthesis, calling onDone when finished (or unavailable). */
  const speakSynth = useCallback((item: SpeechItem, onDone: () => void) => {
    if (!("speechSynthesis" in window)) {
      onDone();
      return;
    }
    const u = buildUtterance(item);
    u.onstart = () => setActiveKey(item.key);
    u.onend = onDone;
    u.onerror = onDone;
    window.speechSynthesis.speak(u);
  }, []);

  /** Play one item: pre-generated clip if present, else synthesis fallback. */
  const playItem = useCallback(
    (item: SpeechItem, onDone: () => void) => {
      if (item.src) {
        const audio = new Audio(item.src);
        audioRef.current = audio;
        audio.onplay = () => setActiveKey(item.key);
        audio.onended = () => {
          if (audioRef.current === audio) audioRef.current = null;
          onDone();
        };
        audio.onerror = () => {
          // Clip missing/unsupported — fall back to synthesis.
          if (audioRef.current === audio) audioRef.current = null;
          speakSynth(item, onDone);
        };
        audio.play().catch(() => {
          if (audioRef.current === audio) audioRef.current = null;
          speakSynth(item, onDone);
        });
        return;
      }
      speakSynth(item, onDone);
    },
    [speakSynth],
  );

  /** Speak a single item, cancelling anything in flight. */
  const speak = useCallback(
    (item: SpeechItem) => {
      stop();
      cancelledRef.current = false;
      setPlayingAll(false);
      playItem(item, () =>
        setActiveKey((k) => (k === item.key ? null : k)),
      );
    },
    [stop, playItem],
  );

  /** Speak items in sequence, highlighting each as it plays. */
  const speakAll = useCallback(
    (items: SpeechItem[]) => {
      if (items.length === 0) return;
      stop();
      cancelledRef.current = false;
      setPlayingAll(true);
      let i = 0;
      const next = () => {
        if (cancelledRef.current || i >= items.length) {
          setActiveKey(null);
          setPlayingAll(false);
          return;
        }
        const item = items[i];
        i += 1;
        playItem(item, next);
      };
      next();
    },
    [stop, playItem],
  );

  return { supported, activeKey, playingAll, speak, speakAll, stop };
}
