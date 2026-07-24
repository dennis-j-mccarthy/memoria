"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRecognition } from "@/lib/useRecognition";
import { useSpeech } from "@/lib/useSpeech";
import { matchSpoken, realWordIndices, toWords } from "@/lib/recite";
import { Icon, PlayGlyph, PauseGlyph } from "@/components/immersive/Icon";
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

function CheckBadge() {
  return (
    <span
      role="img"
      aria-label="Line memorized"
      title="Memorized"
      style={{
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 999,
        background: "var(--check)",
        boxShadow: "0 0 0 3px var(--check-glow)",
        animation: "check-pop .35s ease-out both",
      }}
    >
      <Icon name="check" size={15} color="#fff" />
    </span>
  );
}

// A small round control that lives beside the active line (recite / hear / reveal).
function CtlBtn({
  label,
  onClick,
  children,
  primary,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flex: "0 0 auto",
        background: primary ? "var(--play-grad)" : "var(--chip-bg)",
        border: primary ? "none" : "1px solid var(--chip-bd)",
        boxShadow: primary ? "var(--play-glow)" : "none",
        animation: active ? "pulse-glow 1.6s ease-in-out infinite" : "none",
      }}
    >
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
  mode,
  onRead,
}: {
  prayer: ImmersivePrayer;
  anchorsOn: boolean;
  mode: "line" | "buildup";
  onRead?: () => void;
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

  const [target, setTarget] = useState(1);
  const [heard, setHeard] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, new Set<number>()])),
  );
  const [done, setDone] = useState<Set<string>>(new Set());
  // Lines cleared by voice (≥ PASS) — these earn the green check. Distinct from
  // `done`, which also includes lines you gave up on via Reveal.
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Footer voice (Male / Female / Both) — mirrors the reading dock.
  const [voice, setVoice] = useState<"onyx" | "shimmer" | "both">("both");

  const heardRef = useRef(heard);
  const doneRef = useRef(done);
  const passedRef = useRef(passed);
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
  const markPassed = useCallback((id: string) => {
    if (passedRef.current.has(id)) return;
    const np = new Set(passedRef.current);
    np.add(id);
    passedRef.current = np;
    setPassed(np);
  }, []);
  const completeLine = useCallback(
    (id: string, index: number, viaVoice: boolean) => {
      if (viaVoice) markPassed(id);
      if (doneRef.current.has(id)) return;
      const nd = new Set(doneRef.current);
      nd.add(id);
      doneRef.current = nd;
      setDone(nd);
      advance(index, nd);
    },
    [advance, markPassed],
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
            completeLine(id, index, true);
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
        idxs.forEach((li) => {
          if (covered(li)) markPassed(lines[li].id);
        });
        const open = idxs.find((li) => !covered(li));
        setCursor(open ?? t);
        if (open === undefined) {
          stop();
          completeRound();
        }
      },
      onEnd: () => setActiveId(null),
    });
  }, [lines, words, realIdx, start, stop, prayer.language, completeRound, markPassed]);

  const revealLine = useCallback(
    (id: string, index: number) => {
      if (activeId === id) stop();
      completeLine(id, index, false);
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
    passedRef.current = new Set();
    setPassed(new Set());
    setCursor(0);
    setActiveId(null);
  }, [stop, speech, freshHeard]);

  const isBuildup = mode === "buildup";
  const visibleCount = isBuildup ? target : lines.length;
  const allDone = cursor >= lines.length;
  const roundListening = activeId === "round" && listening;

  const voiceFor = (role: "L" | "R"): "onyx" | "shimmer" =>
    voice === "both" ? (role === "R" ? "shimmer" : "onyx") : voice;
  const itemFor = (l: (typeof lines)[number]) => ({
    key: l.id,
    text: "",
    lang: prayer.language,
    src: audioSrc(prayer.slug, l.order, voiceFor(l.role)),
  });

  function speakLine(id: string, order: number, role: "L" | "R") {
    if (speech.activeKey === id) speech.stop();
    else speech.speak({ key: id, text: "", lang: prayer.language, src: audioSrc(prayer.slug, order, voiceFor(role)) });
  }
  function speakRound() {
    if (speech.playingAll) {
      speech.stop();
      return;
    }
    speech.speakAll(lines.slice(0, targetRef.current).map(itemFor));
  }
  // Footer "Play" — hears the whole prayer, through the same engine as the
  // per-line Hear, so the two never talk over each other.
  function togglePlayAll() {
    if (speech.playingAll) speech.stop();
    else speech.speakAll(lines.map(itemFor));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: 110 }}>
      {/* progress (mode is chosen from the shared header above) */}
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <span style={{ fontSize: 12, color: passed.size > 0 && !isBuildup ? "var(--check)" : "var(--ink-faint)", fontWeight: passed.size > 0 && !isBuildup ? 700 : 400 }}>
          {isBuildup
            ? allDone ? "Whole prayer" : `Round ${target} / ${lines.length}`
            : `✓ ${passed.size} / ${lines.length}`}
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
          const isPassed = passed.has(ln.id);
          const isCur = i === cursor && !allDone;
          const isListening = isBuildup ? roundListening && isCur : activeId === ln.id && listening;
          const ws = words[ln.id];
          const heardSet = heard[ln.id] ?? new Set<number>();
          const bg = isCur ? (isR ? "var(--resp-act-bg)" : "var(--act-bg)") : isR ? "var(--resp-bubble)" : "var(--leader-bubble)";
          const bd = isCur ? (isR ? "var(--resp-act-bd)" : "var(--act-bd)") : isR ? "var(--resp-bd)" : "var(--leader-bd)";
          // The recite / hear / reveal controls ride on the active line itself,
          // as a small column just outside the bubble.
          const ctl = isCur ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: "0 0 auto" }}>
              {supported && (
                <CtlBtn
                  label={isListening ? "Stop" : "Recite this line"}
                  primary
                  active={isListening}
                  onClick={() => {
                    if (isBuildup) {
                      if (roundListening) stop();
                      else startRound();
                    } else {
                      if (activeId === ln.id && listening) stop();
                      else startLine(ln.id, i);
                    }
                  }}
                >
                  <Icon name="mic" size={15} color="var(--gold-text)" />
                </CtlBtn>
              )}
              <CtlBtn label="Hear" onClick={() => (isBuildup ? speakRound() : speakLine(ln.id, ln.order, ln.role))}>
                <PlayGlyph color="var(--ink-soft)" size={10} />
              </CtlBtn>
              <CtlBtn label="Reveal" onClick={() => (isBuildup ? revealRound() : revealLine(ln.id, i))}>
                <Icon name="eye" size={15} color="var(--ink-soft)" />
              </CtlBtn>
            </div>
          ) : isPassed ? (
            <CheckBadge />
          ) : (
            <div style={{ width: 30, flex: "0 0 auto" }} aria-hidden />
          );
          return (
            <div key={ln.id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: isR ? "flex-end" : "flex-start" }}>
              {ctl}
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
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: 22, color: "var(--gold)" }}>
            The whole prayer, from memory.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 14, background: "var(--play-grad)", color: "var(--gold-text)", borderRadius: 999, padding: "11px 24px", fontWeight: 600, fontSize: 14, border: "none", boxShadow: "var(--play-glow)", cursor: "pointer" }}
          >
            Practice again
          </button>
        </div>
      )}

      {/* Footer — the reading dock, exactly: progress, then Voices · Play · Read.
          The recite / hear / reveal verbs now live on the active line above. */}
      {!allDone && (
        <div style={{ position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", width: "min(500px, calc(100vw - 28px))", zIndex: 40 }}>
          <div style={{ borderRadius: 26, padding: "14px 16px 15px", background: "var(--glass-strong)", border: "1px solid var(--glass-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", boxShadow: "0 16px 38px rgba(0,0,0,.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>✓ {passed.size}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--track)", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${lines.length ? (passed.size / lines.length) * 100 : 0}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-soft))", borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>{lines.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}>
              <div style={{ display: "inline-flex", background: "var(--chip-bg)", border: "1px solid var(--chip-bd)", borderRadius: 999, padding: 3, gap: 2 }}>
                {[
                  { id: "onyx" as const, label: "Male", icon: "male" },
                  { id: "shimmer" as const, label: "Female", icon: "female" },
                  { id: "both" as const, label: "Both", icon: "both" },
                ].map((v) => {
                  const on = voice === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVoice(v.id)}
                      aria-label={v.label}
                      title={v.label}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 30, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--gold)" : "transparent", color: on ? "#fff" : "var(--ink-soft)" }}
                    >
                      <Icon name={v.icon} size={17} color={on ? "#fff" : "var(--ink-soft)"} />
                    </button>
                  );
                })}
              </div>
              <button onClick={togglePlayAll} aria-label={speech.playingAll ? "Pause" : "Play whole prayer"} style={{ width: 64, height: 64, borderRadius: 999, background: "var(--play-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--play-glow)", border: "none", cursor: "pointer" }}>
                {speech.playingAll ? <PauseGlyph color="var(--gold-text)" size={18} /> : <PlayGlyph color="var(--gold-text)" size={20} />}
              </button>
              <button onClick={() => onRead?.()} aria-label="Back to reading" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--chip-bg)", borderRadius: 999, padding: "6px 12px", border: "1px solid var(--chip-bd)", cursor: "pointer" }}>
                <Icon name="chevleft" size={14} color="var(--gold)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--gold)" }}>Read</span>
              </button>
            </div>
            {(done.size > 0 || target > 1) && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <button onClick={reset} style={{ fontSize: 12, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer" }}>
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
