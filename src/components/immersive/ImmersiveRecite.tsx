"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRecognition } from "@/lib/useRecognition";
import { useSpeech } from "@/lib/useSpeech";
import { matchSpoken, realWordIndices, toWords } from "@/lib/recite";
import { Icon, PlayGlyph } from "@/components/immersive/Icon";
import { audioSrc } from "@/lib/voice";
import type { ImmersivePrayer } from "@/lib/immersive";

const SERIF = "var(--font-serif), Georgia, serif";
const PASS = 0.8;

function coverage(realIdx: number[], heard: Set<number>): number {
  if (realIdx.length === 0) return 1;
  let hit = 0;
  for (const i of realIdx) if (heard.has(i)) hit += 1;
  return hit / realIdx.length;
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{ borderRadius: 999, padding: "5px 13px", fontSize: 13, fontWeight: 600, color: active ? "var(--gold-text)" : "var(--ink-soft)", background: active ? "var(--gold)" : "transparent", border: "none" }}
    >
      {label}
    </button>
  );
}

function DockBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ color: "var(--ink)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: "9px 13px", fontSize: 13, fontWeight: 600, background: "var(--chip-bg)" }}>
      {children}
    </button>
  );
}

/**
 * Recite, native to the immersive look: call-and-response bubbles where every
 * line is blanked to its gold anchors and lights up as you speak it. Line by
 * line, or Build up (snowball). Reuses the recite lib + speech recognition.
 */
export function ImmersiveRecite({
  prayer,
  anchorsOn,
}: {
  prayer: ImmersivePrayer;
  anchorsOn: boolean;
}) {
  const lines = prayer.lines;
  const words = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.id, toWords(l.text)])),
    [lines],
  );
  const realIdx = useMemo(
    () => Object.fromEntries(lines.map((l) => [l.id, realWordIndices(words[l.id])])),
    [lines, words],
  );
  const anchorsOf = useCallback(
    (id: string, idx: number) =>
      anchorsOn && (prayer.lines.find((l) => l.id === id)?.anchors.includes(idx) ?? false),
    [anchorsOn, prayer.lines],
  );

  const [practice, setPractice] = useState<"line" | "buildup">("line");
  const [target, setTarget] = useState(1);
  const [heard, setHeard] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, new Set<number>()])),
  );
  const [done, setDone] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const heardRef = useRef(heard);
  const doneRef = useRef(done);
  const targetRef = useRef(target);

  const { supported, listening, error, start, stop } = useRecognition();
  const speech = useSpeech();

  const freshHeard = useCallback(
    () => Object.fromEntries(lines.map((l) => [l.id, new Set<number>()])),
    [lines],
  );

  // ---- line by line ------------------------------------------------------
  const advance = useCallback(
    (from: number, doneSet: Set<string>) => {
      let next = from + 1;
      while (next < lines.length && doneSet.has(lines[next].id)) next += 1;
      setCursor(next);
    },
    [lines],
  );
  const completeLine = useCallback(
    (id: string, index: number) => {
      if (doneRef.current.has(id)) return;
      const nd = new Set(doneRef.current);
      nd.add(id);
      doneRef.current = nd;
      setDone(nd);
      advance(index, nd);
    },
    [advance],
  );
  const startLine = useCallback(
    (id: string, index: number) => {
      const w = words[id];
      const real = realIdx[id];
      const session = new Set(heardRef.current[id] ?? []);
      setActiveId(id);
      start({
        lang: prayer.language,
        onTranscript: (text) => {
          const matched = matchSpoken(w, text);
          let changed = false;
          matched.forEach((i) => {
            if (!session.has(i)) {
              session.add(i);
              changed = true;
            }
          });
          if (changed) {
            const upd = new Set(session);
            heardRef.current = { ...heardRef.current, [id]: upd };
            setHeard((p) => ({ ...p, [id]: upd }));
          }
          if (coverage(real, session) >= PASS) {
            stop();
            completeLine(id, index);
          }
        },
        onEnd: () => setActiveId(null),
      });
    },
    [words, realIdx, start, stop, prayer.language, completeLine],
  );

  // ---- build up ----------------------------------------------------------
  const completeRound = useCallback(() => {
    const t = targetRef.current;
    if (t >= lines.length) {
      setCursor(lines.length);
      return;
    }
    const nt = t + 1;
    targetRef.current = nt;
    setTarget(nt);
    const fh = freshHeard();
    heardRef.current = fh;
    setHeard(fh);
    setCursor(0);
    setActiveId(null);
  }, [lines, freshHeard]);

  const startRound = useCallback(() => {
    const t = targetRef.current;
    const idxs = Array.from({ length: t }, (_, i) => i);
    const combined: string[] = [];
    const origin: number[] = [];
    idxs.forEach((li) => {
      words[lines[li].id].forEach((w) => {
        combined.push(w);
        origin.push(li);
      });
    });
    const sessions = idxs.map((li) => new Set(heardRef.current[lines[li].id]));
    setActiveId("round");
    start({
      lang: prayer.language,
      onTranscript: (text) => {
        const matched = matchSpoken(combined, text);
        let changed = false;
        for (let ci = 0; ci < origin.length; ci += 1) {
          if (matched.has(ci)) {
            const li = origin[ci];
            const local =
              origin.slice(0, ci + 1).filter((o) => o === li).length - 1;
            if (!sessions[li].has(local)) {
              sessions[li].add(local);
              changed = true;
            }
          }
        }
        if (changed) {
          const next = { ...heardRef.current };
          idxs.forEach((li) => {
            next[lines[li].id] = new Set(sessions[li]);
          });
          heardRef.current = next;
          setHeard(next);
        }
        const covered = (li: number) =>
          coverage(realIdx[lines[li].id], sessions[li]) >= PASS;
        const open = idxs.find((li) => !covered(li));
        setCursor(open ?? t);
        if (open === undefined) {
          stop();
          completeRound();
        }
      },
      onEnd: () => setActiveId(null),
    });
  }, [lines, words, realIdx, start, stop, prayer.language, completeRound]);

  const revealLine = useCallback(
    (id: string, index: number) => {
      if (activeId === id) stop();
      completeLine(id, index);
    },
    [activeId, stop, completeLine],
  );
  const revealRound = useCallback(() => {
    stop();
    const t = targetRef.current;
    const next = { ...heardRef.current };
    Array.from({ length: t }, (_, li) => li).forEach((li) => {
      const id = lines[li].id;
      next[id] = new Set(words[id].map((_, i) => i));
    });
    heardRef.current = next;
    setHeard(next);
    completeRound();
  }, [lines, words, stop, completeRound]);

  const reset = useCallback(() => {
    stop();
    speech.stop();
    targetRef.current = 1;
    setTarget(1);
    const fh = freshHeard();
    heardRef.current = fh;
    setHeard(fh);
    doneRef.current = new Set();
    setDone(new Set());
    setCursor(0);
    setActiveId(null);
  }, [stop, speech, freshHeard]);

  const setMode = useCallback(
    (m: "line" | "buildup") => {
      stop();
      speech.stop();
      setPractice(m);
      targetRef.current = 1;
      setTarget(1);
      const fh = freshHeard();
      heardRef.current = fh;
      setHeard(fh);
      doneRef.current = new Set();
      setDone(new Set());
      setCursor(0);
      setActiveId(null);
    },
    [stop, speech, freshHeard],
  );

  const isBuildup = practice === "buildup";
  const visibleCount = isBuildup ? target : lines.length;
  const allDone = cursor >= lines.length;
  const roundListening = activeId === "round" && listening;

  function speakLine(id: string, order: number, role: "L" | "R") {
    if (speech.activeKey === id) speech.stop();
    else speech.speak({ key: id, text: "", lang: prayer.language, src: audioSrc(prayer.slug, order, role === "R" ? "shimmer" : "onyx") });
  }
  function speakRound() {
    if (speech.playingAll) {
      speech.stop();
      return;
    }
    const items = Array.from({ length: targetRef.current }, (_, li) => ({
      key: lines[li].id,
      text: "",
      lang: prayer.language,
      src: audioSrc(prayer.slug, lines[li].order, lines[li].role === "R" ? "shimmer" : "onyx"),
    }));
    speech.speakAll(items);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* practice style + progress */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <div style={{ display: "inline-flex", borderRadius: 999, border: "1px solid var(--glass-border)", background: "var(--glass)", padding: 3 }}>
          <Pill active={!isBuildup} onClick={() => setMode("line")} label="Line by line" />
          <Pill active={isBuildup} onClick={() => setMode("buildup")} label="Build up" />
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          {isBuildup ? (allDone ? "Whole prayer" : `Round ${target} / ${lines.length}`) : `${done.size} / ${lines.length}`}
        </span>
      </div>

      {!supported && (
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)" }}>
          Voice isn’t available in this browser — tap a blank to reveal it, or use Reveal.
        </p>
      )}
      {error && (
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)" }}>Mic error: {error}.</p>
      )}

      {/* bubbles */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((ln, i) => {
          if (i >= visibleCount) return null;
          const isR = ln.role === "R";
          const isDone = done.has(ln.id);
          const isCur = i === cursor && !allDone;
          const isListening = isBuildup ? roundListening && isCur : activeId === ln.id && listening;
          const ws = words[ln.id];
          const heardSet = heard[ln.id] ?? new Set<number>();
          const bg = isCur ? (isR ? "var(--resp-act-bg)" : "var(--act-bg)") : isR ? "var(--resp-bubble)" : "var(--leader-bubble)";
          const bd = isCur ? (isR ? "var(--resp-act-bd)" : "var(--act-bd)") : isR ? "var(--resp-bd)" : "var(--leader-bd)";
          return (
            <div key={ln.id} style={{ display: "flex", justifyContent: isR ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "86%",
                  padding: isCur ? "12px 17px" : "9px 15px",
                  borderRadius: isR ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                  background: bg,
                  border: "1px solid " + bd,
                  fontFamily: SERIF,
                  fontSize: isCur ? 20 : 18,
                  lineHeight: 1.4,
                  color: isCur ? "var(--act-ink)" : "var(--ink-soft)",
                  boxShadow: isCur ? (isR ? "var(--resp-act-glow)" : "var(--act-glow)") : "none",
                  textAlign: isR ? "right" : "left",
                  opacity: isCur || isDone ? 1 : 0.85,
                  transition: "all .25s",
                  animation: isListening ? "pulse-glow 1.6s ease-in-out infinite" : "none",
                }}
              >
                {ws.map((w, wi) => {
                  const isAnchor = anchorsOf(ln.id, wi);
                  const isHeardW = heardSet.has(wi);
                  const revealed = isDone || isAnchor || isHeardW;
                  if (revealed) {
                    return (
                      <span
                        key={wi}
                        onClick={() => setHeard((p) => ({ ...p, [ln.id]: new Set([...(p[ln.id] ?? []), wi]) }))}
                        style={{ color: isAnchor ? "var(--gold)" : "inherit", fontStyle: isAnchor ? "italic" : "normal", fontWeight: isAnchor ? 600 : 400, cursor: "pointer" }}
                      >
                        {w}{" "}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={wi}
                      onClick={() => setHeard((p) => ({ ...p, [ln.id]: new Set([...(p[ln.id] ?? []), wi]) }))}
                      style={{ color: "transparent", borderBottom: "2px dashed rgba(127,127,127,.5)", borderRadius: 3, cursor: "pointer" }}
                    >
                      {w}{" "}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <p style={{ marginTop: 22, textAlign: "center", fontFamily: SERIF, fontSize: 22, color: "var(--gold)" }}>
          The whole prayer, from memory.
        </p>
      )}

      {/* dock */}
      {!allDone && (
        <div style={{ position: "sticky", bottom: 14, marginTop: "auto", paddingTop: 18, zIndex: 30 }}>
          <div style={{ borderRadius: 22, padding: 14, background: "var(--glass-strong)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", boxShadow: "0 16px 38px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              {supported && (
                <button
                  onClick={() => {
                    if (isBuildup) {
                      if (roundListening) stop();
                      else startRound();
                    } else {
                      const ln = lines[cursor];
                      if (!ln) return;
                      if (activeId === ln.id && listening) stop();
                      else startLine(ln.id, cursor);
                    }
                  }}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, padding: "11px 14px", fontSize: 14, fontWeight: 700, color: "var(--gold-text)", background: "var(--play-grad)", border: "none", boxShadow: "var(--play-glow)" }}
                >
                  <Icon name="voices" size={16} color="var(--gold-text)" />
                  {(isBuildup ? roundListening : activeId === lines[cursor]?.id && listening)
                    ? "Listening…"
                    : isBuildup
                      ? target === 1 ? "Recite line 1" : `Recite lines 1–${target}`
                      : "Recite this line"}
                </button>
              )}
              <DockBtn onClick={() => (isBuildup ? speakRound() : speakLine(lines[cursor].id, lines[cursor].order, lines[cursor].role))}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><PlayGlyph color="var(--ink)" size={11} /> Hear</span></DockBtn>
              <DockBtn onClick={() => (isBuildup ? revealRound() : revealLine(lines[cursor].id, cursor))}>Reveal</DockBtn>
            </div>
            {(done.size > 0 || target > 1) && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button onClick={reset} style={{ fontSize: 12.5, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer" }}>
                  ↺ Start over
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
