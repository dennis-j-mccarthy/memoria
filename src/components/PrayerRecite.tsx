"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRecognition } from "@/lib/useRecognition";
import { useSpeech } from "@/lib/useSpeech";
import { matchSpoken, realWordIndices, toWords } from "@/lib/recite";
import { audioSrc, voiceForSegment, type VoiceId } from "@/lib/voice";
import type { PassageView, SegmentRole } from "@/lib/content";

interface Props {
  passage: PassageView;
  /** Anchor word indices per segment, owned by the parent and shared with Read. */
  anchors: Record<string, Set<number>>;
  onToggleAnchor: (segId: string, wordIndex: number) => void;
  voice: VoiceId;
}

/** Line-by-line (recite each line once) or build-up (snowball from the top). */
type Practice = "LINE" | "BUILDUP";

/** Share of a line's real words you must speak before it counts as recited. */
const PASS_THRESHOLD = 0.8;

function coverage(realIdx: number[], heard: Set<number>): number {
  if (realIdx.length === 0) return 1;
  let hit = 0;
  for (const i of realIdx) if (heard.has(i)) hit += 1;
  return hit / realIdx.length;
}

/**
 * Recite mode (active recall). Every line is blanked down to its gold anchors
 * and lights up as you speak it. Two practice styles:
 *   • Line by line — recite each line once, advancing down the prayer.
 *   • Build up — the snowball method: recite line 1, then lines 1–2 from the
 *     top, then 1–3, … adding a line each round until you have the whole thing.
 * Tap any word to toggle it as an anchor.
 */
export function PrayerRecite({
  passage,
  anchors,
  onToggleAnchor,
  voice,
}: Props) {
  const segments = passage.segments;
  const srcFor = (seg: { order: number; role: string }) =>
    audioSrc(passage.slug, seg.order, voiceForSegment(voice, passage.dialogic, seg.role));

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

  const [practice, setPractice] = useState<Practice>("LINE");
  const [target, setTarget] = useState(1); // lines in the current build-up round
  const [heard, setHeard] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(segments.map((s) => [s.id, new Set<number>()])),
  );
  const [done, setDone] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null); // segId, or "round"

  // Refs mirror state so the live recognition callback reads current values.
  const targetRef = useRef(target);
  const heardRef = useRef(heard);
  const doneRef = useRef(done);

  const { supported, listening, error, start, stop } = useRecognition();
  const speech = useSpeech();

  const freshHeard = useCallback(
    () => Object.fromEntries(segments.map((s) => [s.id, new Set<number>()])),
    [segments],
  );

  const clearProgress = useCallback(() => {
    const fh = freshHeard();
    heardRef.current = fh;
    setHeard(fh);
    doneRef.current = new Set();
    setDone(new Set());
    setCursor(0);
    setActiveId(null);
  }, [freshHeard]);

  // ---- Line-by-line ------------------------------------------------------
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

  const startLine = useCallback(
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

  // ---- Build-up (snowball) ----------------------------------------------
  const completeRound = useCallback(() => {
    const t = targetRef.current;
    if (t >= segments.length) {
      setCursor(segments.length); // whole prayer recited — allDone
      return;
    }
    const newTarget = t + 1;
    targetRef.current = newTarget;
    setTarget(newTarget);
    const fh = freshHeard();
    heardRef.current = fh;
    setHeard(fh);
    setCursor(0);
    setActiveId(null);
  }, [segments, freshHeard]);

  /** Listen continuously across the whole round, advancing line to line. */
  const startRound = useCallback(() => {
    const t = targetRef.current;
    const lines = Array.from({ length: t }, (_, i) => i);
    // Flatten the round's words and remember which line each came from.
    const combined: string[] = [];
    const origin: { li: number; segId: string }[] = [];
    for (const li of lines) {
      const segId = segments[li].id;
      for (const w of words[segId]) {
        combined.push(w);
        origin.push({ li, segId });
      }
    }
    const sessions = lines.map(
      (li) => new Set(heardRef.current[segments[li].id]),
    );
    setActiveId("round");
    start({
      lang: passage.language,
      onTranscript: (text) => {
        const matched = matchSpoken(combined, text);
        let changed = false;
        let ci = -1;
        for (const { li } of origin) {
          ci += 1;
          if (matched.has(ci)) {
            // Map the flat index back to that line's local word index.
            const local = origin
              .slice(0, ci + 1)
              .filter((o) => o.li === li).length - 1;
            if (!sessions[li].has(local)) {
              sessions[li].add(local);
              changed = true;
            }
          }
        }
        if (changed) {
          const next = { ...heardRef.current };
          lines.forEach((li) => {
            next[segments[li].id] = new Set(sessions[li]);
          });
          heardRef.current = next;
          setHeard(next);
        }
        const covered = (li: number) =>
          coverage(realIdx[segments[li].id], sessions[li]) >= PASS_THRESHOLD;
        const firstOpen = lines.find((li) => !covered(li));
        setCursor(firstOpen ?? t);
        if (firstOpen === undefined) {
          stop();
          completeRound();
        }
      },
      onEnd: () => setActiveId(null),
    });
  }, [segments, words, realIdx, start, stop, passage.language, completeRound]);

  const revealRound = useCallback(() => {
    stop();
    const t = targetRef.current;
    const lines = Array.from({ length: t }, (_, i) => i);
    const next = { ...heardRef.current };
    lines.forEach((li) => {
      const segId = segments[li].id;
      next[segId] = new Set(words[segId].map((_, i) => i));
    });
    heardRef.current = next;
    setHeard(next);
    completeRound();
  }, [segments, words, stop, completeRound]);

  // ---- Shared controls ---------------------------------------------------
  const revealLine = useCallback(
    (segId: string, index: number) => {
      if (activeId === segId) stop();
      completeSegment(segId, index);
    },
    [activeId, stop, completeSegment],
  );

  const setMode = useCallback(
    (p: Practice) => {
      stop();
      speech.stop();
      setPractice(p);
      targetRef.current = 1;
      setTarget(1);
      clearProgress();
    },
    [stop, speech, clearProgress],
  );

  const reset = useCallback(() => {
    stop();
    speech.stop();
    targetRef.current = 1;
    setTarget(1);
    clearProgress();
  }, [stop, speech, clearProgress]);

  const isBuildup = practice === "BUILDUP";
  const visibleCount = isBuildup ? target : segments.length;
  const allDone = cursor >= segments.length;
  const remaining = segments.length - target;

  const progress = isBuildup
    ? allDone
      ? 1
      : (target - 1) / segments.length
    : done.size / segments.length;

  function speakRound() {
    const t = targetRef.current;
    const items = Array.from({ length: t }, (_, li) => ({
      key: segments[li].id,
      text: segments[li].text,
      lang: passage.language,
      src: srcFor(segments[li]),
    }));
    speech.speakAll(items);
  }

  const roundListening = activeId === "round" && listening;

  return (
    <div>
      {/* Practice style */}
      <div
        className="mb-5 inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
        role="group"
        aria-label="Practice style"
      >
        {(
          [
            ["LINE", "Line by line"],
            ["BUILDUP", "Build up"],
          ] as [Practice, string][]
        ).map(([p, label]) => (
          <button
            key={p}
            onClick={() => setMode(p)}
            aria-pressed={practice === p}
            className={`rounded-full px-3 py-1 font-sans text-sm transition-colors ${
              practice === p
                ? "bg-ink text-parchment-raised"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="font-sans text-sm text-ink-faint">
            {isBuildup
              ? allDone
                ? `All ${segments.length} lines`
                : `Round ${target} of ${segments.length}`
              : `${done.size} / ${segments.length} recited`}
          </span>
        </div>
        {(isBuildup ? target > 1 || done.size > 0 : done.size > 0) && (
          <button
            onClick={reset}
            className="rounded-full border border-hairline px-3 py-1 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            ↺ Start over
          </button>
        )}
      </div>

      <p className="mb-5 font-sans text-xs text-ink-faint">
        {isBuildup
          ? "Recite from the top — a line is added each round until you have the whole prayer."
          : "Tap any word to reveal it as an anchor · tap again to hide it"}
      </p>

      {!supported && (
        <p className="mb-5 rounded-xl border border-hairline bg-parchment-raised px-4 py-3 font-sans text-sm text-ink-soft">
          Voice recognition isn&apos;t available in this browser, but you can
          still practice: tap a blank to reveal it, or use <em>Reveal</em> to
          move on.
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-xl border border-hairline bg-parchment-raised px-4 py-3 font-sans text-sm text-ink-soft">
          Microphone error: {error}. Check mic permissions and try again.
        </p>
      )}

      <ol className="space-y-2.5">
        {segments.map((seg, i) => {
          if (i >= visibleCount) return null;
          const isDone = done.has(seg.id);
          const isCurrent = i === cursor && !allDone;
          const isListening = isBuildup
            ? roundListening && isCurrent
            : activeId === seg.id && listening;
          return (
            <li key={seg.id}>
              <ReciteBubble
                role={seg.role}
                current={isCurrent}
                listening={isListening}
              >
                <MaskedLine
                  words={words[seg.id]}
                  anchorSet={anchors[seg.id] ?? new Set()}
                  heardSet={heard[seg.id]}
                  done={isDone}
                  onToggleWord={(idx) => onToggleAnchor(seg.id, idx)}
                />
              </ReciteBubble>

              {/* Line-by-line controls live under the active line. */}
              {!isBuildup && isCurrent && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {supported && (
                    <button
                      onClick={() =>
                        isListening ? stop() : startLine(seg.id, i)
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
                            src: srcFor(seg),
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

      {/* Build-up controls act on the whole round. */}
      {isBuildup && !allDone && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {supported && (
            <button
              onClick={() => (roundListening ? stop() : startRound())}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors ${
                roundListening
                  ? "bg-gold text-parchment-raised"
                  : "bg-ink text-parchment-raised hover:opacity-90"
              }`}
            >
              <MicIcon />
              {roundListening
                ? "Listening… tap to stop"
                : target === 1
                  ? "Recite line 1"
                  : `Recite lines 1–${target}`}
            </button>
          )}
          <button
            onClick={() => (speech.playingAll ? speech.stop() : speakRound())}
            className="rounded-full border border-hairline px-3 py-1.5 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            {speech.playingAll ? "Stop" : "Hear it"}
          </button>
          <button
            onClick={revealRound}
            className="rounded-full border border-hairline px-3 py-1.5 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            Reveal &amp; advance →
          </button>
          {remaining > 0 && (
            <span className="font-sans text-xs text-ink-faint">
              {remaining} more line{remaining === 1 ? "" : "s"} to come
            </span>
          )}
        </div>
      )}

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
