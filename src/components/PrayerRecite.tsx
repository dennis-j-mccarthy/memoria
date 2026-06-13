"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRecognition } from "@/lib/useRecognition";
import { useSpeech } from "@/lib/useSpeech";
import { matchSpoken, realWordIndices, toWords } from "@/lib/recite";
import type { PassageView, SegmentRole } from "@/lib/content";

interface Props {
  passage: PassageView;
  /** Anchor word indices per segment, owned by the parent and shared with Read. */
  anchors: Record<string, Set<number>>;
  onToggleAnchor: (segId: string, wordIndex: number) => void;
}

/** Share of a line's real words you must speak before it counts as recited. */
const PASS_THRESHOLD = 0.8;

function coverage(realIdx: number[], heard: Set<number>): number {
  if (realIdx.length === 0) return 1;
  let hit = 0;
  for (const i of realIdx) if (heard.has(i)) hit += 1;
  return hit / realIdx.length;
}

/**
 * Recite mode (spec: active recall). Every line is blanked down to its gold
 * anchors; you speak it from memory and each word lights up as it's heard,
 * advancing line by line. Tap any word to toggle it as an anchor — i.e. reset
 * which scaffolding shows for that segment — when you need a bigger hint.
 */
export function PrayerRecite({ passage, anchors, onToggleAnchor }: Props) {
  const segments = passage.segments;

  // Per-segment word lists, computed once.
  const words = useMemo(
    () => Object.fromEntries(segments.map((s) => [s.id, toWords(s.text)])),
    [segments],
  );
  const realIdx = useMemo(
    () =>
      Object.fromEntries(
        segments.map((s) => [s.id, realWordIndices(words[s.id])]),
      ),
    [segments, words],
  );

  // Words revealed by voice as they're recited.
  const [heard, setHeard] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(segments.map((s) => [s.id, new Set<number>()])),
  );
  const [done, setDone] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);

  // Refs mirror state so the live recognition callback reads current values.
  // Kept in sync by the setters below, never written during render.
  const heardRef = useRef(heard);
  const doneRef = useRef(done);

  const { supported, listening, error, start, stop } = useRecognition();
  const speech = useSpeech();
  const [activeId, setActiveId] = useState<string | null>(null);

  const advance = useCallback(
    (fromIndex: number, doneSet: Set<string>) => {
      let next = fromIndex + 1;
      while (next < segments.length && doneSet.has(segments[next].id)) next += 1;
      setCursor(next);
    },
    [segments],
  );

  const completeSegment = useCallback(
    (segId: string, index: number) => {
      if (doneRef.current.has(segId)) return;
      const nextDone = new Set(doneRef.current);
      nextDone.add(segId);
      doneRef.current = nextDone;
      setDone(nextDone);
      advance(index, nextDone);
    },
    [advance],
  );

  const startListening = useCallback(
    (segId: string, index: number) => {
      const segWords = words[segId];
      const real = realIdx[segId];
      const session = new Set(heardRef.current[segId] ?? []);
      setActiveId(segId);
      start({
        lang: passage.language,
        onTranscript: (text) => {
          const matched = matchSpoken(segWords, text);
          let changed = false;
          matched.forEach((i) => {
            if (!session.has(i)) {
              session.add(i);
              changed = true;
            }
          });
          if (changed) {
            const updated = new Set(session);
            heardRef.current = { ...heardRef.current, [segId]: updated };
            setHeard((prev) => ({ ...prev, [segId]: updated }));
          }
          if (coverage(real, session) >= PASS_THRESHOLD) {
            stop();
            completeSegment(segId, index);
          }
        },
        onEnd: () => setActiveId(null),
      });
    },
    [words, realIdx, start, stop, passage.language, completeSegment],
  );

  const revealLine = useCallback(
    (segId: string, index: number) => {
      if (activeId === segId) stop();
      completeSegment(segId, index);
    },
    [activeId, stop, completeSegment],
  );

  const reset = useCallback(() => {
    stop();
    speech.stop();
    const freshHeard = Object.fromEntries(
      segments.map((s) => [s.id, new Set<number>()]),
    );
    heardRef.current = freshHeard;
    setHeard(freshHeard);
    doneRef.current = new Set();
    setDone(new Set());
    setCursor(0);
    setActiveId(null);
  }, [segments, stop, speech]);

  const completedCount = done.size;
  const allDone = completedCount === segments.length;

  return (
    <div>
      {/* Status bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{
                width: `${(completedCount / segments.length) * 100}%`,
              }}
            />
          </div>
          <span className="font-sans text-sm text-ink-faint">
            {completedCount} / {segments.length} recited
          </span>
        </div>
        {completedCount > 0 && (
          <button
            onClick={reset}
            className="rounded-full border border-hairline px-3 py-1 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            ↺ Start over
          </button>
        )}
      </div>

      <p className="mb-5 font-sans text-xs text-ink-faint">
        Tap any word to reveal it as an anchor · tap again to hide it
      </p>

      {!supported && (
        <p className="mb-5 rounded-xl border border-hairline bg-parchment-raised px-4 py-3 font-sans text-sm text-ink-soft">
          Voice recognition isn&apos;t available in this browser, but you can
          still practice: tap a blank to reveal it, or use <em>Reveal line</em>{" "}
          to move on.
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-xl border border-hairline bg-parchment-raised px-4 py-3 font-sans text-sm text-ink-soft">
          Microphone error: {error}. Check mic permissions and try again.
        </p>
      )}

      <ol className="space-y-2.5">
        {segments.map((seg, i) => {
          const isDone = done.has(seg.id);
          const isCurrent = i === cursor && !allDone;
          const isListening = activeId === seg.id && listening;
          return (
            <li key={seg.id}>
              <ReciteBubble
                role={seg.role}
                current={isCurrent}
                listening={isListening}
              >
                <MaskedLine
                  words={words[seg.id]}
                  anchorSet={anchors[seg.id]}
                  heardSet={heard[seg.id]}
                  done={isDone}
                  onToggleWord={(idx) => onToggleAnchor(seg.id, idx)}
                />
              </ReciteBubble>

              {isCurrent && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {supported && (
                    <button
                      onClick={() =>
                        isListening ? stop() : startListening(seg.id, i)
                      }
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors ${
                        isListening
                          ? "bg-gold text-parchment-raised"
                          : "bg-ink text-parchment-raised hover:opacity-90"
                      }`}
                    >
                      <MicIcon />
                      {isListening ? "Listening… tap to stop" : "Recite this line"}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      speech.activeKey === seg.id
                        ? speech.stop()
                        : speech.speak({
                            key: seg.id,
                            text: seg.text,
                            lang: passage.language,
                          })
                    }
                    className="rounded-full border border-hairline px-3 py-1.5 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    {speech.activeKey === seg.id ? "Stop" : "Hear it"}
                  </button>
                  <button
                    onClick={() => revealLine(seg.id, i)}
                    className="rounded-full border border-hairline px-3 py-1.5 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    Reveal line →
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {allDone && (
        <p className="mt-8 text-center font-serif text-lg text-gold">
          The whole prayer, from memory. Well prayed.
        </p>
      )}
    </div>
  );
}

function MaskedLine({
  words,
  anchorSet,
  heardSet,
  done,
  onToggleWord,
}: {
  words: string[];
  anchorSet: Set<number>;
  heardSet: Set<number>;
  done: boolean;
  onToggleWord: (index: number) => void;
}) {
  return (
    <span>
      {words.map((word, i) => {
        const isAnchor = anchorSet.has(i);
        const isHeard = heardSet.has(i);
        const revealed = done || isAnchor || isHeard;
        const cls = [
          "recite-word",
          isAnchor ? "is-anchor" : "",
          !isAnchor && isHeard ? "is-heard" : "",
          revealed ? "" : "is-blank",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span key={i}>
            <button
              type="button"
              onClick={() => onToggleWord(i)}
              className={cls}
              aria-label={
                isAnchor
                  ? `${word} — anchor, tap to hide`
                  : revealed
                    ? `${word} — tap to make an anchor`
                    : "hidden word — tap to reveal as an anchor"
              }
            >
              {word}
            </button>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

function ReciteBubble({
  role,
  current,
  listening,
  children,
}: {
  role: SegmentRole;
  current: boolean;
  listening: boolean;
  children: React.ReactNode;
}) {
  const isCaller = role === "CALLER";
  const isResponder = role === "RESPONDER";
  // Recite keeps the page calm: lines read on parchment, role shown by a
  // colored edge rather than a full bubble so the blanks stay legible.
  let edge = "var(--hairline)";
  if (isCaller) edge = "var(--caller)";
  else if (isResponder) edge = "var(--responder)";

  return (
    <div
      className="px-4 py-2.5 font-serif text-lg leading-relaxed transition-shadow"
      style={{
        background: "var(--parchment-raised)",
        borderRadius: "14px",
        borderLeft: `3px solid ${edge}`,
        boxShadow: current ? "var(--bubble-shadow)" : "none",
        outline: current ? "2px solid var(--gold)" : "none",
        outlineOffset: "2px",
        opacity: current ? 1 : 0.72,
        animation: listening ? "pulse-glow 1.6s ease-in-out infinite" : "none",
      }}
    >
      {children}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5z" />
      <path d="M3.5 7.5a.5.5 0 0 1 1 0 3.5 3.5 0 0 0 7 0 .5.5 0 0 1 1 0 4.5 4.5 0 0 1-4 4.47V14a.5.5 0 0 1-1 0v-2.03a4.5 4.5 0 0 1-4-4.47z" />
    </svg>
  );
}
