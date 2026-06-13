"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechItem {
  key: string;
  text: string;
  /** BCP-47 lang hint, e.g. "en", "la". Falls back to "en". */
  lang?: string;
}

/**
 * Thin wrapper over the Web Speech API's SpeechSynthesis for *playback*
 * ("hear the prayer"). Abstracted so a server-side / higher-quality voice
 * (including Latin) can be swapped in later, mirroring the RecognitionProvider
 * approach in the spec. Degrades gracefully: `supported` is false where the
 * API is unavailable, and callers should hide play controls accordingly.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "speechSynthesis" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability check
    setSupported(ok);
    return () => {
      if (ok) window.speechSynthesis.cancel();
    };
  }, []);

  const buildUtterance = (item: SpeechItem) => {
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang && item.lang !== "en" ? item.lang : "en-US";
    u.rate = 0.9; // a calm, prayerful cadence
    u.pitch = 1;
    return u;
  };

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setActiveKey(null);
    setPlayingAll(false);
  }, []);

  /** Speak a single item, cancelling anything in flight. */
  const speak = useCallback((item: SpeechItem) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    setPlayingAll(false);
    const u = buildUtterance(item);
    u.onstart = () => setActiveKey(item.key);
    u.onend = () => setActiveKey((k) => (k === item.key ? null : k));
    u.onerror = () => setActiveKey((k) => (k === item.key ? null : k));
    window.speechSynthesis.speak(u);
  }, []);

  /** Speak items in sequence, highlighting each as it plays. */
  const speakAll = useCallback((items: SpeechItem[]) => {
    if (!("speechSynthesis" in window) || items.length === 0) return;
    window.speechSynthesis.cancel();
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
      const u = buildUtterance(item);
      u.onstart = () => setActiveKey(item.key);
      u.onend = () => {
        i += 1;
        next();
      };
      u.onerror = () => {
        i += 1;
        next();
      };
      window.speechSynthesis.speak(u);
    };
    next();
  }, []);

  return { supported, activeKey, playingAll, speak, speakAll, stop };
}
