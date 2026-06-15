"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConnectiveText } from "@/components/ConnectiveText";
import { PrayerRecite } from "@/components/PrayerRecite";
import { useSpeech } from "@/lib/useSpeech";
import { useAuth } from "@/lib/useAuth";
import {
  audioSrc,
  voiceForSegment,
  VOICES,
  DEFAULT_VOICE,
  type VoiceId,
} from "@/lib/voice";
import type { PassageView, SegmentRole, SegmentView } from "@/lib/content";

type Perspective = "CALLER" | "RESPONDER" | "BOTH";
type Mode = "READ" | "RECITE" | "ICONS";
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  passage: PassageView;
}

/** Anchor overrides to persist: only segments edited away from their default. */
function buildOverrides(
  segments: SegmentView[],
  anchors: Record<string, Set<number>>,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const s of segments) {
    const cur = anchors[s.id];
    if (!cur) continue;
    const orig = s.connectiveIndices;
    const changed =
      cur.size !== orig.length || orig.some((i) => !cur.has(i));
    if (changed) out[s.id] = [...cur].sort((a, b) => a - b);
  }
  return out;
}

/**
 * Renders a passage as an iMessage-style conversation (spec section 2).
 * Caller (V.) = blue, Responder (R.) = green, single-voice = neutral. The
 * reader can adopt a role; their own lines align right as "outgoing" bubbles.
 * Every line can be heard, plus the whole prayer read aloud in sequence.
 */
export function PrayerChat({ passage }: Props) {
  const [mode, setMode] = useState<Mode>("READ");
  const [perspective, setPerspective] = useState<Perspective>("BOTH");
  const [highlight, setHighlight] = useState(true);
  const [editAnchors, setEditAnchors] = useState(false);
  const { supported, activeKey, playingAll, speak, speakAll, stop } =
    useSpeech();

  // Narration voice, persisted across prayers. The chosen voice "leads";
  // in call-and-response prayers the Responder lines use the other voice.
  const [voice, setVoice] = useState<VoiceId>(DEFAULT_VOICE);
  useEffect(() => {
    const v = localStorage.getItem("memoria-voice");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time pref load
    if (v === "onyx" || v === "shimmer") setVoice(v);
  }, []);
  const changeVoice = useCallback((v: VoiceId) => {
    stop();
    setVoice(v);
    try {
      localStorage.setItem("memoria-voice", v);
    } catch {}
  }, [stop]);
  const srcFor = useCallback(
    (seg: SegmentView) =>
      audioSrc(
        passage.slug,
        seg.order,
        voiceForSegment(voice, passage.dialogic, seg.role),
      ),
    [passage.slug, passage.dialogic, voice],
  );

  // Which words are anchors, per segment — seeded from the curated connective
  // words but editable, and shared between Read and Recite so a change in one
  // shows up in the other. Lives here, the common parent of both views.
  const [anchors, setAnchors] = useState<Record<string, Set<number>>>(() =>
    Object.fromEntries(
      passage.segments.map((s) => [s.id, new Set(s.connectiveIndices)]),
    ),
  );

  const { user } = useAuth();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Mirror anchors into a ref so the debounced save reads the latest value.
  const anchorsRef = useRef(anchors);
  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);

  // Load this user's saved overrides once (returns {} for signed-out readers).
  useEffect(() => {
    let active = true;
    fetch(`/api/passages/${passage.slug}/anchors`)
      .then((r) => r.json())
      .then((d) => {
        const ov = d?.overrides as Record<string, number[]> | undefined;
        if (!active || !ov || Object.keys(ov).length === 0) return;
        setAnchors((prev) => {
          const next = { ...prev };
          for (const [segId, idxs] of Object.entries(ov)) {
            if (next[segId]) next[segId] = new Set(idxs);
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [passage.slug]);

  // Debounced save of the override diff. Anonymous edits stay in-session (the
  // sign-in nudge handles messaging); only signed-in changes hit the API.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!user) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/passages/${passage.slug}/anchors`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overrides: buildOverrides(passage.segments, anchorsRef.current),
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 600);
  }, [user, passage.slug, passage.segments]);

  const toggleAnchor = useCallback(
    (segId: string, wordIndex: number) => {
      setAnchors((prev) => {
        const set = new Set(prev[segId]);
        if (set.has(wordIndex)) set.delete(wordIndex);
        else set.add(wordIndex);
        return { ...prev, [segId]: set };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const resetAnchors = useCallback(() => {
    setAnchors(
      Object.fromEntries(
        passage.segments.map((s) => [s.id, new Set(s.connectiveIndices)]),
      ),
    );
    scheduleSave();
  }, [passage.segments, scheduleSave]);

  const anchorsEdited = passage.segments.some((s) => {
    const cur = anchors[s.id];
    if (!cur) return false;
    const orig = s.connectiveIndices;
    return cur.size !== orig.length || orig.some((i) => !cur.has(i));
  });

  function isOutgoing(role: SegmentRole): boolean {
    if (perspective === "BOTH") return role === "RESPONDER";
    return role === perspective;
  }

  const speechItems = passage.segments.map((s) => ({
    key: s.id,
    text: s.text,
    lang: passage.language,
    src: srcFor(s),
  }));

  return (
    <div>
      {/* Read / Recite mode */}
      <div
        className="mb-6 inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
        role="group"
        aria-label="Choose a mode"
      >
        {(["READ", "RECITE", "ICONS"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-full px-4 py-1 font-sans text-sm transition-colors ${
              mode === m
                ? "bg-ink text-parchment-raised"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "READ" ? "Read" : m === "RECITE" ? "Recite" : "Icons"}
          </button>
        ))}
      </div>

      {/* Narration voice */}
      <div
        className="mb-6 ml-2 inline-flex items-center gap-2 align-top"
        role="group"
        aria-label="Narration voice"
      >
        <span className="font-sans text-xs text-ink-faint">Voice</span>
        <div className="inline-flex rounded-full border border-hairline bg-parchment-raised p-1">
          {VOICES.map((v) => (
            <button
              key={v.id}
              onClick={() => changeVoice(v.id)}
              aria-pressed={voice === v.id}
              className={`rounded-full px-3 py-1 font-sans text-sm transition-colors ${
                voice === v.id
                  ? "bg-ink text-parchment-raised"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "RECITE" || mode === "ICONS" ? (
        <PrayerRecite
          passage={passage}
          anchors={anchors}
          onToggleAnchor={toggleAnchor}
          voice={voice}
          hintStyle={mode === "ICONS" ? "icons" : "anchors"}
        />
      ) : (
        <>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {supported && (
          <button
            onClick={() => (playingAll ? stop() : speakAll(speechItems))}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-sans text-sm font-medium transition-colors ${
              playingAll
                ? "bg-gold text-parchment-raised"
                : "bg-ink text-parchment-raised hover:opacity-90"
            }`}
          >
            {playingAll ? (
              <>
                <StopIcon /> Stop
              </>
            ) : (
              <>
                <PlayIcon /> Hear the prayer
              </>
            )}
          </button>
        )}

        {passage.dialogic && (
          <div
            className="inline-flex rounded-full border border-hairline bg-parchment-raised p-1"
            role="group"
            aria-label="Choose your role"
          >
            {(["CALLER", "RESPONDER", "BOTH"] as Perspective[]).map((r) => (
              <button
                key={r}
                onClick={() => setPerspective(r)}
                className={`rounded-full px-3 py-1 font-sans text-sm transition-colors ${
                  perspective === r
                    ? "bg-ink text-parchment-raised"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {r === "CALLER"
                  ? "Caller (V.)"
                  : r === "RESPONDER"
                    ? "Responder (R.)"
                    : "Both"}
              </button>
            ))}
          </div>
        )}

        {passage.dialogic && perspective !== "BOTH" && (
          <button
            onClick={() =>
              setPerspective(perspective === "CALLER" ? "RESPONDER" : "CALLER")
            }
            className="rounded-full border border-hairline px-3 py-1 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            ⇄ Flip sides
          </button>
        )}

        <button
          onClick={() => setHighlight((h) => !h)}
          aria-pressed={highlight}
          className={`rounded-full border px-3 py-1 font-sans text-sm transition-colors ${
            highlight
              ? "border-gold/40 text-gold"
              : "border-hairline text-ink-soft hover:text-ink"
          }`}
        >
          {highlight ? "Anchors on" : "Anchors off"}
        </button>

        {highlight && (
          <button
            onClick={() => setEditAnchors((e) => !e)}
            aria-pressed={editAnchors}
            className={`rounded-full border px-3 py-1 font-sans text-sm transition-colors ${
              editAnchors
                ? "border-gold bg-gold/10 text-gold"
                : "border-hairline text-ink-soft hover:text-ink"
            }`}
          >
            {editAnchors ? "Done editing" : "Edit anchors"}
          </button>
        )}

        {editAnchors && anchorsEdited && (
          <button
            onClick={resetAnchors}
            className="rounded-full border border-hairline px-3 py-1 font-sans text-sm text-ink-soft transition-colors hover:border-gold/40 hover:text-gold"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {editAnchors && (
        <p className="-mt-3 mb-5 font-sans text-xs text-ink-faint">
          Tap a word to add or remove it as a gold anchor. Your changes carry
          into Recite mode.{" "}
          {user ? (
            <span className="text-ink-soft">
              {saveStatus === "saving"
                ? "· Saving…"
                : saveStatus === "saved"
                  ? "· Saved"
                  : saveStatus === "error"
                    ? "· Couldn’t save — check your connection"
                    : ""}
            </span>
          ) : (
            <Link
              href={`/signin?redirect=/prayers/${passage.slug}`}
              className="text-gold underline-offset-2 hover:underline"
            >
              Sign in to save them across devices.
            </Link>
          )}
        </p>
      )}

      {/* Conversation */}
      <ol className="space-y-2.5">
        {passage.segments.map((seg, i) => {
          const outgoing = isOutgoing(seg.role);
          const active = activeKey === seg.id;
          return (
            <li
              key={seg.id}
              className={`flex items-center gap-2 ${
                outgoing ? "flex-row-reverse" : "flex-row"
              }`}
              style={{
                animation: "rise 0.4s ease-out both",
                animationDelay: `${Math.min(i * 40, 600)}ms`,
              }}
            >
              <Bubble role={seg.role} outgoing={outgoing} active={active}>
                <ConnectiveText
                  text={seg.text}
                  anchorIndices={[...(anchors[seg.id] ?? seg.connectiveIndices)]}
                  highlight={highlight}
                  onToggleWord={
                    editAnchors ? (idx) => toggleAnchor(seg.id, idx) : undefined
                  }
                />
              </Bubble>
              {supported && (
                <PlayButton
                  active={active}
                  onClick={() =>
                    active
                      ? stop()
                      : speak({
                          key: seg.id,
                          text: seg.text,
                          lang: passage.language,
                          src: srcFor(seg),
                        })
                  }
                />
              )}
            </li>
          );
        })}
      </ol>

      <style>{`
        @keyframes rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          li { animation: none !important; }
        }
      `}</style>
        </>
      )}
    </div>
  );
}

function Bubble({
  role,
  outgoing,
  active,
  children,
}: {
  role: SegmentRole;
  outgoing: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  const isCaller = role === "CALLER";
  const isResponder = role === "RESPONDER";

  let bg = "var(--unison)";
  let color = "var(--unison-ink)";
  let border = "1px solid var(--hairline)";
  if (isCaller) {
    bg = "var(--caller)";
    color = "var(--caller-ink)";
    border = "none";
  } else if (isResponder) {
    bg = "var(--responder)";
    color = "var(--responder-ink)";
    border = "none";
  }

  return (
    <div
      className="max-w-[80%] px-4 py-2.5 font-serif text-lg leading-snug shadow-[var(--bubble-shadow)] transition-shadow"
      style={{
        background: bg,
        color,
        border,
        borderRadius: outgoing ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        outline: active ? "2px solid var(--gold)" : "none",
        outlineOffset: active ? "2px" : "0",
      }}
    >
      {children}
    </div>
  );
}

function PlayButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? "Stop" : "Play line"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
        active
          ? "border-gold bg-gold text-parchment-raised"
          : "border-hairline text-ink-faint hover:border-gold/50 hover:text-gold"
      }`}
    >
      {active ? <StopIcon /> : <PlayIcon />}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.6v8.8c0 .5.5.8 1 .6l7-4.4c.4-.3.4-.9 0-1.2l-7-4.4c-.5-.3-1 0-1 .6z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2.5" y="2.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}
